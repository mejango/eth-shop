import { describe, expect, it } from "vitest";
import { mergeTierMeta, resolvedMediaUrl } from "@/lib/shop";

describe("mergeTierMeta", () => {
  it("keys rows by tierId, resolves a valid ipfs CID through the gateway, reads flags", () => {
    const m = mergeTierMeta([
      {
        tierId: 3,
        metadata: { name: "Mug", image: "ipfs://bafybeian6sdh3idofou7v2f5ufw2et52lnlxj5ijtnmiw2fghgxnsszpha", categoryName: "Kiln" },
        resolvedUri: "",
        allowOwnerMint: true,
        transfersPausable: false,
        cannotBeRemoved: false,
        reserveBeneficiary: "0x0000000000000000000000000000000000000000",
      },
    ]);
    expect(m.get(3)).toMatchObject({ name: "Mug", categoryName: "Kiln", allowOwnerMint: true, reserveBeneficiary: undefined });
    expect(m.get(3)?.image).toBe("https://juicebox.center/ipfs/bafybeian6sdh3idofou7v2f5ufw2et52lnlxj5ijtnmiw2fghgxnsszpha");
  });

  it("prefers a resolvedUri data uri over pinned metadata", () => {
    const json = Buffer.from(JSON.stringify({ name: "A", image: "data:image/svg+xml;base64,PHN2Zy8+" })).toString("base64");
    const m = mergeTierMeta([{ tierId: 1, metadata: { name: "A", image: "ipfs://x" }, resolvedUri: `data:application/json;base64,${json}` }]);
    expect(m.get(1)?.image).toMatch(/^data:image\/svg/);
  });

  it("drops an image that fails CID validation rather than shipping an unrenderable ipfs: uri", () => {
    const m = mergeTierMeta([{ tierId: 5, metadata: { name: "Bad", image: "ipfs://abc" }, resolvedUri: "" }]);
    expect(m.get(5)?.image).toBeUndefined();
  });
});

describe("resolvedMediaUrl", () => {
  it("resolves a valid ipfs CID through the gateway", () => {
    expect(resolvedMediaUrl("ipfs://bafybeian6sdh3idofou7v2f5ufw2et52lnlxj5ijtnmiw2fghgxnsszpha")).toBe(
      "https://juicebox.center/ipfs/bafybeian6sdh3idofou7v2f5ufw2et52lnlxj5ijtnmiw2fghgxnsszpha",
    );
  });

  it("drops an invalid ipfs CID", () => {
    expect(resolvedMediaUrl("ipfs://abc")).toBeUndefined();
  });

  it("passes through an ordinary http(s) URL", () => {
    expect(resolvedMediaUrl("https://example.com/logo.png")).toBe("https://example.com/logo.png");
  });

  it("passes through undefined", () => {
    expect(resolvedMediaUrl(undefined)).toBeUndefined();
  });
});
