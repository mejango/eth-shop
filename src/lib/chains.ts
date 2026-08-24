import { jbCenterRpcTransport } from "@/lib/jbcenter-rpc";
import { JB_CHAIN_SLUGS, JB_CHAINS, type JBChainId } from "@bananapus/nana-sdk-core";
import { createPublicClient, fallback, http, type PublicClient, type Transport } from "viem";

const MAINNETS = [1, 8453, 10, 42161] as const satisfies readonly JBChainId[];
const TESTNETS = [11155111, 84532, 11155420, 421614] as const satisfies readonly JBChainId[];

export const SUPPORTED_CHAIN_IDS: readonly JBChainId[] =
  process.env.NEXT_PUBLIC_TESTNET === "1" ? [...MAINNETS, ...TESTNETS] : [...MAINNETS];

export function isSupportedChain(id: number): id is JBChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(id);
}

export function chainSlug(chainId: JBChainId): string {
  const entry = Object.entries(JB_CHAIN_SLUGS).find(([, v]) => v.chain.id === chainId);
  if (!entry) throw new Error(`No slug for chain ${chainId}`);
  return entry[0];
}

export function chainName(chainId: JBChainId): string {
  return JB_CHAINS[chainId].chain.name;
}

/** The explicit `NEXT_PUBLIC_RPC_<chainId>` override, parsed, with no fallback applied. */
function parsedRpcOverride(chainId: JBChainId): string[] {
  const raw = process.env[`NEXT_PUBLIC_RPC_${chainId}`]?.trim();
  return raw ? raw.split(",").map((u) => u.trim()).filter(Boolean) : [];
}

/**
 * `NEXT_PUBLIC_RPC_<chainId>`: comma-separated HTTPS endpoints. This is an operator
 * override only — the default RPC path is juicebox.center (see `transportFor` below).
 * Falls back to the chain's public RPC list if the override is unset or malformed.
 */
export function rpcUrlsFor(chainId: JBChainId): string[] {
  const urls = parsedRpcOverride(chainId);
  return urls.length ? urls : [...JB_CHAINS[chainId].chain.rpcUrls.default.http];
}

// Only a genuine, non-empty override should divert away from juicebox.center: an env
// value like "," parses to zero URLs, and rpcUrlsFor's own fallback to the chain's
// public RPC would otherwise silently mask that as "override present".
function hasRpcOverride(chainId: JBChainId): boolean {
  return parsedRpcOverride(chainId).length > 0;
}

/** juicebox.center by default; an operator-set `NEXT_PUBLIC_RPC_<chainId>` overrides it. */
function transportFor(chainId: JBChainId): Transport {
  if (hasRpcOverride(chainId)) {
    return fallback(rpcUrlsFor(chainId).map((u) => http(u, { batch: true })));
  }
  return jbCenterRpcTransport(chainId);
}

const clients = new Map<number, PublicClient>();

export function publicClientFor(chainId: JBChainId): PublicClient {
  let client = clients.get(chainId);
  if (!client) {
    client = createPublicClient({
      chain: JB_CHAINS[chainId].chain,
      transport: transportFor(chainId),
      batch: { multicall: true },
    }) as PublicClient;
    clients.set(chainId, client);
  }
  return client;
}

/** Test-only: clears the memoized client cache so a changed env override takes effect. */
export function resetPublicClients(): void {
  clients.clear();
}
