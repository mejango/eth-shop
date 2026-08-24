import { afterEach, describe, expect, it, vi } from "vitest";
import { bendystraw, bendystrawUrlFor } from "@/lib/bendystraw";

describe("bendystraw", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("picks the testnet endpoint for testnet chains", () => {
    expect(bendystrawUrlFor(84532)).toContain("testnet");
    expect(bendystrawUrlFor(8453)).not.toContain("testnet");
  });
  it("posts the query and returns data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { ok: 1 } }))));
    await expect(bendystraw<{ ok: number }>(8453, "query { ok }")).resolves.toEqual({ ok: 1 });
  });
  it("throws on GraphQL errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: "nope" }] }))));
    await expect(bendystraw(8453, "query { x }")).rejects.toThrow(/nope/);
  });
});
