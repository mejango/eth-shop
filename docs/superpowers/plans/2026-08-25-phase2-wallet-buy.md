# eth.shop Phase 2 (Wallet + Buy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A visitor can connect a wallet (injected, WalletConnect, Para email/social, Safe), buy items from any real shop, and see what they own — with every wallet write going through the same reviewed-write boundary revnet.money uses, and with the purchase verified to have minted the NFT.

**Architecture:** Wallet stack, transaction boundary and review dialog are copied from `webclients/revnet-money` file-for-file (renaming only storage keys and site identity), so the two apps stay mechanically comparable. On top: a small pure pay-math module, three read hooks (credits, terminal, preview), and a `BuyFlow` client component that replaces the demo `Checkout` for real shops. Real-shop pages stay server-rendered; wallet/cart state is client-only.

**Tech Stack:** Next 16 (webpack), React 19, wagmi 3.7.4, `@wagmi/core` 3.6.4, viem 2.55.8, `@tanstack/react-query` 5.101.4, Para 3.11.0, `@bananapus/nana-sdk-core` ^2.4.0, vitest.

**Spec:** `docs/superpowers/specs/2026-08-24-eth-shop-production-design.md` (sections Wallet, Transactions → Buy, Routes → `/account`)

## Global Constraints

- Source of truth for copied files: `/Users/jango/Documents/jb/v6/evm/webclients/revnet-money/src/...` (call it `$RM`). Copy verbatim; the only edits allowed are (a) string renames listed in the task, (b) removing imports of revnet-only modules named in the task. Never re-implement a copied file from memory.
- Every wallet write (`writeContract*`, `sendTransaction*`, `sign*`) may exist ONLY in `src/hooks/useReviewedWriteContract.ts`; `npm run wallet-writes:check` enforces it and must pass.
- 721 pay metadata keys off the hook's `METADATA_ID_TARGET` (`shop.idTarget`), never the clone address.
- Item checkout goes to `resolvePaymentTerminal(...).address` and refuses `isRouter` tokens ("Item checkout requires a directly accepted token.").
- The displayed "you'll receive at least" equals the `minReturnedTokens` sent; never send 0 when a positive floor is expected (see `jb-website-tx-min-param-floor`).
- Send gas = `gasWithHeadroom(estimate)` (2×), `0n` on Safe; never the simulation gas cap.
- A purchase is verified by reading `balanceOf(buyer)` on the hook before and after; a non-reverting `pay` proves nothing.
- Quotes used to build the tx are re-read at send time; never build a tx from `placeholderData`.
- Nothing wallet-keyed is persisted to disk (query persistence is opt-in via `meta.persist` only).
- Chains: 1, 8453, 10, 42161 (+ testnets with `NEXT_PUBLIC_TESTNET=1`). RPC via juicebox.center.
- Copy: sentence case, no middots, no emoji. Gates before each commit: `npx tsc --noEmit && npx eslint . --max-warnings=0 && npx vitest run`. Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- After any scripted edit, grep for the new text before claiming it applied.

---

## File map

