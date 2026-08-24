// ponytail: fixtures stand in for 721 tiers + project metadata until chain reads are wired.
export type Kind = "digital" | "physical";
export type Item = {
  id: number;
  shop: string;
  category: string;
  name: string;
  price: string; // ETH
  kind: Kind;
  left?: number; // remaining supply; undefined = unlimited
  hue: number;
  blurb?: string;
  // 721 tier surface beyond the basics; all optional, default = off.
  discount?: number; // % off, 0-100 (encodes ×2, denominator 200)
  reserveEvery?: number; // 1 of every N sold is reserved
  reservePending?: number; // reserved NFTs not yet minted
  reserveTo?: string;
  votes?: number;
  nonTransferable?: boolean;
  permanent?: boolean;
  noCredits?: boolean; // cantBuyWithCredits
  ownerMint?: boolean;
  splitPercent?: number;
  splitTo?: string;
  sold?: number;
  removed?: boolean;
};
export type Shop = {
  handle: string;
  name: string;
  tagline: string;
  about: string;
  hue: number;
  chain: string;
  projectId: number;
  // hook + ruleset level
  currency?: "ETH" | "USD";
  symbol?: string;
  cashOut?: boolean; // items can cash out for surplus
  transfersPaused?: boolean;
  reservesPaused?: boolean;
  issueTokensForSplits?: boolean;
  preventOverspending?: boolean;
  surplus?: string; // ETH held by the project
  operators?: { address: string; can: string[] }[];
};

export const shops: Shop[] = [
  {
    handle: "tea",
    name: "Small Hours Tea",
    tagline: "Three teas. That's the whole shop.",
    about:
      "Roasted in a garage in Oakland. Ships in a paper pouch, or grab the tasting notes as a PDF.",
    hue: 92,
    chain: "base",
    projectId: 41,
  },
  {
    handle: "press",
    name: "Left Margin Press",
    tagline: "Zines, prints, type, and the odd t-shirt.",
    about:
      "A risograph studio that sells what it prints. Editions are numbered on-chain because the printer only counts to 300.",
    hue: 340,
    chain: "eth",
    projectId: 12,
  },
  {
    handle: "loops",
    name: "Loops by Ada",
    tagline: "Sample packs and stems.",
    about: "Every pack is an NFT you can resell. Buyers get the download link in their receipt.",
    hue: 210,
    chain: "op",
    projectId: 7,
  },
  {
    handle: "demo",
    name: "Everything Shop",
    tagline: "One of each thing the 721 hook can do.",
    about:
      "A demo shop. Every card here exercises a different feature: categories, discounts, reserves, votes, splits, credits, sold-out, non-transferable, and owner-only mints. Open Manage to see the other side of the counter.",
    hue: 250,
    chain: "base",
    projectId: 999,
    symbol: "DEMO",
    cashOut: true,
    surplus: "1.24",
    operators: [{ address: "ada.eth", can: ["Add & remove items", "Update item details"] }],
  },
  {
    handle: "salt",
    name: "Salt Ceramics",
    tagline: "Mugs, one kiln at a time.",
    about: "Each firing is a category. When it's gone, it's gone.",
    hue: 28,
    chain: "base",
    projectId: 88,
  },
];

const mk = (
  shop: string,
  category: string,
  rows: [string, string, Kind, number?, string?][],
  hue: number,
  start: number,
): Item[] =>
  rows.map(([name, price, kind, left, blurb], i) => ({
    id: start + i,
    shop,
    category,
    name,
    price,
    kind,
    left,
    hue: (hue + i * 17) % 360,
    blurb,
  }));

