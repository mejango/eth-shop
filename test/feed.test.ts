import { describe, expect, it } from "vitest";
import { isFeedWorthy, orderFeedRows, usableFeedRows } from "@/lib/feed";

describe("orderFeedRows", () => {
  it("newest first, drops empty tiers", () => {
    const rows = orderFeedRows([
      { createdAt: 10, initialSupply: 5, tierId: 1 },
      { createdAt: 30, initialSupply: 0, tierId: 2 },
      { createdAt: 20, initialSupply: 1, tierId: 3 },
    ]);
    expect(rows.map((r) => r.tierId)).toEqual([3, 1]);
  });
});

describe("usableFeedRows", () => {
  it("drops rows with a null hook or an unsupported chain", () => {
    const rows = usableFeedRows([
      { chainId: 8453, hook: { address: "0x1", projectId: 1 }, tierId: 1 },
      { chainId: 8453, hook: null, tierId: 2 },
      { chainId: 999999, hook: { address: "0x2", projectId: 2 }, tierId: 3 },
    ]);
    expect(rows.map((r) => r.tierId)).toEqual([1]);
  });
});

describe("isFeedWorthy", () => {
  it("is false with no metadata", () => {
    expect(isFeedWorthy(undefined)).toBe(false);
  });

  it("is false with neither a name nor an image", () => {
    expect(isFeedWorthy({})).toBe(false);
  });

  it("is true with a name only", () => {
    expect(isFeedWorthy({ name: "Rhoads" })).toBe(true);
  });

  it("is true with an image only", () => {
    expect(isFeedWorthy({ image: "https://juicebox.center/ipfs/x" })).toBe(true);
  });

  it("is true with both", () => {
    expect(isFeedWorthy({ name: "Rhoads", image: "https://juicebox.center/ipfs/x" })).toBe(true);
  });
});
