import "server-only";
import { type JBChainId } from "@bananapus/nana-sdk-core";
import { decode721RulesetMetadata, getCurrentRuleset, getProject721Shop, parseTierMetadataJson, tierDisplayMetadata, tierMediaImageUrl } from "@bananapus/nana-sdk-core/v6";
import type { Address } from "viem";
import { bendystraw } from "./bendystraw";
import { publicClientFor } from "./chains";
import { handleFor, projectOwner } from "./handles";
import { currencyOf, mapItem, type TierMeta } from "./items";
import { slugFor } from "./slug";
import type { Item, Shop } from "./types";

const GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://juicebox.center/ipfs/";
const ZERO = "0x0000000000000000000000000000000000000000";

export type BendyTier = {
  tierId: number;
  metadata: unknown;
  resolvedUri: string | null;
  allowOwnerMint?: boolean | null;
  transfersPausable?: boolean | null;
  cannotBeRemoved?: boolean | null;
  reserveBeneficiary?: string | null;
};

// Resolve any raw tier or project media reference (an "ipfs://" URI, an
// http(s) URL, or a data: URI) through the SDK's strict, CID-validated
// resolver, for both the project logo and tier images/animations. Also
// guards a defect in that resolver: tierMediaImageUrl fails closed on an
// invalid CID by returning the raw, unresolved "ipfs://<bad-cid>" string
// rather than undefined (verified against @bananapus/nana-sdk-core
// dist/esm/v6/nft.js tierMediaAssetUrl/tierMediaImageUrl) — a raw ipfs: URI
// is not renderable by a browser <img>/<source>, so treat "still has the
// ipfs: scheme after resolution" as "resolution failed" and drop it.
// Idempotent on an already-resolved gateway URL, so it's safe to apply to
// tierDisplayMetadata's own (already-resolved) image/animationUrl output.
export function resolvedMediaUrl(value: unknown): string | undefined {
  const resolved = tierMediaImageUrl(value, GATEWAY);
  return resolved?.startsWith("ipfs://") ? undefined : resolved;
}

export function mergeTierMeta(rows: BendyTier[]): Map<number, TierMeta> {
  const out = new Map<number, TierMeta>();
  for (const r of rows) {
    const resolved = r.resolvedUri ? parseTierMetadataJson(r.resolvedUri) : null;
    const json = resolved ?? (r.metadata && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>) : {});
    const display = tierDisplayMetadata(json, GATEWAY);
    out.set(r.tierId, {
      ...display,
      image: resolvedMediaUrl(display.image),
      animationUrl: resolvedMediaUrl(display.animationUrl),
      allowOwnerMint: r.allowOwnerMint ?? undefined,
      transfersPausable: r.transfersPausable ?? undefined,
      cannotBeRemoved: r.cannotBeRemoved ?? undefined,
      reserveBeneficiary: r.reserveBeneficiary && r.reserveBeneficiary !== ZERO ? (r.reserveBeneficiary as Address) : undefined,
    });
  }
  return out;
}

const SHOP_QUERY = `query Shop($chainId: Int!, $projectId: Int!) {
  project(chainId: $chainId, projectId: $projectId, version: 6) {
    metadata isRevnet
    nftHooks { items { address symbol nftTiers { items { tierId metadata resolvedUri allowOwnerMint transfersPausable cannotBeRemoved reserveBeneficiary } } } }
  }
}`;

type ShopQuery = {
  project: {
    metadata: Record<string, unknown> | null;
    isRevnet: boolean;
    nftHooks: { items: { address: string; symbol: string; nftTiers: { items: BendyTier[] } }[] };
  } | null;
};

// JB721TiersHookFlags field order (nana-721-hook-v6 src/structs/JB721TiersHookFlags.sol):
// noNewTiersWithReserves, noNewTiersWithVotes, noNewTiersWithOwnerMinting,
// preventOverspending, issueTokensForSplits. Not part of the SDK's public
// export surface (only reachable via the package's internal "generated" path,
// which its package.json "exports" map does not expose), so it's hand-rolled here.
const storeFlagsAbi = [
  {
    type: "function",
    name: "flagsOf",
    stateMutability: "view",
    inputs: [{ type: "address", name: "hook" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { type: "bool", name: "noNewTiersWithReserves" },
          { type: "bool", name: "noNewTiersWithVotes" },
          { type: "bool", name: "noNewTiersWithOwnerMinting" },
          { type: "bool", name: "preventOverspending" },
          { type: "bool", name: "issueTokensForSplits" },
        ],
      },
    ],
  },
] as const;

export async function readShop(chainId: JBChainId, projectId: bigint): Promise<{ shop: Shop; items: Item[] } | null> {
  const client = publicClientFor(chainId);
  let bendy: ShopQuery["project"] = null;
  try {
    bendy = (await bendystraw<ShopQuery>(chainId, SHOP_QUERY, { chainId, projectId: Number(projectId) })).project;
  } catch {
    bendy = null; // lists/metadata are optional; the chain reads below are authoritative
  }
  const sdk = await getProject721Shop(client, { chainId, projectId, isRevnet: bendy?.isRevnet ?? false, tierLimit: 1000 });
  if (!sdk) return null;

  const [owner, rulesetWithMetadata, flags, handle] = await Promise.all([
    projectOwner(chainId, projectId),
    getCurrentRuleset(client, { chainId, projectId }),
    client.readContract({ address: sdk.store, abi: storeFlagsAbi, functionName: "flagsOf", args: [sdk.hook] }),
    handleFor(chainId, projectId),
  ]);
  const app = decode721RulesetMetadata(rulesetWithMetadata.metadata.metadata);
  const hookRow = bendy?.nftHooks.items.find((h) => h.address.toLowerCase() === sdk.hook.toLowerCase());
  const meta = mergeTierMeta(hookRow?.nftTiers.items ?? []);
  const pm = (bendy?.metadata ?? {}) as { name?: string; description?: string; logoUri?: string; projectTagline?: string; ethShop?: { tagline?: string } };
  const currency = currencyOf(sdk.pricing);
  const slug = slugFor(chainId, projectId);

  const shop: Shop = {
    chainId,
    projectId: Number(projectId),
    slug,
    handle,
    name: pm.name || `Project ${projectId}`,
    tagline: pm.ethShop?.tagline ?? pm.projectTagline,
    about: pm.description,
    logo: resolvedMediaUrl(pm.logoUri),
    hook: sdk.hook,
    store: sdk.store,
    idTarget: sdk.metadataIdTarget,
    symbol: hookRow?.symbol ?? "",
    currency,
    decimals: sdk.pricing.decimals,
    flags: { preventOverspending: flags.preventOverspending, issueTokensForSplits: flags.issueTokensForSplits },
    ruleset: {
      pauseTransfers: app.pauseTransfers,
      pauseMintPendingReserves: app.pauseMintPendingReserves,
      cashOut: rulesetWithMetadata.metadata.useDataHookForCashOut,
    },
    owner,
  };
  const items = sdk.tiers
    .filter((t) => t.initialSupply > 0)
    .map((t) => mapItem({ shopSlug: slug, tier: t, meta: meta.get(t.id), currency, decimals: sdk.pricing.decimals }));
  return { shop, items };
}
