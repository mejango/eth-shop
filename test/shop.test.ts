import { describe, expect, it } from "vitest";
import { mergeTierMeta } from "@/lib/shop";

describe("mergeTierMeta", () => {
  it("keys rows by tierId, resolves ipfs images through the gateway, reads flags", () => {
    const m = mergeTierMeta([
      {
        tierId: 3,
        metadata: { name: "Mug", image: "ipfs://abc", categoryName: "Kiln" },
        resolvedUri: "",
        allowOwnerMint: true,
        transfersPausable: false,
        cannotBeRemoved: false,
        reserveBeneficiary: "0x0000000000000000000000000000000000000000",
      },
    ]);
    expect(m.get(3)).toMatchObject({ name: "Mug", categoryName: "Kiln", allowOwnerMint: true, reserveBeneficiary: undefined });
    expect(m.get(3)?.image).toBe("https://juicebox.center/ipfs/abc");
  });

  it("prefers a resolvedUri data uri over pinned metadata", () => {
    const json = Buffer.from(JSON.stringify({ name: "A", image: "data:image/svg+xml;base64,PHN2Zy8+" })).toString("base64");
    const m = mergeTierMeta([{ tierId: 1, metadata: { name: "A", image: "ipfs://x" }, resolvedUri: `data:application/json;base64,${json}` }]);
    expect(m.get(1)?.image).toMatch(/^data:image\/svg/);
  });
});
