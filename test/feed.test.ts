import { describe, expect, it } from "vitest";
import { distinctHooks, isFeedWorthy, isValidCursor, orderFeedRows, usableFeedRows } from "@/lib/feed";

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
  it("accepts null (first page)", () => {
    expect(isValidCursor(null)).toBe(true);
  });

  it("accepts a normal cursor string", () => {
    expect(isValidCursor("eyJqc29uIjp7ImNyZWF0ZWRBdCI6MTB9fQ==")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidCursor("")).toBe(false);
  });

  it("rejects a cursor over 512 chars", () => {
    expect(isValidCursor("a".repeat(513))).toBe(false);
  });

  it("accepts a cursor at exactly 512 chars", () => {
    expect(isValidCursor("a".repeat(512))).toBe(true);
  });

  it("rejects a cursor containing a control character", () => {
    expect(isValidCursor("\u0000bad")).toBe(false);
  });
});
