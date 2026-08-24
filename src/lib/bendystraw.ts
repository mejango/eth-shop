import "server-only";
import { normalizeBendystrawEndpoint, selectBendystrawEndpoint } from "@bananapus/nana-sdk-core";

const mainnet = normalizeBendystrawEndpoint(
  process.env.NEXT_PUBLIC_BENDYSTRAW_URL?.trim() || "https://bendystraw.up.railway.app/graphql",
);
const testnet = normalizeBendystrawEndpoint(
  process.env.NEXT_PUBLIC_TESTNET_BENDYSTRAW_URL?.trim() || "https://testnet.bendystraw.xyz/graphql",
);

export function bendystrawUrlFor(chainId: number): string {
  return selectBendystrawEndpoint({ mainnet, testnet }, { chainId });
}

// ponytail: plain fetch, no persisted-operation registry. Add one if the prod endpoint starts 400ing
// unregistered queries (see revnet-money src/lib/bendystraw/registry.server.ts).
export async function bendystraw<T>(
  chainId: number,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(bendystrawUrlFor(chainId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`Bendystraw ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`Bendystraw error: ${json.errors.map((e) => e.message).join("; ")}`);
  if (!json.data) throw new Error("Bendystraw returned no data");
  return json.data;
}
