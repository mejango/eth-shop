import type { Item, Shop } from "./types";

// Client-safe pure helpers for omnichain shops. Fetch/orchestration lives in shop.ts.

/**
 * Content identity of an item across chains. Tier ids are NOT assumed aligned
 * between chains, so two tiers merge only when everything a buyer sees matches:
 * name, art, raw price, effective (discounted) price, and category.
 */
export function itemKey(item: Item): string {
  return [
    item.name,
    item.image ?? `tier:${item.tierId}`,
    item.price,
    item.effectivePrice,
    item.category,
  ].join("|");
}

/**
 * Merge per-chain catalogs into one. The first catalog is the canonical chain and
 * defines display fields and ordering; peer-only items append after it. Merged
 * items carry a `chains` entry per chain (that chain's tierId + remaining).
 * Remaining sums across chains; unlimited anywhere wins. A single catalog passes
 * through untouched (no `chains` field).
 */
export function mergeCatalogs(catalogs: { shop: Shop; items: Item[] }[]): Item[] {
  if (catalogs.length <= 1) return catalogs[0]?.items ?? [];
  const out: Item[] = [];
  const byKey = new Map<string, Item>();
  for (const { shop, items } of catalogs) {
    for (const item of items) {
      const key = itemKey(item);
      const entry = { chainId: shop.chainId as number, tierId: item.tierId, remaining: item.remaining };
      const existing = byKey.get(key);
      // Two tiers on the SAME chain sharing content are distinct listings, not one
      // omnichain item — keep them separate (and unmergeable by later chains).
      if (existing?.chains!.some((c) => c.chainId === shop.chainId)) {
        out.push({ ...item, chains: [entry] });
        continue;
      }
      if (!existing) {
        const merged = { ...item, chains: [entry] };
        byKey.set(key, merged);
        out.push(merged);
      } else {
        existing.chains!.push(entry);
        existing.remaining =
          existing.remaining === undefined || item.remaining === undefined
            ? undefined
            : existing.remaining + item.remaining;
        existing.sold += item.sold;
      }
    }
  }
  return out;
}

/**
 * Chains where EVERY cart line is available in the requested quantity.
 * An item without `chains` (single-chain shop) exists only on the home chain.
 */
export function availableChainIds(
  lines: { item: Item; qty: number }[],
  chainShops: Shop[],
  homeChainId: number,
): number[] {
  return chainShops
    .map((s) => s.chainId as number)
    .filter((chainId) =>
      lines.every(({ item, qty }) => {
        const entry = item.chains
          ? item.chains.find((c) => c.chainId === chainId)
          : chainId === homeChainId
            ? { tierId: item.tierId, remaining: item.remaining }
            : undefined;
        return !!entry && (entry.remaining === undefined || entry.remaining >= qty);
      }),
    );
}

/** The tierId to mint for `item` on `chainId` (merged items map per chain). */
export function tierIdOn(item: Item, chainId: number): number {
  return item.chains?.find((c) => c.chainId === chainId)?.tierId ?? item.tierId;
}
