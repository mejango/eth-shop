import { JB_CHAIN_SLUGS, type JBChainId } from "@bananapus/nana-sdk-core";
import { chainSlug, isSupportedChain } from "./chains";

export function parseSlug(slug: string): { chainId: JBChainId; projectId: bigint } | null {
  const parts = slug.trim().split(":");
  if (parts.length !== 2) return null;
  const chain = JB_CHAIN_SLUGS[parts[0]];
  if (!chain || !isSupportedChain(chain.chain.id)) return null;
  if (!/^\d+$/.test(parts[1])) return null;
  const projectId = BigInt(parts[1]);
  if (projectId <= 0n) return null;
  return { chainId: chain.chain.id as JBChainId, projectId };
}

export function slugFor(chainId: JBChainId, projectId: bigint | number): string {
  return `${chainSlug(chainId)}:${projectId}`;
}
