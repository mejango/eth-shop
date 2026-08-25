import { describe, expect, it } from "vitest";
import { classifyPriceError } from "@/hooks/useShopPurchase";
import { ContractFunctionRevertedError, HttpRequestError } from "viem";

describe("useShopPurchase", () => {
  describe("classifyPriceError", () => {
    it("returns no-feed for ContractFunctionRevertedError", () => {
      const error = Object.create(ContractFunctionRevertedError.prototype);
      error.name = "ContractFunctionRevertedError";
      expect(classifyPriceError(error)).toBe("no-feed");
    });

    it("returns unavailable for HttpRequestError", () => {
      const error = Object.create(HttpRequestError.prototype);
      error.name = "HttpRequestError";
      expect(classifyPriceError(error)).toBe("unavailable");
    });

    it("returns unavailable for unknown errors", () => {
      const error = new Error("Unknown error");
      expect(classifyPriceError(error)).toBe("unavailable");
    });
  });
});
