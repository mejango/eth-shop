import { describe, expect, it } from "vitest";
import { availabilityText, formatPrice, mapItem, pricingSymbol } from "@/lib/items";

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
  it("defaults cantBuyWithCredits to false when meta omits it", () => {
    const item = mapItem({ shopSlug: "base:41", tier, meta: { name: "Mug" }, currency: "ETH", decimals: 18 });
    expect(item.cantBuyWithCredits).toBe(false);
  });
  it("reads cantBuyWithCredits from the on-chain tier flag", () => {
    const item = mapItem({ shopSlug: "base:41", tier, meta: { name: "Mug", cantBuyWithCredits: true }, currency: "ETH", decimals: 18 });
    expect(item.cantBuyWithCredits).toBe(true);
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

describe("pricingSymbol", () => {
  // uint32(uint160(Base USDC 0x833589fC…bdA02913))
  const usdc = { currency: 0xbda02913, symbol: "USDC" };
  it("names the base currencies", () => {
    expect(pricingSymbol(1)).toBe("ETH");
    expect(pricingSymbol(2)).toBe("USD");
  });
  it("labels a token-keyed currency with the matching accepted token, 6 decimals", () => {
    const currency = pricingSymbol(usdc.currency, [{ currency: 61166, symbol: "ETH" }, usdc]);
    expect(currency).toBe("USDC");
    const item = mapItem({ shopSlug: "base:13", tier: { ...tier, price: 10_000_000n }, currency, decimals: 6 });
    expect(item.priceText).toBe("10 USDC");
  });
  it("never falls back to ETH for an unmatched token currency", () => {
    expect(pricingSymbol(2179636131, [{ currency: 61166, symbol: "ETH" }])).toBe("TOKEN");
  });
});

describe("availabilityText", () => {
  it("says what sold and what's left", () => {
    expect(availabilityText({ sold: 2, remaining: 98 })).toBe("2 sold, 98 left");
    expect(availabilityText({ sold: 7, remaining: undefined })).toBe("7 sold, unlimited");
    expect(availabilityText({ sold: 100, remaining: 0 })).toBe("sold out, 100 sold");
  });
});
