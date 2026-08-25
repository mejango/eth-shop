import { describe, expect, it } from "vitest";
import {
  amountDue,
  cartTotal,
  creditsApplicable,
  minReturnedTokens,
  roundUp,
  tierIdsToMint,
  toPaymentUnits,
  type CartLine,
} from "@/lib/pay";

describe("pay", () => {
  describe("cartTotal", () => {
    it("sums effectivePrice * qty for all lines", () => {
      const lines: CartLine[] = [
        { tierId: 1, qty: 2, effectivePrice: 100n, cantBuyWithCredits: false },
        { tierId: 3, qty: 1, effectivePrice: 50n, cantBuyWithCredits: false },
      ];
      expect(cartTotal(lines)).toBe(250n);
    });

    it("returns 0 for empty cart", () => {
      expect(cartTotal([])).toBe(0n);
    });
  });

  describe("creditsApplicable", () => {
    it("caps at credits and excludes cantBuyWithCredits lines", () => {
      const lines: CartLine[] = [
        { tierId: 1, qty: 2, effectivePrice: 100n, cantBuyWithCredits: false },
        { tierId: 2, qty: 1, effectivePrice: 500n, cantBuyWithCredits: true },
      ];
      expect(creditsApplicable(lines, 150n)).toBe(150n);
    });

    it("returns min of credits and sum when sum is less", () => {
      const lines: CartLine[] = [
        { tierId: 1, qty: 1, effectivePrice: 50n, cantBuyWithCredits: false },
      ];
      expect(creditsApplicable(lines, 100n)).toBe(50n);
    });

    it("excludes cantBuyWithCredits lines completely", () => {
      const lines: CartLine[] = [
        { tierId: 1, qty: 1, effectivePrice: 100n, cantBuyWithCredits: true },
        { tierId: 2, qty: 1, effectivePrice: 50n, cantBuyWithCredits: false },
      ];
      expect(creditsApplicable(lines, 200n)).toBe(50n);
    });

    it("returns 0 for 0 credits", () => {
      const lines: CartLine[] = [
        { tierId: 1, qty: 1, effectivePrice: 100n, cantBuyWithCredits: false },
      ];
      expect(creditsApplicable(lines, 0n)).toBe(0n);
    });
  });

  describe("amountDue", () => {
    it("returns cartTotal - creditsApplicable", () => {
      const lines: CartLine[] = [
        { tierId: 1, qty: 1, effectivePrice: 100n, cantBuyWithCredits: false },
      ];
      expect(amountDue(lines, 50n)).toBe(50n);
    });

    it("is never negative", () => {
      const lines: CartLine[] = [
        { tierId: 1, qty: 1, effectivePrice: 50n, cantBuyWithCredits: false },
      ];
      expect(amountDue(lines, 100n)).toBe(0n);
    });

    it("returns full amount when credits zero", () => {
      const lines: CartLine[] = [
        { tierId: 1, qty: 1, effectivePrice: 100n, cantBuyWithCredits: false },
      ];
      expect(amountDue(lines, 0n)).toBe(100n);
    });
  });

  describe("tierIdsToMint", () => {
    it("repeats tierId qty times, ascending", () => {
      const lines: CartLine[] = [
        { tierId: 1, qty: 2, effectivePrice: 100n, cantBuyWithCredits: false },
        { tierId: 3, qty: 1, effectivePrice: 50n, cantBuyWithCredits: false },
      ];
      expect(tierIdsToMint(lines)).toEqual([1n, 1n, 3n]);
    });

    it("returns empty array for empty cart", () => {
      expect(tierIdsToMint([])).toEqual([]);
    });

    it("handles single tier", () => {
      const lines: CartLine[] = [
        { tierId: 5, qty: 3, effectivePrice: 100n, cantBuyWithCredits: false },
      ];
      expect(tierIdsToMint(lines)).toEqual([5n, 5n, 5n]);
    });
  });

  describe("toPaymentUnits", () => {
    it("ceil-divides pricingUnits * pricePerUnit / 10^pricingDecimals", () => {
      // toPaymentUnits(25n*10n**18n, 400_000_000n, 18)
      // = ceil((25 * 10^18) * 400_000_000 / 10^18)
      // = ceil(25 * 400_000_000)
      // = 10_000_000_000n
      const result = toPaymentUnits(25n * 10n ** 18n, 400_000_000n, 18);
      expect(result).toBe(10_000_000_000n);
    });

    it("rounds up correctly", () => {
      // toPaymentUnits(3n, 10n, 1)
      // = ceil((3 * 10) / 10)
      // = ceil(3) = 3n
      expect(toPaymentUnits(3n, 10n, 1)).toBe(3n);
    });

    it("rounds up when remainder exists", () => {
      // toPaymentUnits(1n, 3n, 1)
      // = ceil(3 / 10) = ceil(0.3) = 1n
      expect(toPaymentUnits(1n, 3n, 1)).toBe(1n);
    });

    it("returns 0 when pricingUnits is 0", () => {
      expect(toPaymentUnits(0n, 400_000_000n, 18)).toBe(0n);
    });
  });

  describe("minReturnedTokens", () => {
    it("applies slippage formula: previewTokens*(10000−bps)/10000", () => {
      expect(minReturnedTokens(1000n, 100n)).toBe(990n);
    });

    it("returns 0 only when previewTokens is 0", () => {
      expect(minReturnedTokens(0n, 100n)).toBe(0n);
    });

    it("handles 0 slippage", () => {
      expect(minReturnedTokens(1000n, 0n)).toBe(1000n);
    });

    it("handles maximum slippage", () => {
      expect(minReturnedTokens(1000n, 10000n)).toBe(1n);
    });
  });

  describe("roundUp", () => {
    it("rounds up to next multiple of 10^(decimals−2)", () => {
      expect(roundUp(1_234_000_000_000_000_000n, 18)).toBe(1_240_000_000_000_000_000n);
    });

    it("handles amounts already at a multiple", () => {
      // 1_200_000_000_000_000_000 is a multiple of 10^16
      expect(roundUp(1_200_000_000_000_000_000n, 18)).toBe(1_200_000_000_000_000_000n);
    });

    it("rounds up small amounts with small decimals", () => {
      // 5 with decimals 3 means round to 10^1 = 10 increment
      expect(roundUp(5n, 3)).toBe(10n);
    });

    it("returns 0 unchanged", () => {
      expect(roundUp(0n, 18)).toBe(0n);
    });
  });
});