| File | From | Responsibility |
|---|---|---|
| `package.json`, `next.config.js`, `src/vendor/HeartbeatWorker.js`, `.env.example`, `scripts/validate-env.mjs`, `scripts/test-validate-env.mjs` | `$RM` | Wallet deps, webpack aliases, env gates |
| `src/lib/browserEnvironment.ts`, `src/lib/chainList.ts` (new) | `$RM` / new | Env flags; client-safe chain list |
| `src/lib/wagmiConfig.ts`, `src/lib/wagmiTransports.ts` | `$RM` | wagmi config on jbcenter transports |
| `src/providers/*` (lazy-connector, lazy-para-connector, wallet-connectors, para-config, para-bridge, para-session, para-logout, preload-para, ParaAuthContext, ParaAuthSheet, ParaModalHost, SignInShell, SignInPlaceholder, ParaConnectionNotice) | `$RM` | Connectors + Para |
| `src/app/providers.tsx` (from `$RM/app/AppSpecificProviders.tsx`), `src/lib/query-persist.ts` | `$RM` | Provider tree, QueryClient, persistence |
| `src/hooks/useReviewedWriteContract.ts`, `src/hooks/useAllowance.ts`, `src/lib/transaction-review.ts`, `src/components/TransactionReviewProvider.tsx`, `src/lib/transaction-activity.ts`, `src/lib/waitForReceipt.ts`, `src/lib/gas.ts`, `src/lib/utils.ts` (`formatWalletError` only), `src/components/ui/TxSteps.tsx` | `$RM` | The write boundary |
| `src/components/WalletButton.tsx`, `src/components/ButtonWithWallet.tsx` | `$RM` (trimmed) | Connect/account UI |
| `src/lib/pay.ts` (new) | new | Pure cart/credit/USD/floor math |
| `src/hooks/useShopPurchase.ts` (new) | new | credits, terminal, preview, balance reads |
| `src/components/shop/BuyFlow.tsx` (new) | new | Real-shop checkout with TxSteps |
| `src/components/shop/ShopView.tsx` | modify | Real shops: cart + BuyFlow; demo unchanged |
| `src/app/account/page.tsx` (new) | new | Redirect to the connected address |
| `scripts/check-wallet-write-sites.mjs`, `test/fixtures/wallet-write-sites.json`, `TESTING.md` | `$RM` | Write-site gate |
| `test/pay.test.ts`, `test/useShopPurchase.test.ts` | new | Tests |

---

### Task 1: Wallet dependencies, webpack aliases, env gates

**Files:**
- Modify: `package.json`, `next.config.js`, `.env.example`
- Create: `src/vendor/HeartbeatWorker.js`, `scripts/validate-env.mjs`, `scripts/test-validate-env.mjs`, `src/lib/browserEnvironment.ts`

**Interfaces:**
- Produces: `IS_DETERMINISTIC_BROWSER: boolean`, `PARA_EMBEDDED_WALLET_ENABLED: boolean` (`src/lib/browserEnvironment.ts`, verbatim from `$RM/lib/browserEnvironment.ts`); `npm run env:check:build` / `env:check:runtime`; `npm run build` = `env:check:build && next build --webpack`.

- [ ] **Step 1: Deps**

```bash
npm install --no-audit --no-fund wagmi@3.7.4 @wagmi/core@3.6.4 @tanstack/react-query@5.101.4 @coinbase/wallet-sdk@4.3.7 @walletconnect/ethereum-provider@2.23.10 @safe-global/safe-apps-provider@^0.18.6 @safe-global/safe-apps-sdk@^9.1.0 @getpara/react-sdk-lite@3.11.0 @getpara/react-component-library@3.11.0 @getpara/wagmi-v2-connector@3.11.0 @getpara/web-sdk@3.11.0 qrcode@1.5.4 tailwind-merge@^3.6.0
npm install --no-audit --no-fund -D @types/qrcode@1.5.5
```
Add to `package.json` the `overrides` block from `$RM/package.json` (`@walletconnect/jsonrpc-ws-connection.ws 7.5.13`, `ws 8.21.1`, `nanoid 3.3.18`, `axios 1.18.1`) and `optionalDependencies` `@rolldown/binding-linux-x64-gnu` only if `npm ci` on Linux needs it (skip otherwise).

- [ ] **Step 2: next.config.js**

Copy the `webpack(config, { webpack })` function and the `pageExtensions` line from `$RM/next.config.js` (lines 19-93) into `next.config.js` verbatim. Copy `$RM/src/vendor/HeartbeatWorker.js` byte-for-byte to `src/vendor/HeartbeatWorker.js`. Keep eth.shop's existing `headers()` (CSP img-src) and add the Safe `frame-ancestors` CSP line from `$RM` **merged into the same `Content-Security-Policy` header value** (`frame-ancestors https://app.safe.global https://app.5afe.dev; img-src ...`).

- [ ] **Step 3: Env**

