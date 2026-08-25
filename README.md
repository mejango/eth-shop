# eth.shop

Sell anything at `eth.shop/you`. A Juicebox V6 storefront that puts the 721 tiers hook first:
one V6 project with a 721 hook is one shop, tier categories are shop categories, tiers are items.

Same stack as revnet.money and juicebox.money: Next 16 (webpack), React 19, Tailwind 4, viem 2 and
`@bananapus/nana-sdk-core` for chain reads.

## Status

Reads are live: the home feed and `/<chain>:<id>` or `/<ens-handle>` shop pages come from Bendystraw
and the chain. `/demo` is a static, fully interactive walkthrough of every 721 feature including the
owner console. A real shop page is read-only — buying, opening a shop and managing one are not wired
yet (see docs/superpowers/specs).

## RPC / IPFS

juicebox.center is the default RPC and IPFS backend for every chain read in this app — see
`src/lib/jbcenter-rpc.ts` and `src/lib/jbcenter-config.ts`. It requires the site's origin to be
allowlisted on juicebox.center's side (mejango/jbcenter `src/app.ts`): `https://eth.shop` in
production, `https://dev.eth.shop` and `http://localhost:3003` in dev (PR #13, merged 2026-08-24,
deploys via Railway). If your origin isn't allowlisted yet, chain reads will fail until that deploy
lands.

`NEXT_PUBLIC_RPC_<chainId>` is an optional operator override: set it to your own comma-separated
HTTPS endpoints for a chain to bypass juicebox.center entirely for that chain. Copy `.env.example`
to `.env.local` to get started; leave the RPC overrides blank to use the juicebox.center default.

## Wallet

Connecting offers Para (an embedded, email/passkey wallet), any browser extension announced over
EIP-6963 (MetaMask, Rabby, and similar), Coinbase Wallet, and WalletConnect for wallets on another
device. All four go through the same reviewed write boundary
(`src/hooks/useReviewedWriteContract.ts`) before anything reaches a wallet — see `TESTING.md` for
the full wallet-writes inventory and how it's enforced.

Required env vars (see `.env.example`):

- `NEXT_PUBLIC_PARA_API_KEY` / `NEXT_PUBLIC_PARA_ENV` — Para keys live only in the Railway service
  variables (same project as juicebox.money); leave blank locally and the embedded wallet is
  disabled rather than broken. `NEXT_PUBLIC_PARA_ENV` must be one of `DEV`, `SANDBOX`, `BETA`, or
  `PROD`, and the production `eth.shop` origin is only valid with `PROD`.
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` — a WalletConnect Cloud project id. Leave empty to hide
  the WalletConnect option entirely; the relay rejects unregistered ids, so a connector without one
  is a button that always fails.

## Release checklist

- `npx tsc --noEmit && npx eslint . --max-warnings=0 && npx vitest run`
- `npm run check` (typecheck + lint + test + env test + wallet-writes check + `next build`)
- `npm run wallet-writes:check` on its own after touching any wallet-signed call — it fails closed
  when a write site moves outside the reviewed boundary or falls out of sync with
  `test/fixtures/wallet-write-sites.json` (see `TESTING.md`).
- Para key and environment (`NEXT_PUBLIC_PARA_API_KEY`, `NEXT_PUBLIC_PARA_ENV`) come from Railway
  service variables, not a local `.env` file, for any deployed environment.
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` is optional — confirm intentionally before leaving it
  unset, since that hides the WalletConnect option rather than breaking it.
- Shop images must be pinned to IPFS: the CSP `img-src` only allows `'self'`, `data:`, and the
  juicebox.center IPFS gateway — a third-party-hosted image URL will be blocked by the browser.
