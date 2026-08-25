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

/**
 * On-chain resolved URIs for a FEW tiers only. The bulk read above skips
 * resolver output (oversized responses); this fills media gaps for tiers
 * Bendystraw has nothing for, one small per-tier call each, capped.
 */
export const RESOLVED_TIER_FETCH_CAP = 30;

export async function readResolvedTierUris(
  client: PublicClient,
  store: Address,
  hook: Address,
  tierIds: number[],
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const ids = tierIds.slice(0, RESOLVED_TIER_FETCH_CAP);
  const results = await Promise.allSettled(
    ids.map((id) =>
      client.readContract({
        address: store,
        abi: jb721TiersHookStoreAbi,
        functionName: "tierOf",
        args: [hook, BigInt(id), true],
      }),
    ),
  );
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.resolvedUri) out.set(ids[i], r.value.resolvedUri);
  });
  return out;
}
