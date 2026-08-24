import { jbCenterAppOrigin, jbCenterBaseUrl } from "@/lib/jbcenter-config";
import { createJBCenterRpcProvider } from "@bananapus/nana-sdk-core/jbcenter";
import { custom, type Transport } from "viem";

const serverFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  headers.set("Origin", jbCenterAppOrigin());
  return fetch(input, { ...init, headers });
};

const browserFetch: typeof fetch = (input, init) => window.fetch(input, init);

export function jbCenterRpcTransport(chainId: number): Transport {
  return custom(
    createJBCenterRpcProvider(chainId, {
      baseUrl: jbCenterBaseUrl(),
      fetch: typeof window === "undefined" ? serverFetch : browserFetch,
    }),
    { retryCount: 1 },
  );
}
