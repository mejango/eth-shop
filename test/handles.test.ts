import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/chains", () => ({
  isSupportedChain: (id: number) => id === 8453,
  publicClientFor: vi.fn(),
}));

import { publicClientFor } from "@/lib/chains";
import { ensNameForHandle, handleForEnsName, parseHandleRecord, resolveHandle } from "@/lib/handles";

describe("handles", () => {
  it("parses the juicebox text record", () => {
    expect(parseHandleRecord("8453:41")).toEqual({ chainId: 8453, projectId: 41n });
    expect(parseHandleRecord("")).toBeNull();
    expect(parseHandleRecord("8453")).toBeNull();
    expect(parseHandleRecord("8453:abc")).toBeNull();
    expect(parseHandleRecord(null)).toBeNull();
  });
  it("maps handle to ens name and back", () => {
    expect(ensNameForHandle("Tea")).toBe("tea.eth");
    expect(ensNameForHandle("tea.xyz")).toBe("tea.xyz");
    expect(handleForEnsName("tea.eth")).toBe("tea");
    expect(handleForEnsName("tea.xyz")).toBe("tea.xyz");
  });
});

describe("resolveHandle", () => {
  it("rejects when getEnsText throws (transport/RPC error, must not become a false 404)", async () => {
    vi.mocked(publicClientFor).mockReturnValue({
      getEnsText: vi.fn().mockRejectedValue(new Error("RPC down")),
    } as never);
    await expect(resolveHandle("tea.eth")).rejects.toThrow("RPC down");
  });

  it("returns null when getEnsText resolves null (no published record)", async () => {
    vi.mocked(publicClientFor).mockReturnValue({
      getEnsText: vi.fn().mockResolvedValue(null),
    } as never);
    await expect(resolveHandle("tea.eth")).resolves.toBeNull();
  });
});
