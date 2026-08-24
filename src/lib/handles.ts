import "server-only";
import { getJBContractAddress, JBCoreContracts, type JBChainId } from "@bananapus/nana-sdk-core";
import type { Address } from "viem";
import { normalize } from "viem/ens";
import { isSupportedChain, publicClientFor } from "./chains";

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

/** The handle the project OWNER published for this project, or null. */
export async function handleFor(chainId: JBChainId, projectId: bigint): Promise<string | null> {
  try {
    const owner = await projectOwner(chainId, projectId);
    const name = await publicClientFor(HANDLE_CHAIN).readContract({
      address: JB_PROJECT_HANDLES,
      abi: handlesAbi,
      functionName: "handleOf",
      args: [BigInt(chainId), projectId, owner],
    });
    return name ? handleForEnsName(name) : null;
  } catch {
    return null;
  }
}

/** ENS name → project, accepted only if the project owner published the same name back. */
export async function resolveHandle(handle: string): Promise<{ chainId: JBChainId; projectId: bigint } | null> {
  let name: string;
  try {
    name = normalize(ensNameForHandle(handle));
  } catch {
    return null;
  }
  try {
    const text = await publicClientFor(HANDLE_CHAIN).getEnsText({ name, key: TEXT_KEY });
    const record = parseHandleRecord(text);
    if (!record || !isSupportedChain(record.chainId)) return null;
    const published = await handleFor(record.chainId, record.projectId);
    if (published !== handleForEnsName(name)) return null;
    return { chainId: record.chainId, projectId: record.projectId };
  } catch {
    return null; // ENS, resolver or RPC down: fail closed; the caller shows "No shop here yet"
  }
}
