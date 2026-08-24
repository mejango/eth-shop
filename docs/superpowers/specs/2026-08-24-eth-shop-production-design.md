# eth.shop — production design

Status: draft for review. Prototype (fixtures only) lives on `main` as of 2026-08-24.

## What it is

A Juicebox V6 storefront. One V6 project with a `JB721TiersHook` is one shop; tier categories are
shelves; tiers are items. eth.shop is the buyer- and seller-facing surface for exactly that, the thing
juicebox.money, revnet.money and juicescan bury in a project page "Shop" tab. Any existing V6 project
with a 721 hook appears automatically.

Home = "Make it your own." handle hero over an endless feed of items across every shop. `/<handle>`
= a shop. `/sell` = open a shop. Manage mode on a shop = the owner console.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Stack | Same as revnet.money: Next 16 (webpack), React 19, wagmi 3, viem 2, Tailwind 4, `@bananapus/nana-sdk-core` v6, Para embedded wallet, Bendystraw + juicebox.center | Shared plumbing is copy-in; same deploy shape (Railway, Dockerfile, `/api/healthz`) |
| Chains | Ethereum, Base, Optimism, Arbitrum (+ their testnets behind `NEXT_PUBLIC_TESTNET=1`) | The V6 deploy set |
| Shop = | one project, **one chain** | Multi-chain shops (suckers) deferred; nothing in the UI assumes it |
| Handle | ENS name via `JBProjectHandles` (mainnet), text record `juicebox = "<chainId>:<projectId>"`. URL `eth.shop/<name>` where `<name>` is the ENS name without `.eth` (full name if it has another TLD). Fallback URL `eth.shop/<chain>:<id>` always works | It's the only on-chain handle system and the one the other clients use. **Open question for jango:** creating a shop without an ENS name means the hero's promised `eth.shop/you` is only true after attaching ENS. Options: (a) accept, show `eth.shop/base:41` until ENS is set, guide the user to set the text record; (b) eth.shop-owned ENS subnames `you.eth.shop`-style issued at create time (needs an ENS parent name + a resolver we control). Spec assumes (a). |
| Prices | Tier currency ETH or USD (JBPrices id), decimals per hook `pricingContext` | Same as jbm; USD shows converted ETH at pay time |
| Discount | client-side `effectiveTierPrice`, read `discountPercent` from chain (Bendystraw has no discount column) | Correctness over indexer convenience |
| Media | pin via juicebox.center from the browser (no API key in client); read via `resolvedUri` → IPFS gateway; on-chain `tokenUriResolver` wins when set | Matches jbm/revnet |
| Data source rule | Bendystraw for lists/feeds; chain for anything a tx depends on (tiers before pay, ownership before cash-out, permissions before showing Manage). Bendystraw miss → on-chain fallback, never a false "no shop" | See memory: bendy-onchain-fallback, sdk-721 helpers |
| Identity | eth.shop's own look (Archivo + JetBrains Mono, one blue), not the Juicebox brand | Already built |
| Support for physical goods | Not in scope; the "shipping shared privately" line stays and links nowhere until JBChat ships | Future |

## Routes

- `/` — feed: Bendystraw `nftHooks(where:{version:6})` with `nftTiers` + `project`, newest-tier-first,
  paginated (cursor), dedup per hook. Items with `remainingSupply 0` still shown as sold out. Server
  component, revalidate 60s; client "Load more".
- `/<handle>` — resolve: if `<chain>:<id>` slug → direct; else ENS name → `JBProjectHandles.handleOf`
  reverse via text record (`parseProjectHandleRecord`, copied from revnet-money). Then
  `getProject721Shop` (SDK) for hook/store/idTarget/pricing/tiers; Bendystraw `project` for
  name/logo/description; on-chain `discountPercent` per tier (multicall). 404 → "No shop here yet".
  Query `?item=<tierId>` opens the dialog (native `<dialog>`, URL-addressable for sharing).
- `/<handle>?manage` — same page, owner console; shown only if connected wallet is project owner OR
  holds any of the four 721 permission ids from the owner (`JBPermissions.hasPermissions`). Otherwise
  the toggle is hidden and the query is ignored.
- `/sell` — create flow (existing UI). Draft persisted in `localStorage` (never wallet-keyed).
- `/account` — items you hold across shops (`useOwnedShopItems` + `ownerOf` verify) and credits per shop.
- `/api/healthz`, `/api/og/shop/<chain>:<id>`, `/api/og/item/<chain>:<id>/<tier>` — OG images.
- `/sitemap.xml`, `/robots.txt`, `/llms.txt`.

## Data model (client)

```ts
Shop  { chainId, projectId, handle?, name, tagline?, about?, logo?, hook, store, idTarget,
        pricing:{currency,decimals}, flags:{preventOverspending,issueTokensForSplits,noNewTiersWith*},
        ruleset:{pauseTransfers,pauseMintPendingReserves,useDataHookForCashOut}, symbol, owner,
        terminal, acceptedTokens[] }
Item  { tierId, category, categoryName?, name, description?, media?, price, discountPercent,
        remaining, initial, reserveFrequency, reserveBeneficiary, pendingReserves, votingUnits,
        flags:{allowOwnerMint,transfersPausable,cantBeRemoved,cantBuyWithCredits,
               cantIncreaseDiscountPercent}, splitPercent, splits[] }
```
`categoryName` comes from tier metadata JSON (jbm convention `categoryName`); fallback "Category N".
Project metadata JSON (pinned at create) follows the jbm/revnet `.jb` schema plus
`ethShop:{tagline}`; `description` is `about`.

## Transactions

All writes go through the shared TxSteps viewer (copied from revnet-money): simulate → approvals
(ERC-20 only) → sign → wait → verify. Every encoder is a pure function in `src/lib/tx/*.ts` with a
vitest.

