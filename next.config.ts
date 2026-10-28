import path from "node:path";
import type { NextConfig } from "next";

// design/ vive fuera de app/ y sus componentes importan react: sin node_modules arriba
// de esa carpeta, hay que decirle al bundler dónde está (ver también paths en tsconfig.json).
const react = "./node_modules/react";

const nextConfig: NextConfig = {
  // Base en memoria de desarrollo (WASM): se carga desde node_modules, no se empaqueta.
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    root: path.join(import.meta.dirname, ".."),
    resolveAlias: {
      react,
      "react/jsx-runtime": `${react}/jsx-runtime`,
      "react/jsx-dev-runtime": `${react}/jsx-dev-runtime`,
    },
  },
};

export default nextConfig;
