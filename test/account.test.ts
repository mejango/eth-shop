import { describe, expect, it } from "vitest";
import { groupByShop } from "@/lib/account";

describe("groupByShop", () => {
  it("groups in first-seen order and counts", () => {
    const g = groupByShop([
      { shop: "base:1", shopName: "A", tokenId: "1", tierId: 1, name: "x" },
      { shop: "base:1", shopName: "A", tokenId: "2", tierId: 1, name: "x" },
      { shop: "eth:2", shopName: "B", tokenId: "3", tierId: 4, name: "y" },
    ]);
    expect(g.map((s) => [s.shop, s.items.length])).toEqual([
      ["base:1", 2],
      ["eth:2", 1],
    ]);
  });
});