Copy `$RM/scripts/validate-env.mjs` and `$RM/scripts/test-validate-env.mjs`; replace `https://revnet.money` with `https://eth.shop`. `.env.example`: add `NEXT_PUBLIC_PARA_API_KEY`, `NEXT_PUBLIC_PARA_ENV`, `NEXT_PUBLIC_PARA_ONRAMP_PROVIDER=STRIPE`, `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=`, `NEXT_PUBLIC_VERSION=development`, `NEXT_PUBLIC_DETERMINISTIC_BROWSER=`, `NEXT_PUBLIC_RPC_FIXTURE_URL=` with the comments from `$RM/.env.example`. Scripts: `"env:check:build"`, `"env:check:runtime"`, `"env:test"` as in `$RM`; `"build": "npm run env:check:build && next build --webpack"`; `"start": "npm run env:check:runtime && next start"`; add `env:test` to `check`.

- [ ] **Step 4: browserEnvironment.ts** — copy verbatim.

- [ ] **Step 5: Gates, build, commit**

Run: `npm run env:test && npx tsc --noEmit && npx eslint . --max-warnings=0 && npx vitest run && npm run build` — Expected: green (build now runs env validation first).
```bash
git add -A && git commit -m "Wallet dependencies, webpack aliases, env gates from revnet.money

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Connectors, Para, wagmi config

**Files:**
- Create: `src/lib/chainList.ts`, `src/lib/wagmiTransports.ts`, `src/lib/wagmiConfig.ts`, everything under `src/providers/` listed in the file map
- Modify: `src/lib/chains.ts` (import the list from `chainList.ts`)

**Interfaces:**
- Produces: `SUPPORTED_CHAINS` (viem chain objects, client-safe) and `SUPPORTED_CHAIN_IDS` from `src/lib/chainList.ts` (no `server-only`); `src/lib/chains.ts` re-exports them and keeps `publicClientFor` server-only. `wagmiConfig` from `src/lib/wagmiConfig.ts`; `transports` from `src/lib/wagmiTransports.ts` (built with eth.shop's `jbCenterRpcTransport`). Provider exports exactly as in `$RM` (see Phase 2 inventory: `lazyConnector`, `wasRecentConnector`, `externalWalletConnectors`, `lazyParaConnector`, `getParaClient`, `createParaWagmiConnector`, `connectParaSession`, `hasParaSessionMarker`, `markParaSession`, `useParaAuth`, `ParaAuthSheet`, `ParaModalHost`, `SignInShell`, `SignInPlaceholder`, `ParaConnectionNotice`, `logoutParaSession`, `preloadParaHost`).

- [ ] **Step 1: chainList.ts**

```ts
import { JB_CHAINS, type JBChainId } from "@bananapus/nana-sdk-core";

const MAINNETS = [1, 8453, 10, 42161] as const satisfies readonly JBChainId[];
const TESTNETS = [11155111, 84532, 11155420, 421614] as const satisfies readonly JBChainId[];

export const SUPPORTED_CHAIN_IDS: readonly JBChainId[] =
  process.env.NEXT_PUBLIC_TESTNET === "1" ? [...MAINNETS, ...TESTNETS] : [...MAINNETS];

export const SUPPORTED_CHAINS = SUPPORTED_CHAIN_IDS.map((id) => JB_CHAINS[id].chain);

export function isSupportedChain(id: number): id is JBChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(id);
}
```
`src/lib/chains.ts`: delete its own `MAINNETS/TESTNETS/SUPPORTED_CHAIN_IDS/isSupportedChain` and `export { SUPPORTED_CHAIN_IDS, SUPPORTED_CHAINS, isSupportedChain } from "./chainList"` (keep `server-only`, `publicClientFor`, `chainSlug`, `chainName`, override logic). Existing tests must still pass unchanged.

- [ ] **Step 2: wagmiTransports.ts + wagmiConfig.ts**

Copy `$RM/lib/wagmiTransports.ts` and `$RM/lib/wagmiConfig.ts`. Edits: import chains from `@/lib/chainList` (`SUPPORTED_CHAINS`), build `transports` as `Object.fromEntries(SUPPORTED_CHAIN_IDS.map((id) => [id, jbCenterRpcTransport(id)]))` typed `Record<number, Transport>`; drop `getViemPublicClient` (eth.shop has `publicClientFor` server-side; the client uses wagmi's `getPublicClient`). Keep `IS_DETERMINISTIC_BROWSER` handling.

- [ ] **Step 3: providers/**

Copy every listed file from `$RM/providers/` verbatim. Renames: `revnet` → `ethshop` in localStorage/sessionStorage keys and lock names (grep `"revnet` in the copied files and list each rename in the report); `PARA_APP` name/branding strings → "eth.shop"; `PARA_PORTAL_THEME` colors → eth.shop tokens (`#2743ff` accent, `#0e0e0e` ink, `#ffffff` paper). Do not copy `OnRampHandoff.tsx` (Phase 5 if wanted); remove its imports where referenced (`ParaAuthSheet`/`WalletButton` — stub the "Get funds" entry out).

