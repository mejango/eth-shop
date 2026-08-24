import { fixupConfigRules } from "@eslint/compat";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...fixupConfigRules([...nextVitals, ...nextTypeScript]),
  prettier,
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts"]),
]);
