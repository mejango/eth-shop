import "server-only";
import { getAddress, type Address } from "viem";
import { bendystraw } from "./bendystraw";
import { isSupportedChain, SUPPORTED_CHAIN_IDS } from "./chains";
import { mergeTierMeta } from "./shop";
import { slugFor } from "./slug";

const OWNED_QUERY = `query Owned($owner: String!) {
  nfts(where: { owner: $owner, version: 6 }, limit: 200) {
    items { chainId tokenId tierId tokenUri metadata hook { address projectId project { metadata } } }
  }
}`;

type Row = {
  chainId: number;
  tokenId: string;
  tierId: number;
  tokenUri: string | null;
  metadata: unknown;
  hook: { address: string; projectId: number; project: { metadata: Record<string, unknown> | null } | null };
};

export type OwnedItem = { tokenId: string; tierId: number; shop: string; shopName: string; name: string; image?: string };

export async function readOwnedItems(address: Address): Promise<OwnedItem[]> {
  // Bendystraw stores owners lowercase; if a known holder returns nothing, try getAddress(address).
  const owner = getAddress(address).toLowerCase();
  const data = await bendystraw<{ nfts: { items: Row[] } }>(SUPPORTED_CHAIN_IDS[0], OWNED_QUERY, { owner });
  return data.nfts.items
    .filter((r) => isSupportedChain(r.chainId))
    .map((r) => {
      const meta = mergeTierMeta([
        { tierId: r.tierId, metadata: r.metadata, resolvedUri: r.tokenUri?.startsWith("data:") ? r.tokenUri : null },
      ]).get(r.tierId);
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
