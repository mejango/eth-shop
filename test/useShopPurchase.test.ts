import { describe, expect, it } from "vitest";
import { classifyPriceError } from "@/hooks/useShopPurchase";
import { BaseError, ContractFunctionRevertedError, HttpRequestError } from "viem";

describe("useShopPurchase", () => {
  describe("classifyPriceError", () => {
    it("returns no-feed when ContractFunctionRevertedError is in the cause chain", () => {
      const revertedError = new ContractFunctionRevertedError({
        reason: "No feed",
      } as never);
      const wrappedError = new BaseError("Contract execution failed", {
        cause: revertedError,
      });
      expect(classifyPriceError(wrappedError)).toBe("no-feed");
    });

    it("returns unavailable for HttpRequestError", () => {
      const error = Object.create(HttpRequestError.prototype);
      expect(classifyPriceError(error)).toBe("unavailable");
    });

    it("returns unavailable for unknown errors", () => {
      const error = new Error("Unknown error");
      expect(classifyPriceError(error)).toBe("unavailable");
    });

    it("returns unavailable for BaseError without revert in cause chain", () => {
      const innerError = new Error("Some other error");
      const wrappedError = new BaseError("Outer error", {
        cause: innerError,
      });
      expect(classifyPriceError(wrappedError)).toBe("unavailable");
    });
  });
});
