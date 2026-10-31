import { spawn } from "node:child_process";

/**
 * `npm run dev:local`: servidor de desarrollo con la base EN MEMORIA, aunque .env.local tenga la
 * DATABASE_URL de Neon. Así se prueba sin tocar datos reales. Compila en `.next-local`, por lo que
 * puede correr al mismo tiempo que `npm run dev`. Un valor vacío en el entorno tiene
 * prioridad sobre .env.local. Acepta los argumentos de `next dev` (por ejemplo `-p 3100`).
 */
const child = spawn("npx", ["next", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    DATABASE_URL: "",
    DATABASE_URL_UNPOOLED: "",
    // Carpeta de compilación propia: Next no deja dos servidores de desarrollo sobre la misma.
    NEXT_DIST_DIR: ".next-local",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
