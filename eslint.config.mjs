import { fixupConfigRules } from "@eslint/compat";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...fixupConfigRules([...nextVitals, ...nextTypeScript]),
  prettier,
  {
    rules: {
      // These React Compiler diagnostics are eligibility checks. This app does
      // not enable the compiler, so adoption remains a deliberate state-model
      // migration rather than part of dependency maintenance. The wallet
      // connector layer (ported from revnet.money) relies on refs and
      // synchronous effect state updates in a few places that predate this.
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      // Same eligibility check, tripped by the ported reviewed-write hook's
      // `useCallback` (revnet.money disables it for the same reason).
      "react-hooks/preserve-manual-memoization": "off",
      // The ported `Input`/`Button` props interfaces extend an HTML attributes
      // type without adding members yet, matching revnet.money's source.
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts"]),
]);
