import { describe, expect, it } from "vitest";
import { isRevnetFor, isRevnetOwner, mapAcceptedTokens, mergeTierMeta, resolvedMediaUrl } from "@/lib/shop";

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

describe("isRevnetOwner", () => {
  const REV_OWNER = "0x2ba4705ad0332cdfb299b452068438bcba3faaf3";

  it("matches when the project owner is the REVOwner singleton", () => {
    expect(isRevnetOwner(REV_OWNER, REV_OWNER)).toBe(true);
  });

  it("matches case-insensitively (checksum vs lowercase)", () => {
    expect(isRevnetOwner("0x2BA4705AD0332CdFB299B452068438bCba3faAf3", REV_OWNER)).toBe(true);
  });

  it("is false when the owner is some other address", () => {
    expect(isRevnetOwner("0x0000000000000000000000000000000000dEaD", REV_OWNER)).toBe(false);
  });

  it("is false when there's no REVOwner deployment on the chain", () => {
    expect(isRevnetOwner(REV_OWNER, null)).toBe(false);
  });
});

describe("mapAcceptedTokens", () => {
  const NATIVE = "0x000000000000000000000000000000000000EEEe";
  const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

  it("labels the native token ETH", () => {
    const result = mapAcceptedTokens([{ token: NATIVE, decimals: 18, currency: 1 }], 8453);
    expect(result).toEqual([{ token: NATIVE, decimals: 18, currency: 1, symbol: "ETH" }]);
  });

  it("matches the native token case-insensitively", () => {
    const result = mapAcceptedTokens(
      [{ token: NATIVE.toLowerCase() as `0x${string}`, decimals: 18, currency: 1 }],
      8453,
    );
    expect(result[0].symbol).toBe("ETH");
  });

  it("labels the chain's known USDC address USDC", () => {
    const result = mapAcceptedTokens([{ token: BASE_USDC, decimals: 6, currency: 2 }], 8453);
    expect(result).toEqual([{ token: BASE_USDC, decimals: 6, currency: 2, symbol: "USDC" }]);
  });

  it("matches USDC case-insensitively", () => {
    const result = mapAcceptedTokens(
      [{ token: BASE_USDC.toLowerCase() as `0x${string}`, decimals: 6, currency: 2 }],
      8453,
    );
    expect(result[0].symbol).toBe("USDC");
  });

  it("falls back to TOKEN for anything else", () => {
    const other = "0x0000000000000000000000000000000000dEaD";
    const result = mapAcceptedTokens([{ token: other, decimals: 18, currency: 2 }], 8453);
    expect(result[0].symbol).toBe("TOKEN");
  });

  it("falls back to TOKEN for USDC's address on a chain with no known USDC deployment", () => {
    // 8453's USDC address happens not to be registered for a chain id with no
    // USDC_ADDRESSES entry — using an unsupported chain id exercises that branch.
    const result = mapAcceptedTokens([{ token: BASE_USDC, decimals: 6, currency: 2 }], 999999 as never);
    expect(result[0].symbol).toBe("TOKEN");
  });

  it("maps multiple contexts independently", () => {
    const other = "0x0000000000000000000000000000000000dEaD";
    const result = mapAcceptedTokens(
      [
        { token: NATIVE, decimals: 18, currency: 1 },
        { token: BASE_USDC, decimals: 6, currency: 2 },
        { token: other, decimals: 18, currency: 2 },
      ],
      8453,
    );
    expect(result.map((r) => r.symbol)).toEqual(["ETH", "USDC", "TOKEN"]);
  });
});

describe("isRevnetFor", () => {
  const REV_OWNER = "0x2ba4705ad0332cdfb299b452068438bcba3faaf3";
  const OTHER_OWNER = "0x0000000000000000000000000000000000dEaD";

  it("chain wins: known owner IS the REVOwner, regardless of Bendystraw", () => {
    expect(isRevnetFor(REV_OWNER, REV_OWNER, false)).toBe(true);
  });

  it("chain wins: known owner is NOT the REVOwner, even if Bendystraw says isRevnet", () => {
    expect(isRevnetFor(OTHER_OWNER, REV_OWNER, true)).toBe(false);
  });

  it("falls back to Bendystraw's flag when the owner probe is null", () => {
    expect(isRevnetFor(null, REV_OWNER, true)).toBe(true);
    expect(isRevnetFor(null, REV_OWNER, false)).toBe(false);
  });
});
