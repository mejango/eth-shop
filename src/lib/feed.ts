import "server-only";
import { bendystraw } from "./bendystraw";
import { isSupportedChain, SUPPORTED_CHAIN_IDS } from "./chains";
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

// A half-indexed row (chain not yet supported by this app, or hook not yet
// backfilled by Bendystraw) shouldn't fail the whole feed — drop just that card.
export function usableFeedRows<T extends { chainId: number; hook: unknown }>(
  rows: T[],
): (T & { hook: NonNullable<T["hook"]> })[] {
  return rows.filter(
    (r): r is T & { hook: NonNullable<T["hook"]> } => isSupportedChain(r.chainId) && r.hook != null,
  );
}

// ponytail: nftTier carries no pricing currency/decimals, so the feed labels every price as 18-dec ETH
// and the shop page corrects it from chain. Fix at the source once Bendystraw indexes hook pricing.
export async function readFeed({ limit = 40, after = null }: { limit?: number; after?: string | null } = {}): Promise<Feed> {
  const data = await bendystraw<FeedQuery>(SUPPORTED_CHAIN_IDS[0], FEED_QUERY, { limit, after });
  const rows = usableFeedRows(orderFeedRows(data.nftTiers.items));
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
    return [{ ...mapItem({ shopSlug: slug, tier, meta, currency: currencyOf({ currency: 1 }), decimals: 18 }), shopName: pm.name ?? slug, shopLogo: resolvedMediaUrl(pm.logoUri) }];
  });
  return { items, next: data.nftTiers.pageInfo.hasNextPage ? data.nftTiers.pageInfo.endCursor : null };
}
