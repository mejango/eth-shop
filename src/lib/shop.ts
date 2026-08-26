import "server-only";
import { decodeEncodedIpfsUri, getJBContractAddress, isContractRevertError, NATIVE_TOKEN, RevnetCoreContracts, USDC_ADDRESSES, type JBChainId } from "@bananapus/nana-sdk-core";
import { decode721RulesetMetadata, getAccountingContexts, getCurrentRuleset, getProject721Shop, parseTierMetadataJson, tierDisplayMetadata, tierMediaImageUrl, type Project721Tier } from "@bananapus/nana-sdk-core/v6";
import type { Address } from "viem";
import { bendystraw } from "./bendystraw";
import { isSupportedChain, publicClientFor } from "./chains";
import { handleFor, projectOwner } from "./handles";
import { currencyOf, mapItem, type TierMeta } from "./items";
import { slugFor } from "./slug";
import { mergeCatalogs } from "./omni";
import { readAllActiveTiers, readResolvedTierUris, RESOLVED_TIER_FETCH_CAP } from "./tiers";
import type { Item, Shop } from "./types";

// `||` on purpose: the Dockerfile materializes unset build args as empty strings, which `??` misses.
const GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY?.trim() || "https://juicebox.center/ipfs/";
const ZERO = "0x0000000000000000000000000000000000000000";

export type BendyTier = {
  tierId: number;
  metadata: unknown;
  resolvedUri: string | null;
  allowOwnerMint?: boolean | null;
  transfersPausable?: boolean | null;
  cannotBeRemoved?: boolean | null;
  cantBuyWithCredits?: boolean | null;
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

// The REVOwner singleton is the same address across every chain it's deployed
// to, and a project is a revnet iff REVOwner owns it (REVDeployer transfers
// ownership to REVOwner at launch and it's never reassigned). This is the
// on-chain source of truth for getProject721Shop's isRevnet branch — a
// revnet's ruleset dataHook is REVOwner itself (it dispatches pay-time logic
// per revnet, not a JB721TiersHook directly), so the non-revnet branch's
// STORE() probe on it correctly reverts and getProject721Shop falls back to
// "no shop". Bendystraw's own isRevnet flag is corroboration only, never the
// sole source: a Bendystraw miss (indexer lag, or a project it hasn't
// flagged) must not silently turn a real revnet into a false "no shop".
function revOwnerAddress(chainId: JBChainId): Address | null {
  try {
    return getJBContractAddress(RevnetCoreContracts.REVOwner, 6, chainId);
  } catch {
    return null; // no REVOwner deployment on this chain: it can't be a revnet here
  }
}

export function isRevnetOwner(owner: Address, revOwner: Address | null): boolean {
  return revOwner !== null && owner.toLowerCase() === revOwner.toLowerCase();
}

// Chain wins whenever it has an answer: a non-null ownerProbe means ownerOf() actually
// returned an owner, so the on-chain isRevnetOwner check is authoritative and Bendystraw's
// isRevnet flag (indexer lag, or a project it hasn't flagged yet) never overrides it.
// Bendystraw is consulted only when ownerProbe is null (ownerOf() reverted — project never
// minted, or the probe otherwise came back empty).
export function isRevnetFor(ownerProbe: Address | null, revOwner: Address | null, bendyFlag: boolean): boolean {
  return ownerProbe !== null ? isRevnetOwner(ownerProbe, revOwner) : bendyFlag;
}

/**
 * Map the project's raw accounting contexts to the tokens a buyer can pay
 * with directly, with a display symbol: native gets "ETH", the chain's known
 * USDC address (if the SDK exports one for this chain) gets "USDC", and
 * anything else falls back to "TOKEN" rather than guessing.
 */
export function mapAcceptedTokens(
  contexts: readonly { token: Address; decimals: number; currency: number }[],
  chainId: JBChainId,
): Shop["acceptedTokens"] {
  const usdc = USDC_ADDRESSES[chainId as keyof typeof USDC_ADDRESSES] as Address | undefined;
  return contexts.map((c) => ({
    token: c.token,
    decimals: c.decimals,
    currency: c.currency,
    symbol:
      c.token.toLowerCase() === NATIVE_TOKEN.toLowerCase()
        ? "ETH"
        : usdc && c.token.toLowerCase() === usdc.toLowerCase()
          ? "USDC"
          : "TOKEN",
  }));
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
      cantBuyWithCredits: r.cantBuyWithCredits ?? undefined,
      reserveBeneficiary: r.reserveBeneficiary && r.reserveBeneficiary !== ZERO ? (r.reserveBeneficiary as Address) : undefined,
    });
  }
  return out;
}

