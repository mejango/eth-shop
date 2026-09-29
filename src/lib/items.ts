import { BASE_CURRENCY_ETH, BASE_CURRENCY_USD, effectiveTierPrice, TIER_UNLIMITED_SUPPLY, type Project721Tier, type TierMetadata } from "@bananapus/nana-sdk-core/v6";
import { formatUnits, type Address } from "viem";
import type { Currency, Item } from "./types";

export type TierMeta = TierMetadata & {
  allowOwnerMint?: boolean;
  transfersPausable?: boolean;
  cannotBeRemoved?: boolean;
  cantBuyWithCredits?: boolean;
  reserveBeneficiary?: Address;
};

// One stock line for cards, the drawer and per-chain rows: what moved and what's left.
export function availabilityText({ sold, remaining }: { sold: number; remaining: number | undefined }): string {
  if (remaining === 0) return `sold out, ${sold} sold`;
  if (remaining === undefined) return `${sold} sold, unlimited`;
  return `${sold} sold, ${remaining} left`;
}

export function formatPrice(amount: bigint, decimals: number, currency: Currency): string {
  if (amount === 0n) return "Free";
  const n = Number(formatUnits(amount, decimals));
  const text = new Intl.NumberFormat("en-US", {
    maximumSignificantDigits: 7,
    maximumFractionDigits: 20,
    minimumFractionDigits: 0,
    useGrouping: true,
  }).format(n);
  return `${text} ${currency}`;
}

/**
 * Display unit for a 721 hook's pricing currency: the ETH and USD base currencies by
 * name, and a token-keyed currency (uint32(uint160(token))) by the symbol of the
 * accepted token whose accounting context carries it.
 */
export function pricingSymbol(currency: number, tokens: readonly { currency: number; symbol: string }[] = []): Currency {
  if (currency === BASE_CURRENCY_ETH) return "ETH";
  if (currency === BASE_CURRENCY_USD) return "USD";
  return tokens.find((t) => t.currency === currency)?.symbol ?? "TOKEN";
}

export function mapItem({ shopSlug, tier, meta, currency, decimals }: {
  shopSlug: string;
  tier: Project721Tier;
  meta?: TierMeta;
  currency: Currency;
  decimals: number;
}): Item {
  const unlimited = tier.initialSupply >= TIER_UNLIMITED_SUPPLY;
  const effectivePrice = effectiveTierPrice(tier.price, tier.discountPercent);
  return {
    shop: shopSlug,
    tierId: tier.id,
    category: tier.category,
    categoryName: meta?.categoryName || `Category ${tier.category}`,
    name: meta?.name || `Item ${tier.id}`,
    description: meta?.description,
    image: meta?.image,
    price: tier.price.toString(),
    discountPercent: tier.discountPercent,
    effectivePrice: effectivePrice.toString(),
    priceText: formatPrice(effectivePrice, decimals, currency),
    fullPriceText: formatPrice(tier.price, decimals, currency),
    remaining: unlimited ? undefined : tier.remainingSupply,
    initial: tier.initialSupply,
    sold: tier.initialSupply - tier.remainingSupply,
    reserveFrequency: tier.reserveFrequency,
    reserveBeneficiary: meta?.reserveBeneficiary,
    votingUnits: tier.votingUnits.toString(),
    allowOwnerMint: !!meta?.allowOwnerMint,
    transfersPausable: !!meta?.transfersPausable,
    cantBeRemoved: !!meta?.cannotBeRemoved,
    cantBuyWithCredits: !!meta?.cantBuyWithCredits,
    // No on-chain "physical" bit; Phase 3 writes mediaType "physical" into tier metadata.
    kind: meta?.mediaType === "physical" ? "physical" : "digital",
  };
}
