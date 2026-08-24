import { describe, expect, it } from "vitest";
import { JB_CHAINS } from "@bananapus/nana-sdk-core";
import { chainName, chainSlug, isSupportedChain, publicClientFor, rpcUrlsFor, SUPPORTED_CHAIN_IDS } from "@/lib/chains";

describe("chains", () => {
  it("supports the four V6 mainnets by default", () => {
    expect(SUPPORTED_CHAIN_IDS).toEqual([1, 8453, 10, 42161]);
    expect(isSupportedChain(8453)).toBe(true);
    expect(isSupportedChain(137)).toBe(false);
  });
  it("maps ids to slugs", () => {
    expect(chainSlug(8453)).toBe("base");
    expect(chainSlug(1)).toBe("eth");
  });
  it("reads comma-separated RPC lists from env", () => {
    process.env.NEXT_PUBLIC_RPC_8453 = "https://a.example, https://b.example";
    expect(rpcUrlsFor(8453)).toEqual(["https://a.example", "https://b.example"]);
  });
  it("builds a client for a supported chain", () => {
    expect(publicClientFor(8453).chain?.id).toBe(8453);
  });
  it("returns chain names", () => {
    expect(chainName(8453)).toBe("Base");
  });
  it("falls back to default RPC URLs when env var is not set", () => {
    delete process.env.NEXT_PUBLIC_RPC_10;
    expect(rpcUrlsFor(10)).toEqual([...JB_CHAINS[10].chain.rpcUrls.default.http]);
  });
});
