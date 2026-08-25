import { describe, expect, it } from "vitest";
import type { PublicClient } from "viem";
import { readAllActiveTiers } from "@/lib/tiers";

const HOOK = "0x0000000000000000000000000000000000000001" as const;
const STORE = "0x0000000000000000000000000000000000000002" as const;

function tier(id: number) {
  return {
    id,
    price: 0n,
    remainingSupply: 1,
    initialSupply: 1,
    votingUnits: 0n,
    reserveFrequency: 0,
    reserveBeneficiary: "0x0000000000000000000000000000000000000000" as const,
    encodedIpfsUri: "0x0000000000000000000000000000000000000000000000000000000000000000" as const,
    category: 0,
    discountPercent: 0,
    flags: {
      allowOwnerMint: false,
      transfersPausable: false,
      cantBeRemoved: false,
      cantIncreaseDiscountPercent: false,
      cantBuyWithCredits: false,
    },
    splitPercent: 0,
    resolvedUri: "",
  };
}

function range(start: number, end: number) {
  const out = [];
  for (let i = start; i <= end; i++) out.push(tier(i));
  return out;
}

// Maps the requested `startingId` (the 4th tiersOf arg) to a canned page, so
// each test only has to describe what the store returns per cursor value.
function fakeClient(pages: Record<string, ReturnType<typeof tier>[]>): PublicClient {
  return {
    readContract: async ({ args }: { args: readonly [string, unknown[], boolean, bigint, bigint] }) => {
      const key = args[3].toString();
      const page = pages[key];
      if (!page) throw new Error(`unexpected startingId ${key}`);
      return page;
    },
  } as unknown as PublicClient;
}

describe("readAllActiveTiers", () => {
  it("concatenates full pages plus a short page without duplicating the cursor row", async () => {
    const page1 = range(1, 200); // startingId 0, size 200
    const page2 = [tier(200), ...range(201, 400)]; // startingId 200, size 201: cursor row + 200 fresh
    const page3 = [tier(400), ...range(401, 450)]; // startingId 400, size 201: cursor row + 50 fresh (short page)
    const client = fakeClient({ "0": page1, "200": page2, "400": page3 });

    const tiers = await readAllActiveTiers(client, STORE, HOOK);

    expect(tiers).toHaveLength(450);
    expect(tiers.map((t) => t.id)).toEqual(Array.from({ length: 450 }, (_, i) => i + 1));
  });

  it("throws when a page repeats a tier id already seen", async () => {
    const page1 = range(1, 200);
    // Cursor row (id 200) is correct, but the fresh portion repeats id 150 instead of continuing past it.
    const page2 = [tier(200), tier(150), ...range(201, 399)];
    const client = fakeClient({ "0": page1, "200": page2 });

    await expect(readAllActiveTiers(client, STORE, HOOK)).rejects.toThrow(/repeated tier 150/);
  });
});
