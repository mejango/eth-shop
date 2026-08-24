// ponytail: local draft shapes; encode to launchProjectFor + JB721TiersHook config later.
export type Kind = "digital" | "physical";

export type ItemDraft = {
  name: string;
  price: string;
  limited: boolean;
  limit: string;
  kind: Kind;
  description: string;
  media: string; // file name for now
  category: string; // "" = default shelf
  splits: { percent: string; to: string }[];
  discount: string;
  reserveEvery: string;
  reserveTo: string;
  votes: string;
  ownerMint: boolean;
  nonTransferable: boolean;
  permanent: boolean;
  credits: boolean;
  discountsEditable: boolean;
};

export type ShopDraft = {
  handle: string;
  name: string;
  tagline: string;
  about: string;
  logo: string;
  chain: "base" | "eth" | "op" | "arb";
  currency: "ETH" | "USD";
  collectionName: string;
  symbol: string;
  exactPayment: boolean;
  lockReserved: boolean;
  lockVotes: boolean;
  lockOwnerMint: boolean;
  opAddRemove: boolean;
  opMetadata: boolean;
  opMint: boolean;
  opDiscounts: boolean;
};

export const blankItem = (): ItemDraft => ({
  name: "",
  price: "",
  limited: false,
  limit: "",
  kind: "digital",
  description: "",
  media: "",
  category: "",
  splits: [],
  discount: "",
  reserveEvery: "",
  reserveTo: "",
  votes: "",
  ownerMint: false,
  nonTransferable: false,
  permanent: false,
  credits: true,
  discountsEditable: true,
});

export const blankShop = (handle = ""): ShopDraft => ({
  handle,
  name: "",
  tagline: "",
  about: "",
  logo: "",
  chain: "base",
  currency: "ETH",
  collectionName: "",
  symbol: "",
  exactPayment: false,
  lockReserved: false,
  lockVotes: false,
  lockOwnerMint: false,
  opAddRemove: true,
  opMetadata: true,
  opMint: true,
  opDiscounts: true,
});

export const CHAINS: Record<ShopDraft["chain"], string> = {
  base: "Base",
  eth: "Ethereum",
  op: "Optimism",
  arb: "Arbitrum",
};
