import { BASE_CURRENCY_USD, effectiveTierPrice, TIER_UNLIMITED_SUPPLY, type Project721Tier, type TierMetadata } from "@bananapus/nana-sdk-core/v6";
import { formatUnits, type Address } from "viem";
import type { Currency, Item } from "./types";

// From nana-core-v6 src/libraries/JBCurrencyIds.sol (ETH = 1, USD = 2)
// SDK exports BASE_CURRENCY_USD as 2 for v6
const USD_CURRENCY_ID = BASE_CURRENCY_USD;

export type TierMeta = TierMetadata & {
  allowOwnerMint?: boolean;
  transfersPausable?: boolean;
  cannotBeRemoved?: boolean;
  reserveBeneficiary?: Address;
};

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

export function currencyOf(pricing: { currency: number }): Currency {
  return pricing.currency === USD_CURRENCY_ID ? "USD" : "ETH";
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
    // No on-chain "physical" bit; Phase 3 writes mediaType "physical" into tier metadata.
    kind: meta?.mediaType === "physical" ? "physical" : "digital",
  };
}
