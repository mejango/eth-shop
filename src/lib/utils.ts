import { JB_CHAINS, type JBChainId } from "@bananapus/nana-sdk-core";
import { twMerge } from "tailwind-merge";

export type ClassValue =
  string | number | boolean | null | undefined | ClassValue[] | { [className: string]: unknown };

function joinClassValues(value: ClassValue): string {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(joinClassValues).filter(Boolean).join(" ");
  return Object.entries(value)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([className]) => className)
    .join(" ");
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(inputs.map(joinClassValues).filter(Boolean).join(" "));
}

/**
 * The single source for block-explorer origins (e.g. "https://basescan.org").
 *
 * Hostnames come from the SDK's chain definitions. Returns undefined for chains
 * the SDK doesn't know, so callers fail closed instead of linking to
 * `https://undefined/...`.
 */
export function explorerBaseUrl(chainId: number): string | undefined {
  const chainMeta = JB_CHAINS[chainId as JBChainId];
  if (!chainMeta) return undefined;
  return `https://${chainMeta.etherscanHostname}`;
}

export function formatEthAddress(address: string, opts: { truncateTo?: number } = { truncateTo: 4 }) {
  if (!opts.truncateTo) return address;

  const frontTruncate = opts.truncateTo + 2; // account for 0x
  return (
    address.substring(0, frontTruncate) +
    "..." +
    address.substring(address.length - opts.truncateTo, address.length)
  );
}

export function formatWalletError(error: unknown, defaultMessage = "Please try again") {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return defaultMessage;

  const { shortMessage, message } = error as Record<string, unknown>;
  if (typeof shortMessage === "string" && shortMessage) {
    return shortMessage.replace("User rejected", "You rejected");
  }
  if (typeof message === "string" && message) return message;
  return defaultMessage;
}
