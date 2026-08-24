import { describe, expect, it } from "vitest";
import { ensNameForHandle, handleForEnsName, parseHandleRecord } from "@/lib/handles";
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
