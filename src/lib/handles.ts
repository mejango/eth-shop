import "server-only";
import { getJBContractAddress, isContractRevertError, JBCoreContracts, type JBChainId } from "@bananapus/nana-sdk-core";
import type { Address } from "viem";
import { normalize } from "viem/ens";
import { isSupportedChain, publicClientFor } from "./chains";
import { slugFor } from "./slug";

export const JB_PROJECT_HANDLES = "0x726f4a3dfd2fb8297f8ab98d215b42a92d8eefe8" as Address; // mainnet only
const HANDLE_CHAIN: JBChainId = 1;
const TEXT_KEY = "juicebox";

const handlesAbi = [
  {
    type: "function",
    name: "handleOf",
    stateMutability: "view",
    inputs: [
      { type: "uint256", name: "chainId" },
      { type: "uint256", name: "projectId" },
      { type: "address", name: "setter" },
    ],
    outputs: [{ type: "string" }],
  },
] as const;

const ownerOfAbi = [
  { type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

export function parseHandleRecord(text: string | null): { chainId: number; projectId: bigint } | null {
  if (!text) return null;
  const m = /^(\d+):(\d+)$/.exec(text.trim());
  if (!m) return null;
  const projectId = BigInt(m[2]);
  if (projectId <= 0n) return null;
  return { chainId: Number(m[1]), projectId };
}

export function ensNameForHandle(handle: string): string {
  const h = handle.trim().toLowerCase();
  return h.includes(".") ? h : `${h}.eth`;
}

export function handleForEnsName(name: string): string {
  const n = name.trim().toLowerCase();
  return n.endsWith(".eth") ? n.slice(0, -4) : n;
}

export async function projectOwner(chainId: JBChainId, projectId: bigint): Promise<Address> {
  return publicClientFor(chainId).readContract({
    address: getJBContractAddress(JBCoreContracts.JBProjects, 6, chainId),
    abi: ownerOfAbi,
    functionName: "ownerOf",
    args: [projectId],
  });
}

/**
 * The handle the project OWNER published for this project, or null if the project
 * has no owner (never minted — `ownerOf` reverts) or has no published handle.
 * Transport/RPC errors are NOT swallowed here: they propagate so the caller's error
 * boundary shows, instead of masquerading as "no handle".
 */
export async function handleFor(chainId: JBChainId, projectId: bigint): Promise<string | null> {
  const owner = await projectOwner(chainId, projectId).catch((error: unknown) => {
    // ownerOf() reverts for a project that was never minted — a legitimate "no
    // handle" signal, not a transport failure. Only swallow the on-chain revert;
    // anything else (RPC down, wrong chain, timeout) must propagate.
    if (isContractRevertError(error)) return null;
    throw error;
  });
  if (owner === null) return null;
  const name = await publicClientFor(HANDLE_CHAIN).readContract({
    address: JB_PROJECT_HANDLES,
    abi: handlesAbi,
    functionName: "handleOf",
    args: [BigInt(chainId), projectId, owner],
  });
  return name ? handleForEnsName(name) : null;
}

/**
 * ENS name → project, accepted only if the project owner published the same name
 * back. Returns null only for a genuinely missing/malformed record: an invalid ENS
 * name, no text record, an unparsable record, an unsupported chain, or a
 * publisher/handle mismatch. Transport/RPC errors from `getEnsText` or `handleFor`
 * are NOT swallowed: they propagate so the caller's error boundary shows, instead of
 * a live RPC outage silently rendering as "no shop here".
 */
export async function resolveHandle(handle: string): Promise<{ chainId: JBChainId; projectId: bigint } | null> {
  let name: string;
  try {
    name = normalize(ensNameForHandle(handle));
  } catch {
    return null; // not a valid ENS name
  }
  const text = await publicClientFor(HANDLE_CHAIN).getEnsText({ name, key: TEXT_KEY });
  const record = parseHandleRecord(text);
  if (!record || !isSupportedChain(record.chainId)) return null;
  const published = await handleFor(record.chainId, record.projectId);
  if (published !== handleForEnsName(name)) return null;
  return { chainId: record.chainId, projectId: record.projectId };
}

/**
 * The path a shop is linked and displayed by: its ENS handle when the owner published
 * one AND the ENS text record points back at this project (the same round trip
 * `resolveHandle` demands, so the link is guaranteed to resolve), else `chain:id`.
 * Any RPC failure falls back to `chain:id` — a label must never take the page down.
 */
export async function publicSlugFor(chainId: JBChainId, projectId: bigint): Promise<string> {
  const slug = slugFor(chainId, projectId);
  const key = `${chainId}:${projectId}`;
  const hit = slugMemo.get(key);
  if (hit && Date.now() - hit.at < SLUG_TTL_MS) return hit.slug;
  try {
    const handle = await handleFor(chainId, projectId);
    if (!handle) return remember(key, slug);
    const text = await publicClientFor(HANDLE_CHAIN).getEnsText({ name: normalize(ensNameForHandle(handle)), key: TEXT_KEY });
    const record = parseHandleRecord(text);
    const ok = record !== null && record.chainId === chainId && record.projectId === projectId;
    return remember(key, ok ? handle : slug);
  } catch (error) {
    console.warn("publicSlugFor failed", key, error instanceof Error ? error.message : String(error));
    return slug;
  }
}

// ponytail: in-process memo; ~5 RPC calls per shop otherwise on every feed rebuild.
const SLUG_TTL_MS = 5 * 60_000;
const slugMemo = new Map<string, { at: number; slug: string }>();
function remember(key: string, slug: string): string {
  slugMemo.set(key, { at: Date.now(), slug });
  return slug;
}