- [ ] **Step 4: Gates, commit**

`npx tsc --noEmit && npx eslint . --max-warnings=0 && npx vitest run`.
```bash
git add -A && git commit -m "Connectors, Para and wagmi config from revnet.money

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Provider tree, query persistence, reviewed-write boundary

**Files:**
- Create: `src/app/providers.tsx`, `src/lib/query-persist.ts`, `src/hooks/useReviewedWriteContract.ts`, `src/hooks/useAllowance.ts`, `src/lib/transaction-review.ts`, `src/components/TransactionReviewProvider.tsx`, `src/lib/transaction-activity.ts`, `src/lib/waitForReceipt.ts`, `src/lib/gas.ts`, `src/lib/utils.ts`, `src/components/ui/TxSteps.tsx`
- Modify: `src/app/layout.tsx` (wrap `children` in `<Providers>`)

**Interfaces:**
- Produces (all verbatim from `$RM`): `Providers({children})`; `useWriteContract(options?)` → `{ writeContractAsync, writeContract, ... }` with `ReviewedWriteContractOptions { transactionReview?, reviewedInParent?, reverify?, preflightSimulation?, manualReceiptVerification? }`; `useWaitForTransactionReceipt`, `submittedViaSafe`, `SafeProposalPendingError`, `isSafeProposalPendingError`, `requireOnchainExecution`, `isSafeConnection`; `waitForReceiptWithRetry(client, hash, opts?)`, `isTransactionReceiptUnavailableError`; `gasWithHeadroom(estimate)`; `formatWalletError(err, fallback?)`; `TxSteps({steps, activeIndex, intro?, ariaLabel?, className?})`, `stepStatus`, `TxStep`; `installQueryPersistence`, `cachedQuery`, `immutableQuery`, `PERSIST`.

- [ ] **Step 1: Copy** each file verbatim. Renames: storage key `revnet:query-cache:v1` → `ethshop:query-cache:v1`; lock prefix `revnet:transaction:` → `ethshop:transaction:`; activity storage key likewise. `src/app/providers.tsx` = `$RM/app/AppSpecificProviders.tsx` with the `TooltipProvider` removed if eth.shop has no Radix tooltip (grep; if it does not, delete that wrapper and its import). Remove `requireNoViewAs()` and the `useViewAs` import from `useReviewedWriteContract.ts` (ViewAs is a revnet debug feature) — this is the ONE allowed logic removal; document it in a comment at the call site.
- [ ] **Step 2: TxSteps palette** — keep the API; swap classes to eth.shop tokens (`bg-accent`, `text-ink`, `text-mute`, `border-shelf-deep`).
- [ ] **Step 3: layout.tsx** — `<Providers>{children}</Providers>` inside `<body>`; add `<Toaster>` only if the copied review provider needs it (grep; otherwise nothing).
- [ ] **Step 4: Gates + build** — `npx tsc --noEmit && npx eslint . --max-warnings=0 && npx vitest run && npm run build`. The build proves the webpack aliases + worker replacement work with Para/Coinbase in the bundle. Load `/` in the dev server: no console errors, no hydration warning (curl the HTML, then open in headless Chrome and grep the console via `--enable-logging=stderr --v=0` for "Warning: " lines).
```bash
git add -A && git commit -m "Provider tree, query persistence and the reviewed-write boundary from revnet.money

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Connect button and account routing