const SHOP_QUERY = `query Shop($chainId: Float!, $projectId: Float!) {
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
  const [bendy, ownerProbe] = await Promise.all([
    bendystraw<ShopQuery>(chainId, SHOP_QUERY, { chainId, projectId: Number(projectId) })
      .then((r) => r.project)
      .catch((error: unknown): ShopQuery["project"] => {
        // lists/metadata are optional; the chain reads below are authoritative
        console.warn("bendystraw shop query failed", error instanceof Error ? error.message : String(error));
        return null;
      }),
    projectOwner(chainId, projectId).catch((error: unknown) => {
      // ownerOf() reverts for a project that was never minted — a legitimate
      // "no shop" signal handled by the null hook below, not a transport
      // failure. Only swallow the on-chain revert; anything else (RPC down,
      // wrong chain, timeout) must reach error.tsx, never masquerade as
      // "not a revnet".
      if (isContractRevertError(error)) return null;
      throw error;
    }),
  ]);
  const isRevnet = isRevnetFor(ownerProbe, revOwnerAddress(chainId), bendy?.isRevnet ?? false);
  // tierLimit: 1 — this call resolves the hook/store/metadataIdTarget/pricing
  // (and, for non-revnets, the ruleset it read to find the hook) only. Tiers
  // are read separately below via the pager, not sdk.tiers: Project721Tier
  // carries neither the on-chain flags (allowOwnerMint/transfersPausable/
  // cantBeRemoved) nor reserveBeneficiary that this app needs, and a large
  // tier set of inline data-URI metadata (e.g. Banny's 68 inline-SVG tiers)
  // makes the upstream RPC reject tiersOf's includeResolvedUri: true outright
  // — this app never needs the on-chain resolved URI anyway, since media is
  // sourced from Bendystraw (mergeTierMeta below).
  const sdk = await getProject721Shop(client, { chainId, projectId, isRevnet, tierLimit: 1 });
  if (!sdk) return null;
  // getProject721Shop only resolves a hook for a project that exists, so the
  // revert-tolerant probe above must have succeeded; re-probing only covers
  // the type, not a real code path.
  const owner = ownerProbe ?? (await projectOwner(chainId, projectId));

  // sdk.ruleset is the ruleset getProject721Shop already read to resolve the
  // hook, for every non-revnet project — reuse it instead of a second
  // currentRulesetOf call. It's null only for revnets, whose hook comes from
  // REVOwner without a ruleset read, so getCurrentRuleset is still needed there.
  const [rulesetWithMetadata, flags, handle, rawTiers, accountingContexts] = await Promise.all([
    sdk.ruleset ? Promise.resolve(sdk.ruleset) : getCurrentRuleset(client, { chainId, projectId }),
    client.readContract({ address: sdk.store, abi: storeFlagsAbi, functionName: "flagsOf", args: [sdk.hook] }),
    handleFor(chainId, projectId),
    readAllActiveTiers(client, sdk.store, sdk.hook),
    getAccountingContexts(client, { chainId, projectId }),
  ]);
  const app = decode721RulesetMetadata(rulesetWithMetadata.metadata.metadata);
  const hookRow = bendy?.nftHooks.items.find((h) => h.address.toLowerCase() === sdk.hook.toLowerCase());
  const bendyTierById = new Map((hookRow?.nftTiers.items ?? []).map((r) => [r.tierId, r]));
  const activeTiers = rawTiers.filter((t) => t.initialSupply > 0);
  // On-chain flags and reserveBeneficiary are authoritative; Bendystraw only
  // fills display metadata (name/description/image) for the same tier id.
  const meta = mergeTierMeta(
    activeTiers.map((t) => ({
      tierId: t.id,
      metadata: bendyTierById.get(t.id)?.metadata ?? null,
      resolvedUri: bendyTierById.get(t.id)?.resolvedUri ?? null,
      allowOwnerMint: t.flags.allowOwnerMint,
      transfersPausable: t.flags.transfersPausable,
      cannotBeRemoved: t.flags.cantBeRemoved,
      cantBuyWithCredits: t.flags.cantBuyWithCredits,
      reserveBeneficiary: t.reserveBeneficiary,
    })),
  );
  // Tiers Bendystraw has no art for (e.g. resolver-only collections like Banny's
  // newest tiers) get a second, bounded on-chain pass: one small tierOf read each
  // for the resolver output the bulk read deliberately skips.
  const missingMedia = activeTiers.filter((t) => !meta.get(t.id)?.image).map((t) => t.id);
  if (missingMedia.length > 0) {
    const resolved = await readResolvedTierUris(client, sdk.store, sdk.hook, missingMedia);
    for (const [tierId, resolvedUri] of resolved) {
      const patch = mergeTierMeta([{ tierId, metadata: null, resolvedUri }]).get(tierId);
      const existing = meta.get(tierId);
      if (!patch?.image || !existing) continue;
      // Fill display fields only; flags and reserveBeneficiary stay chain-authoritative.
      meta.set(tierId, {
        ...existing,
        image: patch.image,
        animationUrl: existing.animationUrl ?? patch.animationUrl,
        name: existing.name || patch.name,
        description: existing.description || patch.description,
        categoryName: existing.categoryName || patch.categoryName,
      });
    }
  }
  // Last resort for shops Bendystraw hasn't parsed metadata for and whose hook has
  // no resolver: decode each tier's own encodedIpfsUri and fetch the JSON from the
  // gateway (bounded, best-effort).
  const stillMissing = activeTiers.filter((t) => !meta.get(t.id)?.image);
  if (stillMissing.length > 0) {
    await Promise.all(
      stillMissing.slice(0, RESOLVED_TIER_FETCH_CAP).map(async (t) => {
        try {
          if (!t.encodedIpfsUri || /^0x0+$/.test(t.encodedIpfsUri)) return;
          const cid = decodeEncodedIpfsUri(t.encodedIpfsUri);
          if (!cid) return;
          const res = await fetch(GATEWAY + String(cid).replace("ipfs://", ""), {
            signal: AbortSignal.timeout(8000),
          });
          if (!res.ok) return;
          const json = (await res.json()) as Record<string, unknown>;
          if (!json || typeof json !== "object") return;
          const display = tierDisplayMetadata(json, GATEWAY);
          const image = resolvedMediaUrl(display.image);
          if (!image) return;
          const existing = meta.get(t.id);
          meta.set(t.id, {
            ...(existing ?? {}),
            ...{
              image,
              animationUrl: existing?.animationUrl ?? resolvedMediaUrl(display.animationUrl),
              name: existing?.name || display.name,
              description: existing?.description || display.description,
              categoryName: existing?.categoryName || display.categoryName,
            },
          });
        } catch (error) {
          console.warn("tier ipfs metadata fetch failed", t.id, error instanceof Error ? error.message : String(error));
        }
      }),
    );
  }
  // A tier with no metadata at all falls back to "Category N"; if a sibling in the
  // same category id has a real name, adopt it so the catalog doesn't split one
  // category into two tabs.
  const categoryNames = new Map<number, string>();
  for (const t of activeTiers) {
    const name = meta.get(t.id)?.categoryName;
    if (name && !categoryNames.has(t.category)) categoryNames.set(t.category, name);
  }
  for (const t of activeTiers) {
    const m = meta.get(t.id);
    const sibling = categoryNames.get(t.category);
    if (m && !m.categoryName && sibling) meta.set(t.id, { ...m, categoryName: sibling });
  }
  const tiers: Project721Tier[] = activeTiers.map((t) => ({
    id: t.id,
    price: t.price,
    remainingSupply: t.remainingSupply,
    initialSupply: t.initialSupply,
    votingUnits: t.votingUnits,
    reserveFrequency: t.reserveFrequency,
    category: t.category,
    discountPercent: t.discountPercent,
    encodedIpfsUri: t.encodedIpfsUri,
    resolvedUri: "",
  }));
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
    pricingCurrency: sdk.pricing.currency,
    decimals: sdk.pricing.decimals,
    flags: { preventOverspending: flags.preventOverspending, issueTokensForSplits: flags.issueTokensForSplits },
    ruleset: {
      pauseTransfers: app.pauseTransfers,
      pauseMintPendingReserves: app.pauseMintPendingReserves,
      cashOut: rulesetWithMetadata.metadata.useDataHookForCashOut,
    },
    owner,
    acceptedTokens: mapAcceptedTokens(accountingContexts, chainId),
  };
  const items = tiers.map((t) => mapItem({ shopSlug: slug, tier: t, meta: meta.get(t.id), currency, decimals: sdk.pricing.decimals }));
  return { shop, items };
}

const GROUP_QUERY = `query Group($chainId: Float!, $projectId: Float!) {
  project(chainId: $chainId, projectId: $projectId, version: 6) { suckerGroupId }
}`;
const PEERS_QUERY = `query Peers($group: String) {
  projects(where: { suckerGroupId: $group, version: 6 }, limit: 20) { items { chainId projectId } }
}`;

async function suckerPeers(chainId: JBChainId, projectId: bigint): Promise<{ chainId: number; projectId: number }[]> {
  try {
    const group = await bendystraw<{ project: { suckerGroupId: string | null } | null }>(chainId, GROUP_QUERY, {
      chainId,
      projectId: Number(projectId),
    });
    const id = group.project?.suckerGroupId;
    if (!id) return [];
    const peers = await bendystraw<{ projects: { items: { chainId: number; projectId: number }[] } }>(
      chainId,
      PEERS_QUERY,
      { group: id },
    );
    return peers.projects.items;
  } catch (error) {
    console.warn("suckerPeers failed; rendering single-chain", chainId, projectId, error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * A shop merged across its sucker group: the requested chain is canonical, peers
 * are read in parallel, and identical items collapse into one card with summed
 * inventory (see mergeCatalogs). Peer failures degrade to fewer chains, never an
 * error; a Bendystraw outage degrades to single-chain.
 */
type OmniShop = { shop: Shop; items: Item[]; chainShops: Shop[] } | null;

// One fan-out per shop per minute: the 4-chain read is ~300 RPC calls, and doing it
// per request rate-limited the RPC and pegged the replica. Concurrent requests share
// the in-flight promise; failures and misses don't stick.
const OMNI_TTL_MS = 60_000;
const omniCache = new Map<string, { at: number; promise: Promise<OmniShop> }>();

export function readOmnichainShop(chainId: JBChainId, projectId: bigint): Promise<OmniShop> {
  const key = `${chainId}:${projectId}`;
  const hit = omniCache.get(key);
  if (hit && Date.now() - hit.at < OMNI_TTL_MS) return hit.promise;
  const promise = readOmnichainShopFresh(chainId, projectId);
  omniCache.set(key, { at: Date.now(), promise });
  promise.then(
    (r) => {
      if (r === null) omniCache.delete(key);
    },
    () => omniCache.delete(key),
  );
  return promise;
}

async function readOmnichainShopFresh(chainId: JBChainId, projectId: bigint): Promise<OmniShop> {
  const [canonical, peers] = await Promise.all([readShop(chainId, projectId), suckerPeers(chainId, projectId)]);
  if (!canonical) return null;
  const others = peers.filter(
    (p) => isSupportedChain(p.chainId) && !(p.chainId === chainId && BigInt(p.projectId) === projectId),
  );
  const peerReads =
    others.length > 0
      ? await Promise.all(
          others.map((p) =>
            readShop(p.chainId as JBChainId, BigInt(p.projectId)).catch((error: unknown) => {
              console.warn("peer readShop failed; dropping chain", p.chainId, p.projectId, error instanceof Error ? error.message : String(error));
              return null;
            }),
          ),
        )
      : [];
  const catalogs = [canonical, ...peerReads.filter((c): c is NonNullable<typeof c> => c !== null)];
  return { shop: canonical.shop, items: mergeCatalogs(catalogs), chainShops: catalogs.map((c) => c.shop) };
}
