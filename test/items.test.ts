import { describe, expect, it } from "vitest";
import { formatPrice, mapItem } from "@/lib/items";

const tier = { id: 7, price: 4_000_000_000_000_000n, remainingSupply: 40, initialSupply: 50, votingUnits: 0n, reserveFrequency: 0, category: 2, discountPercent: 0, encodedIpfsUri: "0x" as const, resolvedUri: "" };

describe("mapItem", () => {
  it("maps a plain tier", () => {
    const item = mapItem({ shopSlug: "base:41", tier, meta: { name: "Hojicha", image: "https://x/y.png" }, currency: "ETH", decimals: 18 });
    expect(item).toMatchObject({ tierId: 7, name: "Hojicha", remaining: 40, sold: 10, priceText: "0.004 ETH", categoryName: "Category 2", kind: "digital", price: "4000000000000000" });
  });
  it("applies discount out of 200 and keeps the full price text", () => {
    const item = mapItem({ shopSlug: "base:41", tier: { ...tier, discountPercent: 50 }, currency: "ETH", decimals: 18 });
    expect(item.effectivePrice).toBe("3000000000000000");
    expect(item.priceText).toBe("0.003 ETH");
    expect(item.fullPriceText).toBe("0.004 ETH");
  });
  it("treats 999999999 initial supply as unlimited", () => {
    const item = mapItem({ shopSlug: "base:41", tier: { ...tier, initialSupply: 999_999_999, remainingSupply: 999_999_990 }, currency: "ETH", decimals: 18 });
    expect(item.remaining).toBeUndefined();
    expect(item.sold).toBe(9);
  });
  it("names unnamed tiers and falls back on category name", () => {
    const item = mapItem({ shopSlug: "base:41", tier, meta: { categoryName: "Teas" }, currency: "ETH", decimals: 18 });
    expect(item.name).toBe("Item 7");
    expect(item.categoryName).toBe("Teas");
  });
  it("marks physical from metadata and reads flags", () => {
    const item = mapItem({ shopSlug: "base:41", tier, meta: { name: "Mug", mediaType: "physical", allowOwnerMint: true }, currency: "ETH", decimals: 18 });
    expect(item.kind).toBe("physical");
    expect(item.allowOwnerMint).toBe(true);
  });
});

describe("formatPrice", () => {
  it("formats", () => {
    expect(formatPrice(0n, 18, "ETH")).toBe("Free");
    expect(formatPrice(25_000_000n, 6, "USD")).toBe("25 USD");
    expect(formatPrice(1_234_500_000_000_000_000n, 18, "ETH")).toBe("1.2345 ETH");
  });
  it("formats very small amounts without scientific notation", () => {
    expect(formatPrice(100_000_000n, 18, "ETH")).toBe("0.0000000001 ETH");
    expect(formatPrice(1n, 18, "ETH")).toBe("0.000000000000000001 ETH");
  });
  it("formats large amounts with grouping", () => {
    expect(formatPrice(1_234_567_000_000_000_000_000n, 18, "ETH")).toBe("1,234.567 ETH");
  });
});
