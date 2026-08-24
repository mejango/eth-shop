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

## Release checklist

- `npx tsc --noEmit && npx eslint . --max-warnings=0 && npx vitest run`
- `npm run check` (typecheck + lint + test + `next build`)
- Shop images must be pinned to IPFS: the CSP `img-src` only allows `'self'`, `data:`, and the
  juicebox.center IPFS gateway — a third-party-hosted image URL will be blocked by the browser.
