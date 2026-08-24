import { describe, expect, it } from "vitest";
import { parseSlug, slugFor } from "@/lib/slug";
describe("slug", () => {
  it("parses chain:id", () => expect(parseSlug("base:41")).toEqual({ chainId: 8453, projectId: 41n }));
  it("rejects junk", () => {
    expect(parseSlug("tea")).toBeNull();
    expect(parseSlug("base:0")).toBeNull();
    expect(parseSlug("polygon:1")).toBeNull();
    expect(parseSlug("base:1:2")).toBeNull();
  });
  it("formats", () => expect(slugFor(8453, 41n)).toBe("base:41"));
});
