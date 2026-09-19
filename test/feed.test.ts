import { describe, expect, it } from "vitest";
import { distinctHooks, isFeedWorthy, isValidCursor, lastSoldAt, orderFeedRows, pageOf, usableFeedRows } from "@/lib/feed";

describe("orderFeedRows", () => {
  const H = { address: "0xAbC" };
  it("newest listing first when nothing sold, drops empty tiers", () => {
    const rows = orderFeedRows([
      { chainId: 8453, hook: H, createdAt: 10, initialSupply: 5, tierId: 1 },
      { chainId: 8453, hook: H, createdAt: 30, initialSupply: 0, tierId: 2 },
      { chainId: 8453, hook: H, createdAt: 20, initialSupply: 1, tierId: 3 },
    ]);
    expect(rows.map((r) => r.tierId)).toEqual([3, 1]);
  });

  it("most recently sold leads; unsold follow by listing date; hook address case-insensitive", () => {
    const sold = lastSoldAt([
      { chainId: 8453, hook: "0xabc", tierId: 1, timestamp: 100 },
      { chainId: 8453, hook: "0xabc", tierId: 1, timestamp: 90 },
      { chainId: 8453, hook: "0xabc", tierId: 4, timestamp: 95 },
      { chainId: 1, hook: "0xabc", tierId: 3, timestamp: 200 },
    ]);
    const rows = orderFeedRows(
      [
        { chainId: 8453, hook: H, createdAt: 10, initialSupply: 5, tierId: 1 },
        { chainId: 8453, hook: H, createdAt: 30, initialSupply: 1, tierId: 3 },
        { chainId: 8453, hook: H, createdAt: 20, initialSupply: 1, tierId: 4 },
        { chainId: 8453, hook: H, createdAt: 25, initialSupply: 1, tierId: 5 },
      ],
      sold,
    );
    // tier 1 (sold at 100) > tier 4 (sold at 95) > unsold: tier 3 (30) > tier 5 (25). The
    // chain-1 sale of tier 3 doesn't count for the base tier 3.
    expect(rows.map((r) => r.tierId)).toEqual([1, 4, 3, 5]);
  });
});

describe("pageOf", () => {
  it("slices by offset and hands back the next offset until exhausted", () => {
    const all = [1, 2, 3, 4, 5];
    expect(pageOf(all, null, 2)).toEqual({ items: [1, 2], next: "2" });
    expect(pageOf(all, "2", 2)).toEqual({ items: [3, 4], next: "4" });
    expect(pageOf(all, "4", 2)).toEqual({ items: [5], next: null });
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

describe("distinctHooks", () => {
  it("dedupes by (chainId, hook address), case-insensitively, in first-seen order", () => {
    const rows = [
      { chainId: 8453, hook: { address: "0xAbC" } },
      { chainId: 8453, hook: { address: "0xabc" } },
      { chainId: 8453, hook: { address: "0xDEF" } },
      { chainId: 1, hook: { address: "0xAbC" } },
    ];
    expect(distinctHooks(rows)).toEqual([
      { chainId: 8453, address: "0xAbC" },
      { chainId: 8453, address: "0xDEF" },
      { chainId: 1, address: "0xAbC" },
    ]);
  });

  it("is empty for an empty input", () => {
    expect(distinctHooks([])).toEqual([]);
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

describe("isValidCursor", () => {
  it("accepts null (first page) and a positive offset", () => {
    expect(isValidCursor(null)).toBe(true);
    expect(isValidCursor("40")).toBe(true);
  });

  it("rejects empty, zero-led, non-numeric and oversized values", () => {
    expect(isValidCursor("")).toBe(false);
    expect(isValidCursor("040")).toBe(false);
    expect(isValidCursor("eyJqc29u")).toBe(false);
    expect(isValidCursor("1234567")).toBe(false);
    expect(isValidCursor("\u0000bad")).toBe(false);
  });
});
