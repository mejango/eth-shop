// ponytail: fixtures stand in for 721 tiers + project metadata until chain reads are wired.
import { BASE_CURRENCY_ETH, TIER_UNLIMITED_SUPPLY } from "@bananapus/nana-sdk-core/v6";
import type { Address } from "viem";
import { formatPrice } from "./items";
import type { Item, Shop } from "./types";

const ZERO: Address = "0x0000000000000000000000000000000000000000";
const STUDIO: Address = "0x000000000000000000000000000000000005ad";

export const demoShop: Shop = {
  chainId: 8453,
  projectId: 0,
  slug: "demo",
  handle: "demo",
  name: "Everything Shop",
  tagline: "One of each thing the 721 hook can do.",
  about:
    "A demo shop. Every card here exercises a different feature: categories, discounts, reserves, votes, splits, credits, sold-out, non-transferable, and owner-only mints. Open Manage to see the other side of the counter.",
  hook: ZERO,
  store: ZERO,
  idTarget: ZERO,
  symbol: "DEMO",
  currency: "ETH",
  pricingCurrency: BASE_CURRENCY_ETH,
  decimals: 18,
  flags: { preventOverspending: false, issueTokensForSplits: false },
  ruleset: { pauseTransfers: false, pauseMintPendingReserves: false, cashOut: true },
  owner: ZERO,
  surplus: "1.24",
  // The demo never mounts BuyFlow (the only consumer of acceptedTokens), so this stays empty.
  acceptedTokens: [],
};

const wei = (eth: number) => BigInt(Math.round(eth * 1e18));

function item(opts: {
  tierId: number;
  category: number;
  categoryName: string;
  name: string;
  description: string;
  priceEth?: number;
  discount?: number; // 0-100; stored as discountPercent out of 200
  remaining?: number; // undefined = unlimited
  sold?: number;
  reserveFrequency?: number;
  reserveBeneficiary?: Address;
  votingUnits?: string;
  allowOwnerMint?: boolean;
  transfersPausable?: boolean;
  cantBeRemoved?: boolean;
  cantBuyWithCredits?: boolean;
  kind?: "digital" | "physical";
}): Item {
  const price = wei(opts.priceEth ?? 0.01);
  const discountPercent = (opts.discount ?? 0) * 2;
  const effectivePrice = (price * BigInt(200 - discountPercent)) / 200n;
  const remaining = opts.remaining;
  const sold = opts.sold ?? 0;
  return {
    shop: "demo",
    tierId: opts.tierId,
    category: opts.category,
    categoryName: opts.categoryName,
    name: opts.name,
    description: opts.description,
    image: undefined,
    price: price.toString(),
    discountPercent,
    effectivePrice: effectivePrice.toString(),
    priceText: formatPrice(effectivePrice, demoShop.decimals, demoShop.currency),
    fullPriceText: formatPrice(price, demoShop.decimals, demoShop.currency),
    remaining,
    initial: remaining === undefined ? TIER_UNLIMITED_SUPPLY : remaining + sold,
    sold,
    reserveFrequency: opts.reserveFrequency ?? 0,
    reserveBeneficiary: opts.reserveBeneficiary,
    votingUnits: opts.votingUnits ?? "0",
    allowOwnerMint: opts.allowOwnerMint ?? false,
    transfersPausable: opts.transfersPausable ?? false,
    cantBeRemoved: opts.cantBeRemoved ?? false,
    cantBuyWithCredits: opts.cantBuyWithCredits ?? false,
    kind: opts.kind ?? "digital",
  };
}

export const demoItems: Item[] = [
  item({
    tierId: 100,
    category: 1,
    categoryName: "Basics",
    name: "Plain digital item",
    description: "Unlimited supply, no rules. The simplest thing you can sell.",
  }),
  item({
    tierId: 101,
    category: 1,
    categoryName: "Basics",
    name: "Physical, 20 left",
    description: "Ships after purchase. Shipping details go through private chat.",
    kind: "physical",
    remaining: 20,
    sold: 5,
  }),
  item({
    tierId: 102,
    category: 1,
    categoryName: "Basics",
    name: "Sold out",
    description: "Supply exhausted. Card stays so people know it existed.",
    remaining: 0,
    sold: 50,
  }),
  item({
    tierId: 103,
    category: 2,
    categoryName: "Pricing",
    name: "25% off right now",
    description:
      "Discount is the ONE price knob that can change after launch. Cash-out weight still counts the full price.",
    priceEth: 0.02,
    discount: 25,
  }),
  item({
    tierId: 104,
    category: 2,
    categoryName: "Pricing",
    name: "Free (100% off)",
    description: "Discounted to zero. Still dilutes surplus at full price.",
    priceEth: 0.05,
    discount: 100,
  }),
  item({
    tierId: 105,
    category: 3,
    categoryName: "Rules",
    name: "Reserved: 1 in 5 to the studio",
    description:
      "For every 5 sold, one is set aside. Anyone can mint the pending ones to the beneficiary.",
    priceEth: 0.008,
    remaining: 40,
    sold: 12,
    reserveFrequency: 5,
    reserveBeneficiary: STUDIO,
  }),
  item({
    tierId: 106,
    category: 3,
    categoryName: "Rules",
    name: "Non-transferable ticket",
    description: "Can't be resold or sent while the shop's transfer pause is on. Show it at the door.",
    priceEth: 0.03,
    remaining: 100,
    sold: 41,
    transfersPausable: true,
  }),
  item({
    tierId: 107,
    category: 3,
    categoryName: "Rules",
    name: "Permanent item",
    description: "Can never be removed from the shop.",
    cantBeRemoved: true,
  }),
  item({
    tierId: 108,
    category: 3,
    categoryName: "Rules",
    name: "No credit purchases",
    description: "Must be paid for with fresh funds; leftover credit can't cover it.",
    priceEth: 0.015,
    cantBuyWithCredits: true,
  }),
  item({
    tierId: 109,
    category: 3,
    categoryName: "Rules",
    name: "Owner can mint free",
    description: "The shop owner (or an operator with the mint permission) can hand these out.",
    remaining: 10,
    allowOwnerMint: true,
  }),
  item({
    tierId: 110,
    category: 4,
    categoryName: "Governance",
    name: "10 votes each",
    description: "Each one carries 10 votes in the project. Holders delegate from their account.",
    priceEth: 0.05,
    votingUnits: "10",
  }),
  item({
    tierId: 111,
    category: 5,
    categoryName: "Splits",
    name: "30% to a collaborator",
    description: "30% of every sale routes to collab.eth at mint time. The rest stays in the shop.",
    priceEth: 0.04,
  }),
];

export const demoExtras: Record<
  number,
  { reservePending?: number; noCredits?: boolean; splitPercent?: number; splitTo?: string }
> = {
  105: { reservePending: 2 },
  108: { noCredits: true },
  111: { splitPercent: 30, splitTo: "collab.eth" },
};
