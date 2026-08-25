"use client";

import { resolvePaymentTerminal } from "@bananapus/nana-sdk-core/v6";
import { getJBContractAddress, JBCoreContracts, jb721TiersHookAbi, jbPricesAbi, type JBChainId } from "@bananapus/nana-sdk-core";
import { useQuery } from "@tanstack/react-query";
import { type Address, ContractFunctionRevertedError, HttpRequestError } from "viem";
import { usePublicClient } from "wagmi";

/**
 * Classify a price read error to determine the cause.
 * ContractFunctionRevertedError means no price feed is available.
 * HttpRequestError or other errors mean the RPC is unavailable.
 */
export function classifyPriceError(error: unknown): "no-feed" | "unavailable" {
  if (error instanceof ContractFunctionRevertedError) {
    return "no-feed";
  }
  if (error instanceof HttpRequestError) {
    return "unavailable";
  }
  return "unavailable";
}

/**
 * Read the credit balance for a wallet from a 721 tiers hook.
 */
export function useShopCredits(chainId: JBChainId | undefined, hookAddress: Address | undefined, walletAddress: Address | undefined) {
  const publicClient = usePublicClient({ chainId });

  return useQuery({
    queryKey: ["shopCredits", chainId, hookAddress, walletAddress],
    queryFn: async () => {
      if (!hookAddress || !walletAddress || !publicClient) {
        throw new Error("Missing required parameters");
      }

      const credits = await publicClient.readContract({
        address: hookAddress,
        abi: jb721TiersHookAbi,
        functionName: "payCreditsOf",
        args: [walletAddress],
      });

      return credits as bigint;
    },
    enabled: !!(chainId && hookAddress && walletAddress && publicClient),
  });
}

/**
 * Resolve which terminal should receive payment for a project token pair.
 */
export function useCheckoutTerminal(
  chainId: JBChainId | undefined,
  projectId: bigint | undefined,
  token: Address | undefined,
) {
  const publicClient = usePublicClient({ chainId });

  return useQuery({
    queryKey: ["checkoutTerminal", chainId, projectId, token],
    queryFn: async () => {
      if (!chainId || !projectId || !token || !publicClient) {
        throw new Error("Missing required parameters");
      }

      const terminal = await resolvePaymentTerminal(publicClient, {
        chainId,
        projectId,
        token,
      });

      return terminal;
    },
    enabled: !!(chainId && projectId && token && publicClient),
  });
}

/**
 * Read the price per unit between two currencies from JBPrices.
 */
export function usePricePerUnit(
  chainId: JBChainId | undefined,
  projectId: bigint | undefined,
  payCurrency: bigint | undefined,
  pricingCurrency: bigint | undefined,
  payDecimals: number | undefined,
) {
  const publicClient = usePublicClient({ chainId });

  return useQuery({
    queryKey: ["pricePerUnit", chainId, projectId, payCurrency, pricingCurrency, payDecimals],
    queryFn: async () => {
      if (!chainId || !projectId || payCurrency === undefined || pricingCurrency === undefined || payDecimals === undefined || !publicClient) {
        throw new Error("Missing required parameters");
      }

      // Same currency means 1:1 with the target decimals
      if (payCurrency === pricingCurrency) {
        return { pricePerUnit: 10n ** BigInt(payDecimals), unavailable: false };
      }

      try {
        const jbPricesAddress = getJBContractAddress(JBCoreContracts.JBPrices, 6, chainId);

        const pricePerUnit = await publicClient.readContract({
          address: jbPricesAddress,
          abi: jbPricesAbi,
          functionName: "pricePerUnitOf",
          args: [projectId, payCurrency, pricingCurrency, BigInt(payDecimals)],
        });

        return { pricePerUnit: pricePerUnit as bigint, unavailable: false };
      } catch (error) {
        const classification = classifyPriceError(error);
        if (classification === "no-feed") {
          return { pricePerUnit: null, unavailable: false };
        }
        return { pricePerUnit: null, unavailable: true };
      }
    },
    enabled: !!(chainId && projectId !== undefined && payCurrency !== undefined && pricingCurrency !== undefined && payDecimals !== undefined && publicClient),
  });
}

/**
 * Read the NFT balance owned by a wallet from a 721 tiers hook.
 */
export function useOwnedCount(chainId: JBChainId | undefined, hookAddress: Address | undefined, walletAddress: Address | undefined) {
  const publicClient = usePublicClient({ chainId });

  return useQuery({
    queryKey: ["ownedCount", chainId, hookAddress, walletAddress],
    queryFn: async () => {
      if (!hookAddress || !walletAddress || !publicClient) {
        throw new Error("Missing required parameters");
      }

      const count = await publicClient.readContract({
        address: hookAddress,
        abi: jb721TiersHookAbi,
        functionName: "balanceOf",
        args: [walletAddress],
      });

      return Number(count as bigint);
    },
    enabled: !!(chainId && hookAddress && walletAddress && publicClient),
  });
}