**Files:**
- Create: `src/components/WalletButton.tsx`, `src/components/ButtonWithWallet.tsx`, `src/app/account/page.tsx`
- Modify: `src/components/Header.tsx` (render `WalletButton` left of "Sell"), `src/app/account/[address]/page.tsx` (no change to reads; add a "This is you" line when it matches the connected address — client island `src/components/account/YouBadge.tsx`)

**Interfaces:**
- `WalletButton()` (from `$RM/components/WalletButton.tsx` minus `ViewAsDialog`/`useViewAs`/`useViewedAccount`/`GetFunds`); `ButtonWithWallet({targetChainId, onClick, children, ...})` verbatim; `/account` redirects to `/account/<address>` when connected (client component using `useAccount`), otherwise renders "Connect to see your items" with the connect button.

- [ ] **Step 1** copy + trim as listed; grep the trimmed file for `ViewAs|GetFunds|OnRamp` and remove every reference.
- [ ] **Step 2** Header: `<WalletButton />` before the Sell link; on `/demo` the button still works (connecting is harmless there).
- [ ] **Step 3** `src/app/account/page.tsx`:
```tsx
"use client";
import { Header } from "@/components/Header";
import { WalletButton } from "@/components/WalletButton";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAccount } from "wagmi";

export default function AccountIndex() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  useEffect(() => {
    if (isConnected && address) router.replace(`/account/${address}`);
  }, [address, isConnected, router]);
  return (
    <>
      <Header />
      <div className="px-5 py-20">
        <h1 className="display text-4xl font-extrabold">Your items</h1>
        <p className="mt-3 text-mute">Connect a wallet to see what you hold.</p>
        <div className="mt-6"><WalletButton /></div>
      </div>
    </>
  );
}
```
- [ ] **Step 4** Manual check in a real browser (headless Chrome cannot inject a wallet): `/` shows Connect; clicking opens the sheet with Injected / WalletConnect (if id set) / Email; `/account` shows the connect prompt. Screenshot the sheet to the scratchpad and Read it.
- [ ] **Step 5** Gates, commit `"Connect button and account routing"`.

---

### Task 5: Pay math (pure) and purchase reads

**Files:**
- Create: `src/lib/pay.ts`, `src/hooks/useShopPurchase.ts`, `test/pay.test.ts`, `test/useShopPurchase.test.ts`

**Interfaces (`src/lib/pay.ts`, client-safe, no server-only):**
```ts
export type CartLine = { tierId: number; qty: number; effectivePrice: bigint; cantBuyWithCredits: boolean };
export function cartTotal(lines: CartLine[]): bigint;                      // Σ effectivePrice*qty
export function creditsApplicable(lines: CartLine[], credits: bigint): bigint; // min(credits, Σ over lines with !cantBuyWithCredits)
export function amountDue(lines: CartLine[], credits: bigint): bigint;     // cartTotal − creditsApplicable
export function tierIdsToMint(lines: CartLine[]): bigint[];               // tierId repeated qty times, ascending
/** Payment-token units for `pricingUnits` priced in the shop's currency: ceil(pricingUnits * pricePerUnit / 10^pricingDecimals). */
export function toPaymentUnits(pricingUnits: bigint, pricePerUnit: bigint, pricingDecimals: number): bigint;
export function minReturnedTokens(previewTokens: bigint, slippageBps: bigint): bigint; // previewTokens*(10000−bps)/10000; 0 only when previewTokens is 0
export function roundUp(amount: bigint, decimals: number): bigint; // next multiple of 10^(decimals−2) above amount (a 0.01-unit round-up)
```
**`src/hooks/useShopPurchase.ts`** (client; wagmi `usePublicClient`/`useReadContract`; SDK `resolvePaymentTerminal`, `previewPay`, `getAccountingContexts`):
```ts
export function useShopCredits(chainId, hook, address): { credits: bigint | undefined; ... }        // jb721TiersHookAbi.payCreditsOf
export function useCheckoutTerminal(chainId, projectId, token): { terminal?: Address; isRouter?: boolean; ... } // resolvePaymentTerminal
export function usePricePerUnit(chainId, projectId, payCurrency, pricingCurrency, payDecimals): { pricePerUnit: bigint | null; unavailable: boolean; ... } // JBPrices.pricePerUnitOf; same currency → 10^decimals; ContractFunctionRevertedError → null (no feed); transport → unavailable
export function useOwnedCount(chainId, hook, address): { count: number | undefined }                // hook.balanceOf
```
All hooks use `useQuery` keyed by every arg, `enabled` only when args are defined, NO `placeholderData`.

