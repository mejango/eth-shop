export type CartLine = {
  tierId: number;
  qty: number;
  effectivePrice: bigint;
  cantBuyWithCredits: boolean;
};

/**
 * Sum of effectivePrice * qty across all lines.
 */
export function cartTotal(lines: CartLine[]): bigint {
  return lines.reduce((sum, line) => sum + line.effectivePrice * BigInt(line.qty), 0n);
}

/**
 * Minimum of credits and the sum of effectivePrice * qty for lines where cantBuyWithCredits is false.
 */
export function creditsApplicable(lines: CartLine[], credits: bigint): bigint {
  const creatableWithCredits = lines
    .filter((line) => !line.cantBuyWithCredits)
    .reduce((sum, line) => sum + line.effectivePrice * BigInt(line.qty), 0n);
  return credits < creatableWithCredits ? credits : creatableWithCredits;
}

/**
 * cartTotal - creditsApplicable, never negative.
 */
export function amountDue(lines: CartLine[], credits: bigint): bigint {
  const total = cartTotal(lines);
  const applicable = creditsApplicable(lines, credits);
  return total > applicable ? total - applicable : 0n;
}

/**
 * Array of tierId repeated qty times, sorted in ascending order.
 */
export function tierIdsToMint(lines: CartLine[]): bigint[] {
  const ids: bigint[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.qty; i++) {
      ids.push(BigInt(line.tierId));
    }
  }
  return ids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Payment-token units for pricingUnits priced in the shop's currency.
 * Computes ceil(pricingUnits * pricePerUnit / 10^pricingDecimals).
 */
export function toPaymentUnits(pricingUnits: bigint, pricePerUnit: bigint, pricingDecimals: number): bigint {
  if (pricingUnits === 0n) return 0n;
  const divisor = 10n ** BigInt(pricingDecimals);
  const product = pricingUnits * pricePerUnit;
  // Ceiling division: (product + divisor - 1) / divisor
  return (product + divisor - 1n) / divisor;
}

/**
 * Minimum returned tokens after slippage.
 * Computes previewTokens * (10000 - slippageBps) / 10000.
 * Returns 0 only when previewTokens is 0; floors at 1n for nonzero preview.
 */
export function minReturnedTokens(previewTokens: bigint, slippageBps: bigint): bigint {
  if (previewTokens === 0n) return 0n;
  const result = (previewTokens * (10000n - slippageBps)) / 10000n;
  return result > 0n ? result : 1n;
}

/**
 * Round up to the next multiple of 10^(decimals - 2).
 * For example, with decimals=18, rounds up to the nearest 10^16.
 */
export function roundUp(amount: bigint, decimals: number): bigint {
  const roundingUnit = 10n ** BigInt(decimals - 2);
  const remainder = amount % roundingUnit;
  if (remainder === 0n) return amount;
  return amount + (roundingUnit - remainder);
}
