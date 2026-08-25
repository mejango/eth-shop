import { JB_CHAINS, type JBChainId } from "@bananapus/nana-sdk-core";

const MAINNETS = [1, 8453, 10, 42161] as const satisfies readonly JBChainId[];
const TESTNETS = [11155111, 84532, 11155420, 421614] as const satisfies readonly JBChainId[];

export const SUPPORTED_CHAIN_IDS: readonly JBChainId[] =
  process.env.NEXT_PUBLIC_TESTNET === "1" ? [...MAINNETS, ...TESTNETS] : [...MAINNETS];

export const SUPPORTED_CHAINS = SUPPORTED_CHAIN_IDS.map((id) => JB_CHAINS[id].chain);

export function isSupportedChain(id: number): id is JBChainId {
  return (SUPPORTED_CHAIN_IDS as readonly number[]).includes(id);
}

const CHAIN_LABELS: Record<number, string> = { 1: "Ethereum", 10: "Optimism", 8453: "Base", 42161: "Arbitrum" };

export function chainLabel(id: number): string {
  return CHAIN_LABELS[id] ?? JB_CHAINS[id as JBChainId]?.chain.name ?? `Chain ${id}`;
}
