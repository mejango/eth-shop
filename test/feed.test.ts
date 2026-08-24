import { describe, expect, it } from "vitest";
import { orderFeedRows } from "@/lib/feed";

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
