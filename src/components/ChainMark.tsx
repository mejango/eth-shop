import { chainLabel } from "@/lib/chainList";

const CHAIN_LOGOS: Record<number, string> = {
  1: "/assets/chains/mainnet.svg",
  11155111: "/assets/chains/mainnet.svg",
  10: "/assets/chains/optimism.svg",
  11155420: "/assets/chains/optimism.svg",
  8453: "/assets/chains/base.svg",
  84532: "/assets/chains/base.svg",
  42161: "/assets/chains/arbitrum.svg",
  421614: "/assets/chains/arbitrum.svg",
};

export function ChainMark({ chainId, className = "h-4 w-4" }: { chainId: number; className?: string }) {
  const src = CHAIN_LOGOS[chainId];
  if (!src) return <span className="font-mono text-xs">{chainLabel(chainId)}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={chainLabel(chainId)} title={chainLabel(chainId)} className={`inline-block ${className}`} />;
}
