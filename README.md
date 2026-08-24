# eth.shop

Sell anything at `eth.shop/you`. A Juicebox V6 storefront that puts the 721 tiers hook first:
one V6 project with a 721 hook is one shop, tier categories are shop categories, tiers are items.

Same stack as revnet.money and juicebox.money: Next 16 (webpack), React 19, Tailwind 4; wagmi 3 /
viem 2 / `@bananapus/nana-sdk-core` land when chain reads are wired.

## Status

Prototype. Every page runs on fixtures in `src/lib/fixtures.ts`; nothing reads the chain yet.

- `/` home, marketplace direction. `/?v=b` storefront-platform direction.
- `/<handle>` a shop. Try `/tea` (small) and `/press` (grown).
- `/sell` the create flow.

```sh
npm ci && npm run dev   # http://localhost:3003
```
