import "server-only";
import { getAddress, type Address } from "viem";
import { bendystraw } from "./bendystraw";
import { isSupportedChain, SUPPORTED_CHAIN_IDS } from "./chains";
import { mergeTierMeta, type BendyTier } from "./shop";
import { slugFor } from "./slug";

// nfts() has no cursor pagination wired up here yet — a holder with more than this many
// items across every V6 shop has their tail dropped. ponytail: paginate (after/endCursor,
// same shape as feed.ts) once a real holder exceeds it.
const OWNED_LIMIT = 200;

const OWNED_QUERY = `query Owned($owner: String!, $limit: Int!) {
  nfts(where: { owner: $owner, version: 6 }, limit: $limit) {
    items {
      chainId tokenId tierId customized tokenUri metadata
      tier { metadata resolvedUri }
      hook { address projectId project { metadata } }
    }
  }
}`;

type Row = {
  chainId: number;
  tokenId: string;
  tierId: number;
  customized: boolean | null;
  tokenUri: string | null;
  metadata: unknown;
  tier: { metadata: unknown; resolvedUri: string | null } | null;
  hook: { address: string; projectId: number; project: { metadata: Record<string, unknown> | null } | null } | null;
};

export type OwnedItem = { tokenId: string; tierId: number; shop: string; shopName: string; name: string; image?: string };

// `nft.metadata`/`nft.tokenUri` are a per-token *customization override* (see
// `nft.customized`) — empty for the common case of an un-customized token. The tier's own
// metadata is the real source there: the same one readShop() reads via nftHooks.nftTiers.
function tierSourceFor(r: Row): BendyTier {
  if (r.customized) {
    return { tierId: r.tierId, metadata: r.metadata, resolvedUri: r.tokenUri?.startsWith("data:") ? r.tokenUri : null };
  }
  return { tierId: r.tierId, metadata: r.tier?.metadata ?? null, resolvedUri: r.tier?.resolvedUri ?? null };
}

export async function readOwnedItems(address: Address): Promise<OwnedItem[]> {
  // Bendystraw stores owners lowercase (verified against the live dataset).
  const owner = getAddress(address).toLowerCase();
  const data = await bendystraw<{ nfts: { items: Row[] } }>(SUPPORTED_CHAIN_IDS[0], OWNED_QUERY, {
    owner,
    limit: OWNED_LIMIT,
  });
  // A half-indexed row (chain not yet supported by this app, or hook not yet backfilled by
  // Bendystraw) shouldn't fail the whole page — drop just that item, same as
  // usableFeedRows in feed.ts.
  const rows = data.nfts.items.filter(
    (r): r is Row & { hook: NonNullable<Row["hook"]> } => isSupportedChain(r.chainId) && r.hook != null,
  );

  // mergeTierMeta's result is keyed by tierId alone, which is only unique within one shop's
  // hook — a holder's items can span many shops whose tier ids collide (both may have a
  // tierId 1). Batch per hook, not globally, so a call still covers every token in a shop
  // at once without one shop's tier metadata clobbering another's.
  const tiersByHook = new Map<string, Map<number, BendyTier>>();
  for (const r of rows) {
    const tiers = tiersByHook.get(r.hook.address) ?? new Map<number, BendyTier>();
    if (!tiers.has(r.tierId)) tiers.set(r.tierId, tierSourceFor(r));
    tiersByHook.set(r.hook.address, tiers);
  }
  const metaByHook = new Map<string, ReturnType<typeof mergeTierMeta>>();
  for (const [hook, tiers] of tiersByHook) metaByHook.set(hook, mergeTierMeta([...tiers.values()]));

  return rows.map((r) => {
    const meta = metaByHook.get(r.hook.address)?.get(r.tierId);
    const pm = (r.hook.project?.metadata ?? {}) as { name?: string };
    const shop = slugFor(r.chainId as (typeof SUPPORTED_CHAIN_IDS)[number], r.hook.projectId);
    return {
      tokenId: r.tokenId,
      tierId: r.tierId,
      shop,
      shopName: pm.name ?? shop,
      name: meta?.name ?? `Item ${r.tierId}`,
      image: meta?.image,
    };
  });
}

export function groupByShop(rows: OwnedItem[]) {
  const m = new Map<string, { shop: string; shopName: string; items: OwnedItem[] }>();
  for (const r of rows) {
    const g = m.get(r.shop) ?? { shop: r.shop, shopName: r.shopName, items: [] };
    g.items.push(r);
    m.set(r.shop, g);
  }
  return [...m.values()];
}
