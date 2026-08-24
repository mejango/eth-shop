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
};
export type Shop = {
  handle: string;
  name: string;
  tagline: string;
  about: string;
  hue: number;
  chain: string;
  projectId: number;
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

export const shopBy = (handle: string) => shops.find((s) => s.handle === handle);
export const itemsOf = (handle: string) => items.filter((i) => i.shop === handle);
export const categoriesOf = (handle: string) => [
  ...new Set(itemsOf(handle).map((i) => i.category)),
];