- [ ] **Step 1: Failing tests** (`test/pay.test.ts`): cartTotal with 2 lines; creditsApplicable caps at credits and excludes cantBuyWithCredits lines; amountDue never negative; tierIdsToMint repeats ids `[1n,1n,3n]` for qty 2+1; toPaymentUnits ceil-divides (`toPaymentUnits(25n*10n**18n, 400_000_000n /*USDC per USD*/, 18)` → `10_000_000_000n`? — compute the expectation from the formula in the test using BigInt math, asserting an exact literal); minReturnedTokens(1000n, 100n) → 990n and (0n, 100n) → 0n; roundUp(1_234_000_000_000_000_000n, 18) → 1_240_000_000_000_000_000n.
- [ ] **Step 2** run → FAIL. **Step 3** implement `pay.ts`. **Step 4** PASS.
- [ ] **Step 5** `useShopPurchase.test.ts`: test the pure classifier used by `usePricePerUnit` (`classifyPriceError(error) → "no-feed" | "unavailable"` exported from the hook file) with a `ContractFunctionRevertedError`-shaped object vs an `HttpRequestError`-shaped object (use viem's classes).
- [ ] **Step 6** Gates, commit `"Pay math and purchase reads"`.

---

### Task 6: BuyFlow for real shops

**Files:**
- Create: `src/components/shop/BuyFlow.tsx`
- Modify: `src/components/shop/ShopView.tsx` (real shops: enable Add to cart / cart bar / Buy; on checkout render `BuyFlow` instead of the demo `Checkout`; item dialog "Buying opens soon." replaced by the real Buy button; keep `/demo` byte-for-byte), `src/app/[handle]/page.tsx` (pass `acceptedTokens` from `getAccountingContexts` read in `readShop` — add `Shop.acceptedTokens: { token: Address; decimals: number; currency: number; symbol: string }[]` in `src/lib/shop.ts`/`types.ts`, native = `JBConstants.NATIVE_TOKEN`)

**Interfaces:**
- `BuyFlow({ shop, lines: CartLine[] (with names for display), onClose, onPurchased(tokenIds: bigint[]) })`. Internal phases: `preparing` (reads: credits, terminal, pricePerUnit for the selected token, preview via `previewPay` with 721 metadata, `balanceOf` before) → `ready` (review: lines, credit applied, round-up toggle unless `shop.flags.preventOverspending`, "you'll receive at least X <symbol> tokens", pay-token picker from `shop.acceptedTokens` filtered to non-router — ETH default) → `approving` (ERC-20 only: `useAllowance` → `writeContractAsync(approve)` with `reviewedInParent: true`, record `approvalReceipt.blockNumber`) → `simulating` (`publicClient.simulateContract` pinned to `approvalBlock`) → `signing` (`writeContractAsync(pay)` via the reviewed hook, `chainId: shop.chainId`) → `pending` (`requireOnchainExecution`, `waitForReceiptWithRetry`) → `verifying` (read `balanceOf(buyer)` again; if not `> before` → show "Payment went through but no item was minted — contact the shop" with the tx hash; do NOT call it success) → `success` (list new token ids from `Transfer` logs to the buyer in the receipt; invalidate `["owned", chainId, hook, address]`, `["credits", ...]`, and Phase 1's server data via `router.refresh()`).
- Tx built with SDK `buildPayTx({ chainId, terminal, projectId, token, amount: amountDue in payment units, beneficiary: address, minReturnedTokens: floor, memo: "", metadata: build721PayMetadata({ metadataIdTarget: shop.idTarget, tierIdsToMint, allowOverspending: roundUp && !preventOverspending }) })`. Native token: `value = amount`.
- The `TxSteps` list: `["Approve <SYMBOL>" (ERC-20 only), "Confirm purchase", "Waiting for the chain", "Checking your item"]` with `activeIndex` from phase.
- Fail-closed rules: no terminal or `isRouter` → checkout disabled with the router message; `pricePerUnit === null` → "This shop can't be paid in <SYMBOL>" and the token is disabled; preview missing → Buy disabled with "Still calculating"; wallet on the wrong chain → the reviewed hook switches it (Task 3), surface its message.

- [ ] **Step 1** Read `$RM/app/[slug]/components/v6/pay/V6PayCard.tsx` lines 857-1075 and `V6PayConfirmDialog.tsx` once; port the phase machine (same phase names) into `BuyFlow.tsx`. Do not port Relayr, Permit2/direct-swap, `addbalance`, `ViewAs`.
- [ ] **Step 2** ShopView wiring as above. Demo path must not import wagmi hooks at render time for `/demo` (fine to import the module; hooks run only inside `BuyFlow`, which the demo never mounts).
- [ ] **Step 3** `readShop`: add `acceptedTokens` via `getAccountingContexts(client, { chainId, projectId })` mapped to `{ token, decimals, currency, symbol }` (symbol: native → "ETH", USDC by known address per chain from the SDK constants if exported, else `"TOKEN"`); tests in `test/shop.test.ts` for the mapper only.
- [ ] **Step 4** Live test on a testnet shop you control, or on mainnet with a tiny item: set `NEXT_PUBLIC_TESTNET=1`, open a Sepolia/Base Sepolia 721 project (find one via Bendystraw testnet: `nftHooks(where:{version:6})` on `https://testnet.bendystraw.xyz/graphql`), connect an injected wallet in a real browser, buy the cheapest tier, and confirm: TxSteps advance, `balanceOf` increased, the item shows under `/account/<you>` after Bendystraw catches up (and immediately via the on-chain `useOwnedCount`). Record the tx hash in the report. If no funded testnet wallet is available, stop at the `simulating` phase and report DONE_WITH_CONCERNS naming exactly what was not exercised.
- [ ] **Step 5** Gates, commit `"Buy flow for real shops with verified mint"`.

---

### Task 7: Wallet-write gate, docs

**Files:**
- Create: `scripts/check-wallet-write-sites.mjs`, `test/fixtures/wallet-write-sites.json`, `TESTING.md`
- Modify: `package.json` (`"wallet-writes:check"`, add to `check`), `README.md`

- [ ] **Step 1** Copy the script; set the boundary map to `{"@/hooks/useReviewedWriteContract": { useWriteContract: {...} }}` only (no Relayr/Safe-signature/Permit2 modules). Generate the fixture by running the script once in "print" mode if it has one, else hand-write the JSON to match the actual sites (BuyFlow's approve + pay, WalletButton has none). Every non-boundary action names a test file containing `wallet-action:<id>` — add those markers to `test/pay.test.ts` (`// wallet-action:shop-purchase`, `// wallet-action:token-approval`).
- [ ] **Step 2** `TESTING.md`: the wallet-writes inventory section the script checks, plus how to run a purchase manually.
- [ ] **Step 3** README: wallet section (connect options, env vars), and the release-checklist additions (Para key/env, WalletConnect id).
- [ ] **Step 4** `npm run check` green (now includes env test + wallet-writes check + build). Commit `"Wallet-write gate and docs"`.

---

## Self-review

- **Spec coverage:** Wallet (T1–T4) incl. Safe manifest? — `/manifest.json` for Safe Apps is NOT in this plan; add to Phase 5 unless the copied `WalletButton` needs it (it does not). Buy (T5–T6): metadata id target, terminal resolution + router refusal, credits, USD via JBPrices, floor, verified mint, invalidation. `/account` (T4). Query persistence without wallet-keyed data (T3, opt-in meta). Out of scope by spec: cash out, delegate, send (Phase 4), multi-chain.
- **Placeholders:** none; copied files are specified by exact source path and the allowed edits are enumerated.
- **Type consistency:** `CartLine` (T5) is what `ShopView` builds for `BuyFlow` (T6); `Shop.acceptedTokens` added in T6 and consumed there; `SUPPORTED_CHAIN_IDS` moves to `chainList.ts` in T2 and `chains.ts` re-exports it so Phase 1 imports keep working.
