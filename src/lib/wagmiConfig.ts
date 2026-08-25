"use client";

import { lazyParaConnector } from "@/providers/lazy-para-connector";
import { externalWalletConnectors } from "@/providers/wallet-connectors";
import type { Chain } from "viem";
import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors/injected";
import { IS_DETERMINISTIC_BROWSER, PARA_EMBEDDED_WALLET_ENABLED } from "./browserEnvironment";
import { SUPPORTED_CHAINS, transports } from "./wagmiTransports";

export const wagmiConfig = createConfig({
  // `SUPPORTED_CHAINS` is `MAINNETS` (always 4 chains) with `TESTNETS` optionally appended, so
  // its length varies with `NEXT_PUBLIC_TESTNET` and TypeScript can't infer wagmi's required
  // non-empty tuple from that. The cast is safe: `MAINNETS` alone guarantees at least one chain.
  chains: SUPPORTED_CHAINS as unknown as readonly [Chain, ...Chain[]],
  // EIP-6963 discovers installed browser wallets without loading vendor SDKs.
  // The generic injected connector remains as a fallback for older providers.
  // Every non-injected wallet — Para, WalletConnect, Coinbase, Safe — sits
  // behind a lazy delegate, so its SDK is fetched only once that wallet is
  // picked or restored. `reconnect()` probes `getProvider()` on every
  // connector, which is exactly what those delegates short-circuit.
  connectors: IS_DETERMINISTIC_BROWSER
    ? []
    : PARA_EMBEDDED_WALLET_ENABLED
      ? [injected({ shimDisconnect: true }), lazyParaConnector(), ...externalWalletConnectors()]
      : [injected({ shimDisconnect: true }), ...externalWalletConnectors()],
  multiInjectedProviderDiscovery: !IS_DETERMINISTIC_BROWSER,
  ssr: true,
  transports,
});
