import "server-only";
import { jb721TiersHookStoreAbi } from "@bananapus/nana-sdk-core";
import type { Address, PublicClient } from "viem";

/**
 * Reading a 721 shop's tiers COMPLETELY, without the on-chain `resolvedUri`.
 *
 * `tiersOf`'s `size` is a hard cap, not a page hint, so a single call silently
 * truncates a large shop. Requesting `includeResolvedUri: true` over a tier
 * set whose metadata is large inline data URIs (e.g. Banny's 68 inline-SVG
 * tiers) makes the upstream RPC provider reject the call outright — this
 * project never needs the on-chain resolved URI anyway, since media is
 * sourced from Bendystraw (see mergeTierMeta in shop.ts).
 */

const TIER_PAGE_SIZE = 200;

export type RawTier = Awaited<ReturnType<typeof readTierPage>>[number];

/** One page of active tiers. `startingId` is inclusive, so every page after the first repeats
 *  its cursor row — hence the +1 size and the slice in readAllActiveTiers. */
export async function readTierPage(client: PublicClient, store: Address, hook: Address, startingId: bigint) {
  return client.readContract({
    address: store,
    abi: jb721TiersHookStoreAbi,
    functionName: "tiersOf",
    args: [hook, [], false, startingId, BigInt(startingId === 0n ? TIER_PAGE_SIZE : TIER_PAGE_SIZE + 1)],
  });
}

export async function readAllActiveTiers(client: PublicClient, store: Address, hook: Address): Promise<RawTier[]> {
  const tiers: RawTier[] = [];
  const seen = new Set<number>();
  let startingId = 0n;

  for (;;) {
    const page = await readTierPage(client, store, hook, startingId);
    if (page.length === 0) break;
    if (startingId !== 0n && BigInt(page[0].id) !== startingId) {
      throw new Error("The shop changed while its inventory was being read.");
    }
    const fresh = startingId === 0n ? page : page.slice(1);
    for (const tier of fresh) {
      if (seen.has(tier.id)) {
        throw new Error(`The shop repeated tier ${tier.id} while loading.`);
      }
      seen.add(tier.id);
      tiers.push(tier);
    }
    if (fresh.length < TIER_PAGE_SIZE) break;
    const next = BigInt(fresh[fresh.length - 1].id);
    if (next === startingId) {
      throw new Error("The shop returned a cyclic inventory cursor.");
    }
    startingId = next;
  }
  return tiers;
}
