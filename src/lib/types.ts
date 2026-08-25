import type { JBChainId } from "@bananapus/nana-sdk-core";
import type { Address } from "viem";

export type Currency = "ETH" | "USD";

export type Shop = {
  chainId: JBChainId;
  projectId: number;
  slug: string; // "base:41"
  handle: string | null; // ENS handle without .eth, when the owner published one
  name: string;
  tagline?: string;
  about?: string;
  logo?: string;
  hook: Address;
  store: Address;
  idTarget: Address; // METADATA_ID_TARGET, for pay/cash-out metadata
  symbol: string;
  currency: Currency; // display-only ("ETH" | "USD"); use pricingCurrency for math
  /** Raw JBPrices currency id the shop is priced in — use for any pricing math (JBPrices pair lookups). */
  pricingCurrency: number;
  decimals: number;
  flags: { preventOverspending: boolean; issueTokensForSplits: boolean };
  ruleset: { pauseTransfers: boolean; pauseMintPendingReserves: boolean; cashOut: boolean };
  owner: Address;
  surplus?: string;
  /** Tokens the project's terminal has an accounting context for, i.e. can be paid with directly. */
  acceptedTokens: { token: Address; decimals: number; currency: number; symbol: string }[];
};

export type Item = {
  shop: string; // slug
  tierId: number;
  category: number;
  categoryName: string;
  name: string;
  description?: string;
  image?: string;
  price: string; // raw units as decimal string (bigint-safe across RSC boundary)
  discountPercent: number; // out of 200
  effectivePrice: string;
  priceText: string; // "0.004 ETH", "Free"
  fullPriceText: string;
  remaining: number | undefined; // undefined = unlimited
  initial: number;
  sold: number;
  reserveFrequency: number;
  reserveBeneficiary?: Address;
  votingUnits: string;
  allowOwnerMint: boolean;
  transfersPausable: boolean;
  cantBeRemoved: boolean;
  cantBuyWithCredits: boolean;
  kind: "digital" | "physical";
};
