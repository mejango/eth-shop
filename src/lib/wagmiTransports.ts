import { SUPPORTED_CHAIN_IDS, SUPPORTED_CHAINS } from "@/lib/chainList";
import type { Transport } from "viem";
import { jbCenterRpcTransport } from "./jbcenter-rpc";

export { SUPPORTED_CHAINS };

export const transports: Record<number, Transport> = Object.fromEntries(
  SUPPORTED_CHAIN_IDS.map((id) => [id, jbCenterRpcTransport(id)]),
);