| Action | Call | Notes |
|---|---|---|
| Open shop | `JB721TiersHookProjectDeployer.launchProjectFor(owner, deployTiersHookConfig, {projectUri, rulesetConfigurations, terminalConfigurations, memo}, controller, salt)` | Always via the 721 deployer so the hook exists day 1. Ruleset: no cycle, 0 reserved rate, no cash-out tax unless items cash out, `useDataHookForCashOut` from the toggle, `pauseTransfers`/`pauseMintPendingReserves` bits 0. Terminal: JBMultiTerminal with native + USDC contexts. Tiers sorted by category ascending; reserve-beneficiary ordering trap handled by setting `useReserveBeneficiaryAsDefault` on the FIRST reserve tier. Splits per tier. Discount ×2. `msg.value` = creation fee. |
| Buy | `terminal.pay(projectId, token, amount, beneficiary, minReturned, memo, metadata)` with `build721PayMetadata({metadataIdTarget, tierIdsToMint (id repeated per qty), allowOverspending})` | **Verify the mint**: `simulateCalls([balanceOf, pay, balanceOf])` and assert increase; a non-reverting pay proves nothing. Credits: read `payCreditsOf(you)`, shown and auto-applied by the hook when payer==beneficiary. Amount = Σ effective prices − credits (+ round-up if allowed). USD-priced: convert via JBPrices at quote time; re-quote on send. Via router terminal when the project's primary terminal is the registry (jbm `viaRouter` rule). |
| Add items | `hook.adjustTiers(tiersToAdd, [])` | Same encoder as launch. Respects `noNewTiersWith*` flags: disable the rule row with "This shop locked this option." |
| Remove item | `hook.adjustTiers([], [id])` | Disabled when `cantBeRemoved` |
| Discount | `hook.setDiscountPercentsOf([{tierId, discountPercent}])` | Increase blocked when `cantIncreaseDiscountPercent` |
| Item image / collection metadata | `hook.setMetadata(name, symbol, baseUri, contractUri, tokenUriResolver=address(hook) to keep, tierId, encodedIpfsUri)` | Pin first; empty string = unchanged |
| Free mint | `hook.mintFor([tierId], to)` | Only `allowOwnerMint` tiers |
| Mint reserves | `hook.mintPendingReservesFor(tierId, n)` | Permissionless; public button on the item |
| Pause transfers / reserves / cash-out toggle | `controller.queueRulesetsOf(projectId, [ruleset with metadata bits], memo)` | Queues a ruleset; UI says so |
| Operators | `JBPermissions.setPermissionsFor(owner, {operator, projectId, permissionIds:[ADJUST_721_TIERS, SET_721_METADATA, MINT_721, SET_721_DISCOUNT_PERCENT]})` | Ids from `nana-permission-ids-v6` |
| Hand over | `JBProjects.transferFrom(you, to, projectId)` | Confirm modal spells out what transfers |
| Send item | `hook.transferFrom(you, to, tokenId)` | Blocked when tier `transfersPausable` && ruleset paused |
| Cash out | `terminal.cashOutTokensOf(holder, projectId, 0, token, minReclaimed, beneficiary, build721CashOutMetadata({metadataIdTarget, tokenIds}))` | Only when `useDataHookForCashOut`; quote = `cashOutWeightOf(ids)/totalCashOutWeight × surplus` |
| Delegate votes | `checkpoints.delegate(to, tokenIds)` | Only if `hook.checkpoints()` deployed; else "activates on first transfer" |

## Wallet

Copy `src/providers/*`, `wallet-connectors.ts`, Para config from revnet-money verbatim (EIP-6963
injected, WalletConnect if id set, Para email/social lazy-loaded). Safe App manifest at
`/manifest.json`. No wallet state is persisted in the query cache.

## Production

- Railway service "eth-shop", Dockerfile + `railway.json` copied from revnet-money; `output:
  "standalone"`; `/api/healthz`; env validated at build+runtime (`scripts/validate-env.mjs`).
- Env: `NEXT_PUBLIC_SITE_URL=https://eth.shop`, `NEXT_PUBLIC_BENDYSTRAW_URL`,
  `NEXT_PUBLIC_TESTNET_BENDYSTRAW_URL`, `NEXT_PUBLIC_PARA_*`, `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`,
  RPC lists per chain (≥2 providers per prod chain), `NEXT_PUBLIC_VERSION`.
- Bendystraw persisted-operation registry if the prod endpoint enforces it (memory:
  jbm-persisted-op-registry) — verify against the endpoint eth.shop points at.
- Security headers as revnet-money (CSP frame-ancestors for Safe).
- OG images via `next/og` (Satori: numeric width/height only).
- Tests: vitest for every tx encoder + slug/handle parsing + price math; Playwright smoke: home
  renders feed, shop page renders a real Base shop, dialog opens by URL, sell flow reaches preview.
  `npm run check` mirrors revnet-money's gate list minus what doesn't exist yet.
- Domain: eth.shop → Railway; `old`-style redirects none.

## Not in scope (this spec)

Multi-chain shops and suckers; JBChat support threads; fiat (JBProcessor); per-chain quantity;
tokenUriResolver authoring; analytics; i18n.

## Phases (each becomes a plan)

1. **Read** — chain + Bendystraw reads behind the existing UI: feed, shop page, item dialog, account.
   Fixtures deleted except `/demo`, which stays as the interactive walkthrough on static data.
2. **Wallet + buy** — providers, TxSteps, pay with verified mint, credits, receipts.
3. **Open a shop** — pinning, launch encoder, ENS handle guidance.
4. **Manage + holder actions** — everything in the transactions table not yet covered.
5. **Production** — Railway, env, OG, tests, domain.
