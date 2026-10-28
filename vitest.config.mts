import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@design": fileURLToPath(new URL("../design", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Postgres en memoria (PGlite) tarda en arrancar, sobre todo con otros procesos corriendo.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
