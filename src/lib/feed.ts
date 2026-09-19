import "server-only";
import type { JBChainId } from "@bananapus/nana-sdk-core";
import type { Address } from "viem";
import { bendystraw } from "./bendystraw";
import { isSupportedChain, publicClientFor, SUPPORTED_CHAIN_IDS } from "./chains";
import { currencyOf, mapItem } from "./items";
import { fetchIpfsTierMeta, mergeTierMeta, resolvedMediaUrl, type BendyTier } from "./shop";
import { publicSlugFor } from "./handles";
import type { Item } from "./types";

export type FeedItem = Item & { shopName: string; shopLogo?: string };
export type Feed = { items: FeedItem[]; next: string | null };

// Ponder caps limit at 1000. V6 has ~300 tiers today; the whole catalog is read in one
// call, ordered by sales in memory, and paged by offset from a 60s in-process cache.
// ponytail: revisit (server-side paging by tier activity) if V6 tiers approach 1000.
const CATALOG_LIMIT = 1000;
const PAGE_SIZE = 40;

const FEED_QUERY = `query Feed($limit: Int!) {
  nftTiers(where: { version: 6 }, orderBy: "createdAt", orderDirection: "desc", limit: $limit) {
    items {
      chainId tierId price initialSupply remainingSupply category votingUnits reserveFrequency reserveBeneficiary
      createdAt metadata resolvedUri encodedIpfsUri allowOwnerMint transfersPausable cannotBeRemoved
      hook { address projectId project { metadata } }
    }
  }
}`;

// The most recent 1000 mints are enough to date every tier that sold recently; a tier
// whose last sale is older than that sorts with the unsold ones, by listing date.
const SALES_QUERY = `query Sales($limit: Int!) {
  mintNftEvents(where: { version: 6 }, orderBy: "timestamp", orderDirection: "desc", limit: $limit) {
    items { chainId hook tierId timestamp }
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
  encodedIpfsUri: string | null;
  hook: { address: string; projectId: number; project: { metadata: Record<string, unknown> | null } | null } | null;
};
type FeedQuery = { nftTiers: { items: FeedRow[] } };
type SalesQuery = { mintNftEvents: { items: { chainId: number; hook: string; tierId: number; timestamp: number }[] } };

export function tierKey(r: { chainId: number; tierId: number }, hook: string): string {
  return `${r.chainId}:${hook.toLowerCase()}:${r.tierId}`;
}

/** Most recent sale timestamp per tier key, from mints ordered newest first. */
export function lastSoldAt(mints: SalesQuery["mintNftEvents"]["items"]): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of mints) {
    const key = tierKey(m, m.hook);
    if (!out.has(key)) out.set(key, m.timestamp);
  }
  return out;
}

// "Selling right now": the tier that most recently received an order leads; tiers with
// no recent sale follow, newest listing first.
export function orderFeedRows<T extends { chainId: number; tierId: number; createdAt: number; initialSupply: number; hook: { address: string } | null }>(
  rows: T[],
  sold: Map<string, number> = new Map(),
): T[] {
  const soldAt = (r: T) => (r.hook ? (sold.get(tierKey(r, r.hook.address)) ?? 0) : 0);
  return rows.filter((r) => r.initialSupply > 0).sort((a, b) => soldAt(b) - soldAt(a) || b.createdAt - a.createdAt);
}

// The home feed is content-first: a tier whose metadata pinned neither a name nor an
// image isn't feed-worthy — it still renders fine on its own shop page.
export function isFeedWorthy(meta: { name?: string; image?: string } | undefined): boolean {
  return !!meta?.name || !!meta?.image;
}

// The cursor is an offset into the in-memory ordering; validate it before it reaches
// `readFeed` so a malformed value 400s instead of surfacing as an upstream failure.
export function isValidCursor(after: string | null): boolean {
  return after === null || /^[1-9]\d{0,5}$/.test(after);
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

/** Display/link slug per distinct (chainId, projectId): the verified handle when there is one. */
export async function slugsByShop(shops: { chainId: number; projectId: number }[]): Promise<Map<string, string>> {
  const keys = [...new Set(shops.map((s) => `${s.chainId}:${s.projectId}`))];
  const entries = await Promise.all(
    keys.map(async (key) => {
      const [chainId, projectId] = key.split(":");
      return [key, await publicSlugFor(Number(chainId) as JBChainId, BigInt(projectId))] as const;
    }),
  );
  return new Map(entries);
}

async function buildFeed(): Promise<FeedItem[]> {
  const [data, sales] = await Promise.all([
    bendystraw<FeedQuery>(SUPPORTED_CHAIN_IDS[0], FEED_QUERY, { limit: CATALOG_LIMIT }),
    bendystraw<SalesQuery>(SUPPORTED_CHAIN_IDS[0], SALES_QUERY, { limit: CATALOG_LIMIT }),
  ]);
  const rows = orderFeedRows(usableFeedRows(data.nftTiers.items), lastSoldAt(sales.mintNftEvents.items));
  const pricing = await pricingByHook(distinctHooks(rows));
  const slugs = await slugsByShop(rows.map((r) => ({ chainId: r.chainId, projectId: r.hook.projectId })));
  // Bendystraw has metadata for resolver-backed tiers only (see fetchIpfsTierMeta);
  // every other shop's tiers would otherwise fail isFeedWorthy and vanish from the feed.
  const metas = await Promise.all(
    rows.map(async (r) => {
      const meta = mergeTierMeta([r]).get(r.tierId);
      if (isFeedWorthy(meta)) return meta;
      const ipfs = await fetchIpfsTierMeta(r.encodedIpfsUri);
      return ipfs ? { ...meta, ...ipfs } : meta;
    }),
  );
  return rows.flatMap((r, i) => {
    const meta = metas[i];
    if (!isFeedWorthy(meta)) return [];
    const pm = (r.hook.project?.metadata ?? {}) as { name?: string; logoUri?: string };
    const slug = slugs.get(`${r.chainId}:${r.hook.projectId}`)!;
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
}

// Same shape as readOmnichainShop's cache: one in-flight build shared, rejections evicted.
const FEED_TTL_MS = 60_000;
let cached: { at: number; feed: Promise<FeedItem[]> } | null = null;
function cachedFeed(): Promise<FeedItem[]> {
  if (cached && Date.now() - cached.at < FEED_TTL_MS) return cached.feed;
  const feed = buildFeed();
  cached = { at: Date.now(), feed };
  feed.catch(() => {
    if (cached?.feed === feed) cached = null;
  });
  return feed;
}

export function pageOf<T>(all: T[], after: string | null, size = PAGE_SIZE): { items: T[]; next: string | null } {
  const start = after ? Number(after) : 0;
  const end = start + size;
  return { items: all.slice(start, end), next: end < all.length ? String(end) : null };
}

export async function readFeed({ after = null }: { after?: string | null } = {}): Promise<Feed> {
  return pageOf(await cachedFeed(), after);
}
