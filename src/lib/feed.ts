import "server-only";
import type { JBChainId } from "@bananapus/nana-sdk-core";
import type { Address } from "viem";
import { bendystraw } from "./bendystraw";
import { isSupportedChain, publicClientFor, SUPPORTED_CHAIN_IDS } from "./chains";
import { currencyOf, mapItem } from "./items";
import { mergeTierMeta, resolvedMediaUrl, type BendyTier } from "./shop";
import { slugFor } from "./slug";
import type { Item } from "./types";

export type FeedItem = Item & { shopName: string; shopLogo?: string };
export type Feed = { items: FeedItem[]; next: string | null };

const FEED_QUERY = `query Feed($limit: Int!, $after: String) {
  nftTiers(where: { version: 6 }, orderBy: "createdAt", orderDirection: "desc", limit: $limit, after: $after) {
    items {
      chainId tierId price initialSupply remainingSupply category votingUnits reserveFrequency reserveBeneficiary
      createdAt metadata resolvedUri allowOwnerMint transfersPausable cannotBeRemoved
      hook { address projectId project { metadata } }
    }
    pageInfo { endCursor hasNextPage }
  }
}`;

type FeedRow = BendyTier & {
  chainId: number;
  price: string;
  initialSupply: number;
  remainingSupply: number;
  category: number;
  votingUnits: string | null;
  reserveFrequency: number | null;
  createdAt: number;
  hook: { address: string; projectId: number; project: { metadata: Record<string, unknown> | null } | null } | null;
};
type FeedQuery = { nftTiers: { items: FeedRow[]; pageInfo: { endCursor: string | null; hasNextPage: boolean } } };

export function orderFeedRows<T extends { createdAt: number; initialSupply: number }>(rows: T[]): T[] {
  return rows.filter((r) => r.initialSupply > 0).sort((a, b) => b.createdAt - a.createdAt);
}

// The home feed is content-first: a tier whose metadata pinned neither a name nor an
// image isn't feed-worthy — it still renders fine on its own shop page.
export function isFeedWorthy(meta: { name?: string; image?: string } | undefined): boolean {
  return !!meta?.name || !!meta?.image;
}

const CURSOR_MAX_LEN = 512;
const CURSOR_CONTROL_CHARS = /[\x00-\x1f\x7f]/;

// A cursor comes straight off the query string into a Bendystraw request; validate it
// before it ever reaches `readFeed` so a malformed value 400s instead of surfacing as a
// confusing upstream failure.
export function isValidCursor(after: string | null): boolean {
  if (after === null) return true;
  if (after.length === 0 || after.length > CURSOR_MAX_LEN) return false;
  return !CURSOR_CONTROL_CHARS.test(after);
}

// A half-indexed row (chain not yet supported by this app, or hook not yet
// backfilled by Bendystraw) shouldn't fail the whole feed — drop just that card.
export function usableFeedRows<T extends { chainId: number; hook: unknown }>(
  rows: T[],
): (T & { hook: NonNullable<T["hook"]> })[] {
  return rows.filter(
    (r): r is T & { hook: NonNullable<T["hook"]> } => isSupportedChain(r.chainId) && r.hook != null,
  );
}

/** The distinct (chainId, hook address) pairs across a set of feed rows, in first-seen order. */
export function distinctHooks<T extends { chainId: number; hook: { address: string } }>(
  rows: T[],
): { chainId: number; address: string }[] {
  const seen = new Set<string>();
  const out: { chainId: number; address: string }[] = [];
  for (const r of rows) {
    const key = `${r.chainId}:${r.hook.address.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ chainId: r.chainId, address: r.hook.address });
  }
  return out;
}

// JB721TiersHook.pricingContext() (nana-721-hook-v6 src/JB721TiersHook.sol): not part of the
// SDK's public export surface (see the same note on storeFlagsAbi in shop.ts), so it's
// hand-rolled here too.
const pricingContextAbi = [
  {
    type: "function",
    name: "pricingContext",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { type: "uint256", name: "currency" },
      { type: "uint256", name: "decimals" },
    ],
  },
] as const;

const DEFAULT_PRICING = { currency: 1, decimals: 18 };

// nftTier carries no pricing currency/decimals, so the feed reads each distinct hook's
// pricingContext() directly rather than assuming 18-dec ETH. A failed read for one hook
// falls back to that default rather than failing the whole feed.
async function pricingByHook(
  hooks: { chainId: number; address: string }[],
): Promise<Map<string, { currency: number; decimals: number }>> {
  const entries = await Promise.all(
    hooks.map(async ({ chainId, address }) => {
      const key = `${chainId}:${address.toLowerCase()}`;
      try {
        const [currency, decimals] = await publicClientFor(chainId as JBChainId).readContract({
          address: address as Address,
          abi: pricingContextAbi,
          functionName: "pricingContext",
        });
        return [key, { currency: Number(currency), decimals: Number(decimals) }] as const;
      } catch (error) {
        console.warn("pricingContext read failed", chainId, address, error instanceof Error ? error.message : String(error));
        return [key, DEFAULT_PRICING] as const;
      }
    }),
  );
  return new Map(entries);
}

export async function readFeed({ limit = 40, after = null }: { limit?: number; after?: string | null } = {}): Promise<Feed> {
  const data = await bendystraw<FeedQuery>(SUPPORTED_CHAIN_IDS[0], FEED_QUERY, { limit, after });
  const rows = usableFeedRows(orderFeedRows(data.nftTiers.items));
  const pricing = await pricingByHook(distinctHooks(rows));
  const items = rows.flatMap((r) => {
    const meta = mergeTierMeta([r]).get(r.tierId);
    if (!isFeedWorthy(meta)) return [];
    const pm = (r.hook.project?.metadata ?? {}) as { name?: string; logoUri?: string };
    const slug = slugFor(r.chainId as (typeof SUPPORTED_CHAIN_IDS)[number], r.hook.projectId);
    const tier = {
      id: r.tierId,
      price: BigInt(r.price),
      remainingSupply: r.remainingSupply,
      initialSupply: r.initialSupply,
      votingUnits: BigInt(r.votingUnits ?? 0),
      reserveFrequency: r.reserveFrequency ?? 0,
      category: r.category,
      discountPercent: 0,
      encodedIpfsUri: "0x" as const,
      resolvedUri: r.resolvedUri ?? "",
    };
    const p = pricing.get(`${r.chainId}:${r.hook.address.toLowerCase()}`) ?? DEFAULT_PRICING;
    return [{ ...mapItem({ shopSlug: slug, tier, meta, currency: currencyOf(p), decimals: p.decimals }), shopName: pm.name ?? slug, shopLogo: resolvedMediaUrl(pm.logoUri) }];
  });
  return { items, next: data.nftTiers.pageInfo.hasNextPage ? data.nftTiers.pageInfo.endCursor : null };
}
