import "server-only";
import {
  getJBContractAddress,
  ipfsAssetPath,
  isIpfsCid,
  jbControllerAbi,
  jbDirectoryAbi,
  JBCoreContracts,
  type JBChainId,
} from "@bananapus/nana-sdk-core";
import { zeroAddress, type PublicClient } from "viem";

// `||` on purpose: the Dockerfile materializes unset build args as empty strings, which `??` misses.
export const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY?.trim() || "https://juicebox.center/ipfs/";

export type ProjectMeta = {
  name?: string;
  description?: string;
  logoUri?: string;
  projectTagline?: string;
  ethShop?: { tagline?: string };
};

export type IndexedProject = { metadata?: Record<string, unknown> | null; metadataUri?: string | null } | null | undefined;

/** The project metadata JSON behind an `ipfs://` URI, gateway URL or bare CID. Best-effort: null on any failure. */
export async function fetchProjectMetadata(uri: string | null | undefined): Promise<ProjectMeta | null> {
  const value = uri?.trim();
  if (!value) return null;
  const path = ipfsAssetPath(value) ?? (isIpfsCid(value) ? value : null);
  if (!path) return null;
  try {
    const res = await fetch(IPFS_GATEWAY + path, {
      signal: AbortSignal.timeout(8000),
      // CID content is immutable.
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    return json && typeof json === "object" ? (json as ProjectMeta) : null;
  } catch (error) {
    console.warn("project metadata fetch failed", value, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/** The metadata URI the project's controller stores onchain. Null when unreadable. */
export async function onchainMetadataUri(client: PublicClient, chainId: JBChainId, projectId: bigint): Promise<string | null> {
  try {
    const controller = await client.readContract({
      address: getJBContractAddress(JBCoreContracts.JBDirectory, 6, chainId),
      abi: jbDirectoryAbi,
      functionName: "controllerOf",
      args: [projectId],
    });
    if (controller === zeroAddress) return null;
    return await client.readContract({ address: controller, abi: jbControllerAbi, functionName: "uriOf", args: [projectId] });
  } catch (error) {
    console.warn("uriOf read failed", chainId, projectId, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Bendystraw's parsed metadata when it carries a name. Otherwise the JSON behind the
 * metadata URI: Bendystraw's `metadataUri`, or the onchain one when it has none.
 */
export async function resolveProjectMetadata(
  project: IndexedProject,
  onchainUri?: () => Promise<string | null>,
): Promise<ProjectMeta> {
  const indexed = (project?.metadata ?? {}) as ProjectMeta;
  if (typeof indexed.name === "string" && indexed.name) return indexed;
  const uri = project?.metadataUri || (onchainUri ? await onchainUri() : null);
  const fetched = await fetchProjectMetadata(uri);
  return fetched ? { ...indexed, ...fetched } : indexed;
}

/** resolveProjectMetadata once per distinct (chainId, projectId), keyed `${chainId}:${projectId}`. */
export async function metadataByProject(
  rows: { chainId: number; projectId: number; project: IndexedProject }[],
): Promise<Map<string, ProjectMeta>> {
  const byKey = new Map<string, IndexedProject>();
  for (const r of rows) {
    const key = `${r.chainId}:${r.projectId}`;
    if (!byKey.has(key)) byKey.set(key, r.project);
  }
  const entries = await Promise.all(
    [...byKey].map(async ([key, project]) => [key, await resolveProjectMetadata(project)] as const),
  );
  return new Map(entries);
}
