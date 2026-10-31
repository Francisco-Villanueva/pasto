import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `npm run dev:local` compila en otra carpeta para poder correr junto a `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Base en memoria de desarrollo (WASM): se carga desde node_modules, no se empaqueta.
  serverExternalPackages: ["@electric-sql/pglite", "@node-rs/argon2"],
};

export default nextConfig;