export const items: Item[] = [
  ...mk(
    "tea",
    "Teas",
    [
      [
        "Hojicha, 50g",
        "0.004",
        "physical",
        40,
        "Roasted green tea. Toasty, low caffeine, good at 11pm.",
      ],
      ["Jin Xuan oolong, 50g", "0.006", "physical", 12, "Milky, floral. Three steeps minimum."],
      [
        "Tasting notes (PDF)",
        "0.0005",
        "digital",
        undefined,
        "Nine pages on how we brew each tea. Yours forever.",
      ],
    ],
    92,
    1,
  ),
  ...mk(
    "press",
    "Zines",
    [
      ["Margin Notes #1", "0.002", "physical", 120],
      ["Margin Notes #2", "0.002", "physical", 96],
      ["Margin Notes #3", "0.002", "physical", 300],
      ["Margin Notes #1–3 (PDF bundle)", "0.001", "digital"],
      ["Riso Mistakes, vol. 1", "0.003", "physical", 44],
      ["Riso Mistakes, vol. 2", "0.003", "physical", 61],
    ],
    340,
    10,
  ),
  ...mk(
    "press",
    "Prints",
    [
      ["Two-colour cityscape, A3", "0.012", "physical", 30],
      ["Fluorescent pink grid, A2", "0.02", "physical", 15],
      ["Bridge study, A4", "0.008", "physical", 50],
      ["Bridge study (print-at-home)", "0.002", "digital"],
      ["Test sheet, one of one", "0.05", "physical", 1],
      ["Blue ladder, A3", "0.012", "physical", 22],
      ["Sunday paper, A2", "0.02", "physical", 9],
    ],
    300,
    20,
  ),
  ...mk(
    "press",
    "Type",
    [
      ["Margin Grotesk (desktop)", "0.015", "digital"],
      ["Margin Grotesk (web)", "0.015", "digital"],
      ["Margin Mono", "0.01", "digital"],
      ["Full family licence", "0.03", "digital"],
      ["Specimen booklet", "0.004", "physical", 200],
    ],
    260,
    30,
  ),
  ...mk(
    "press",
    "Shirts",
    [
      ["Margin tee, S", "0.01", "physical", 8],
      ["Margin tee, M", "0.01", "physical", 14],
      ["Margin tee, L", "0.01", "physical", 11],
      ["Margin tee, XL", "0.01", "physical", 5],
      ["Tote, natural", "0.006", "physical", 40],
    ],
    20,
    40,
  ),
  ...mk(
    "press",
    "Workshops",
    [
      [
        "Riso 101, Saturday",
        "0.03",
        "digital",
        6,
        "Two hours in the studio. Ticket is the NFT; show it at the door.",
      ],
      ["Riso 101, recording", "0.005", "digital"],
      ["Studio day pass", "0.02", "digital", 3],
    ],
    180,
    50,
  ),
  ...mk(
    "loops",
    "Packs",
    [
      ["Night Bus, 40 loops", "0.008", "digital"],
      ["Dry Kit, drums", "0.005", "digital"],
      ["Room Tone, textures", "0.004", "digital"],
      ["Everything so far", "0.02", "digital"],
    ],
    210,
    60,
  ),
  ...mk(
    "salt",
    "Kiln 14",
    [
      ["Speckled mug", "0.009", "physical", 6],
      ["Tall mug", "0.011", "physical", 2],
      ["Plate, 24cm", "0.014", "physical", 4],
      ["Seconds mug", "0.005", "physical", 9],
    ],
    28,
    70,
  ),
];

const demo = (rows: Partial<Item>[]): Item[] =>
  rows.map(
    (r, i) =>
      ({
        id: 100 + i,
        shop: "demo",
        category: "Basics",
        name: "",
        price: "0.01",
        kind: "digital",
        hue: (250 + i * 23) % 360,
        ...r,
      }) as Item,
  );

items.push(
  ...demo([
    {
      name: "Plain digital item",
      blurb: "Unlimited supply, no rules. The simplest thing you can sell.",
    },
    {
      name: "Physical, 20 left",
      kind: "physical",
      left: 20,
      sold: 5,
      blurb: "Ships after purchase. Shipping details go through private chat.",
    },
    {
      name: "Sold out",
      left: 0,
      sold: 50,
      blurb: "Supply exhausted. Card stays so people know it existed.",
    },
    {
      name: "25% off right now",
      price: "0.02",
      discount: 25,
      category: "Pricing",
      blurb:
        "Discount is the ONE price knob that can change after launch. Cash-out weight still counts the full price.",
    },
    {
      name: "Free (100% off)",
      price: "0.05",
      discount: 100,
      category: "Pricing",
      blurb: "Discounted to zero. Still dilutes surplus at full price.",
    },
    {
      name: "Reserved: 1 in 5 to the studio",
      price: "0.008",
      left: 40,
      sold: 12,
      reserveEvery: 5,
      reservePending: 2,
      reserveTo: "studio.eth",
      category: "Rules",
      blurb:
        "For every 5 sold, one is set aside. Anyone can mint the pending ones to the beneficiary.",
    },
    {
      name: "Non-transferable ticket",
      price: "0.03",
      left: 100,
      sold: 41,
      nonTransferable: true,
      category: "Rules",
      blurb: "Can't be resold or sent while the shop's transfer pause is on. Show it at the door.",
    },
    {
      name: "Permanent item",
      permanent: true,
      category: "Rules",
      blurb: "Can never be removed from the shop.",
    },
    {
      name: "No credit purchases",
      price: "0.015",
      noCredits: true,
      category: "Rules",
      blurb: "Must be paid for with fresh funds; leftover credit can't cover it.",
    },
    {
      name: "Owner can mint free",
      left: 10,
      ownerMint: true,
      category: "Rules",
      blurb: "The shop owner (or an operator with the mint permission) can hand these out.",
    },
    {
      name: "10 votes each",
      price: "0.05",
      votes: 10,
      category: "Governance",
      blurb: "Each one carries 10 votes in the project. Holders delegate from their account.",
    },
    {
      name: "30% to a collaborator",
      price: "0.04",
      splitPercent: 30,
      splitTo: "collab.eth",
      category: "Splits",
      blurb: "30% of every sale routes to collab.eth at mint time. The rest stays in the shop.",
    },
  ]),
);

export const shopBy = (handle: string) => shops.find((s) => s.handle === handle);
export const itemsOf = (handle: string) => items.filter((i) => i.shop === handle);
export const categoriesOf = (handle: string) => [
  ...new Set(itemsOf(handle).map((i) => i.category)),
];
