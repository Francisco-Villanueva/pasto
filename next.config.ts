import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Base en memoria de desarrollo (WASM): se carga desde node_modules, no se empaqueta.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
