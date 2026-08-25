"use client";

import { useAccount } from "wagmi";

/** Shown on `/account/[address]` when the viewer's connected wallet matches the page. */
export function YouBadge({ address }: { address: string }) {
  const { address: connected } = useAccount();
  if (!connected || connected.toLowerCase() !== address.toLowerCase()) return null;
  return <p className="mt-1 text-sm text-accent">This is you</p>;
}
