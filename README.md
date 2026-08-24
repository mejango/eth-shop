# eth.shop

Sell anything at `eth.shop/you`. A Juicebox V6 storefront that puts the 721 tiers hook first:
one V6 project with a 721 hook is one shop, tier categories are shop categories, tiers are items.

Same stack as revnet.money and juicebox.money: Next 16 (webpack), React 19, Tailwind 4; wagmi 3 /
viem 2 / `@bananapus/nana-sdk-core` land when chain reads are wired.

## Status

Reads are live: the home feed and `/<chain>:<id>` or `/<ens-handle>` shop pages come from Bendystraw
and the chain. `/demo` is a static walkthrough of every 721 feature including the owner console.
Buying, opening a shop and managing one are not wired yet (see docs/superpowers/specs).

Env: copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_RPC_<chainId>` to at least two providers
per chain you care about.
