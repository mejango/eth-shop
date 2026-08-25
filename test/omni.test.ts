import { describe, expect, it } from "vitest";
import { availableChainIds, mergeCatalogs, tierIdOn } from "@/lib/omni";
import type { Item, Shop } from "@/lib/types";

const shopOn = (chainId: number) => ({ chainId }) as Shop;
const item = (over: Partial<Item>): Item =>
  ({
    shop: "eth:4",
    tierId: 1,
    category: 1,
    categoryName: "Stuff",
    name: "Hat",
    image: "ipfs://hat",
    price: "1000",
    discountPercent: 0,
    effectivePrice: "1000",
    priceText: "0.001 ETH",
    fullPriceText: "0.001 ETH",
    remaining: 5,
    initial: 10,
    sold: 5,
    reserveFrequency: 0,
    votingUnits: "0",
    allowOwnerMint: false,
    transfersPausable: false,
    cantBeRemoved: false,
    cantBuyWithCredits: false,
    kind: "digital",
    ...over,
  }) as Item;

describe("mergeCatalogs", () => {
  it("passes a single catalog through untouched", () => {
    const items = [item({})];
    const merged = mergeCatalogs([{ shop: shopOn(1), items }]);
    expect(merged).toBe(items);
    expect(merged[0].chains).toBeUndefined();
  });

  it("collapses identical items across 4 chains into one with summed inventory", () => {
    const merged = mergeCatalogs(
      [1, 10, 8453, 42161].map((chainId) => ({ shop: shopOn(chainId), items: [item({ remaining: 3, sold: 2 })] })),
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].remaining).toBe(12);
    expect(merged[0].sold).toBe(8);
    expect(merged[0].chains).toHaveLength(4);
    expect(tierIdOn(merged[0], 8453)).toBe(1);
  });

  it("unlimited on any chain wins", () => {
    const merged = mergeCatalogs([
      { shop: shopOn(1), items: [item({ remaining: 3 })] },
      { shop: shopOn(8453), items: [item({ remaining: undefined })] },
    ]);
    expect(merged[0].remaining).toBeUndefined();
  });

  it("merges by content, not tier id", () => {
    const merged = mergeCatalogs([
      { shop: shopOn(1), items: [item({ tierId: 7 })] },
      { shop: shopOn(8453), items: [item({ tierId: 9 })] },
    ]);
    expect(merged).toHaveLength(1);
    expect(tierIdOn(merged[0], 1)).toBe(7);
    expect(tierIdOn(merged[0], 8453)).toBe(9);
  });

  it("keeps items separate when price, name, art, or discount diverge", () => {
    const merged = mergeCatalogs([
      { shop: shopOn(1), items: [item({}), item({ tierId: 2, name: "Cap" })] },
      { shop: shopOn(8453), items: [item({ effectivePrice: "900" }), item({ tierId: 2, name: "Cap" })] },
    ]);
    expect(merged).toHaveLength(3);
  });

  it("appends peer-only items after canonical ordering", () => {
    const merged = mergeCatalogs([
      { shop: shopOn(1), items: [item({})] },
      { shop: shopOn(8453), items: [item({ tierId: 5, name: "Base-only" })] },
    ]);
    expect(merged.map((m) => m.name)).toEqual(["Hat", "Base-only"]);
    expect(merged[1].chains).toEqual([{ chainId: 8453, tierId: 5, remaining: 5 }]);
  });
});

describe("availableChainIds", () => {
  const shops = [shopOn(1), shopOn(8453)];
  it("offers only chains where every line is in stock for its quantity", () => {
    const merged = mergeCatalogs([
      { shop: shopOn(1), items: [item({ remaining: 1 })] },
      { shop: shopOn(8453), items: [item({ remaining: 5 })] },
    ]);
    expect(availableChainIds([{ item: merged[0], qty: 2 }], shops, 1)).toEqual([8453]);
    expect(availableChainIds([{ item: merged[0], qty: 1 }], shops, 1)).toEqual([1, 8453]);
  });

  it("restricts to home chain for a chain-exclusive line", () => {
    const merged = mergeCatalogs([
      { shop: shopOn(1), items: [item({}), item({ tierId: 2, name: "ETH-only" })] },
      { shop: shopOn(8453), items: [item({})] },
    ]);
    const lines = merged.map((m) => ({ item: m, qty: 1 }));
    expect(availableChainIds(lines, shops, 1)).toEqual([1]);
  });

  it("single-chain items (no chains field) exist only on home", () => {
    expect(availableChainIds([{ item: item({}), qty: 1 }], shops, 1)).toEqual([1]);
    expect(availableChainIds([{ item: item({ remaining: undefined }), qty: 3 }], [shopOn(1)], 1)).toEqual([1]);
  });
});

describe("no chain can fill", () => {
  it("returns empty when per-chain stock is below qty even though the merged total covers it", () => {
    const shops = [shopOn(1), shopOn(8453)];
    const merged = mergeCatalogs([
      { shop: shopOn(1), items: [item({ remaining: 1 })] },
      { shop: shopOn(8453), items: [item({ remaining: 1 })] },
    ]);
    expect(merged[0].remaining).toBe(2);
    expect(availableChainIds([{ item: merged[0], qty: 2 }], shops, 1)).toEqual([]);
  });
});

describe("same-chain content twins", () => {
  it("never merges two tiers from the same catalog", () => {
    const merged = mergeCatalogs([
      { shop: shopOn(8453), items: [item({ tierId: 1 }), item({ tierId: 2 })] },
      { shop: shopOn(1), items: [item({ tierId: 1 })] },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].chains).toEqual([
      { chainId: 8453, tierId: 1, remaining: 5 },
      { chainId: 1, tierId: 1, remaining: 5 },
    ]);
    expect(merged[1].chains).toEqual([{ chainId: 8453, tierId: 2, remaining: 5 }]);
  });
});
