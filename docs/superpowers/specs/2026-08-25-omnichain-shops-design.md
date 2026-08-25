# Omnichain shops — design

**Goal:** A shop that exists on more than one chain (same Bendystraw sucker group) shows one
merged catalog: an item that exists on several chains renders as ONE card with inventory
summed across chains, and the buyer picks a chain at checkout.

## Data flow

1. `readOmnichainShop(chainId, projectId)` (new, `src/lib/omnichain.ts`):
   - Bendystraw: `project(chainId, projectId, 6).suckerGroupId`, then
     `projects(where: { suckerGroupId, version: 6 })` → peer `(chainId, projectId)` rows.
     Bendystraw failure or no group → single-chain fallback (today's behavior). Fail open.
   - `readShop` per chain in parallel (existing function, untouched). A peer whose read
     fails is dropped with a `console.warn` — the shop renders from the chains that answered.
   - Merge items across chains by **content identity**: `name | image (or tier:<id>) | price | category`.
     Tier ids are NOT assumed aligned across chains.
2. Merged `Item` gains `chains?: { chainId, tierId, remaining }[]` (present only when >1 chain).
   Merged `remaining` = undefined if any chain is unlimited, else the sum. `sold`/`initial` sum.
   The card and drawer read these as before; the drawer lists per-chain availability.
3. `Shop` stays per-chain. The page passes ALL per-chain shops to `ShopView`
   (`chainShops: Shop[]`, canonical first).

## Checkout (chain choice at buy time)

BuyFlow stays single-chain — no internal changes to the money path. `ShopView` owns
`buyChainId` (default: canonical). At checkout it:
- offers only chains where EVERY cart line exists (pill row above the order summary,
  rendered by ShopView/BuyFlow header area; hidden when only one option),
- maps each merged cart line to that chain's tierId,
- passes `shop = chainShops[buyChainId]` into BuyFlow (hooks re-key automatically).
Switching chains resets any in-flight preparation (BuyFlow already re-prepares when
`shop.chainId` changes via its query keys / effect deps).

## Out of scope

Cross-chain payment routing (paying on chain A for chain B's item), per-chain price
divergence display (each chain's own price is used at checkout; identity requires equal
raw price so merged cards can't diverge), account-page merge.

## Tests

- merge: identical tiers on 4 chains → 1 item, summed supply; unlimited beats sum;
  divergent price/name/image → separate items; single-chain → untouched items, no `chains`.
- chain options: cart with items on {ETH, Base} ∩ {ETH} → only ETH offered.
