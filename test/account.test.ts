import { describe, expect, it } from "vitest";
import { groupByShop, tierSourceFor } from "@/lib/account";

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

describe("tierSourceFor", () => {
  const base = {
    chainId: 8453,
    tokenId: "1000000001",
    tierId: 1,
    hook: { address: "0xhook", projectId: 1, project: null },
  };

  it("un-customized: reads the tier's own metadata/resolvedUri", () => {
    const r = {
      ...base,
      customized: false,
      tokenUri: "data:application/json;base64,shouldBeIgnored",
      metadata: { shouldBeIgnored: true },
      tier: { metadata: { name: "Tier meta" }, resolvedUri: "ipfs://tier-uri" },
    };
    expect(tierSourceFor(r)).toEqual({
      tierId: 1,
      metadata: { name: "Tier meta" },
      resolvedUri: "ipfs://tier-uri",
    });
  });

  it("customized with a data: tokenUri: uses the per-token override as resolvedUri", () => {
    const r = {
      ...base,
      customized: true,
      tokenUri: "data:application/json;base64,eyJuYW1lIjoiQ3VzdG9tIn0=",
      metadata: { name: "Custom fallback" },
      tier: { metadata: { name: "Tier meta" }, resolvedUri: "ipfs://tier-uri" },
    };
    expect(tierSourceFor(r)).toEqual({
      tierId: 1,
      metadata: { name: "Custom fallback" },
      resolvedUri: "data:application/json;base64,eyJuYW1lIjoiQ3VzdG9tIn0=",
    });
  });

  it("customized without a data: tokenUri: falls back to the per-token metadata, no resolvedUri", () => {
    const r = {
      ...base,
      customized: true,
      tokenUri: "ipfs://not-a-data-uri",
      metadata: { name: "Custom fallback" },
      tier: { metadata: { name: "Tier meta" }, resolvedUri: "ipfs://tier-uri" },
    };
    expect(tierSourceFor(r)).toEqual({
      tierId: 1,
      metadata: { name: "Custom fallback" },
      resolvedUri: null,
    });
  });
});
