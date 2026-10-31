import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([
    ".next/**",
    ".next-local/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "design/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
