import { createInterface } from "node:readline";
import { getDb } from "../src/db";
import { createStaffUser } from "../src/server/auth/users";

/**
 * Crea un usuario del staff. Dos formas equivalentes:
 *
 *   npm run staff:create -- --email ana@pasto.com --role ADMIN --name "Ana"
 *   npm run staff:create ana@pasto.com ADMIN "Ana"          (sin etiquetas: sirve en PowerShell)
 *
 * La contraseña se pide por pantalla (no se muestra) o se toma de STAFF_PASSWORD. Usa la base de
 * DATABASE_URL de .env.local: para otra rama de Neon, pasá DATABASE_URL en la línea de comandos.
 */
const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));

function arg(name: string, position: number): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : positional[position];
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const mutable = rl as unknown as { _writeToOutput: (text: string) => void };
    let asked = false;
    mutable._writeToOutput = () => {
      // Muestra la pregunta una vez y oculta lo que se escribe.
      if (!asked) {
        process.stdout.write(question);
        asked = true;
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const email = arg("email", 0);
  const role = arg("role", 1)?.toUpperCase();
  if (!email || (role !== "ADMIN" && role !== "COCINA")) {
    console.error('Uso: npm run staff:create <email> ADMIN|COCINA ["Nombre"]');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("Falta DATABASE_URL (completá app/.env.local).");
    process.exit(1);
  }

  const password =
    process.env.STAFF_PASSWORD ?? (await askHidden("Contraseña (mínimo 10 caracteres): "));
  const result = await createStaffUser(await getDb(), {
    email,
    password,
    role,
    fullName: arg("name", 2),
  });

  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
  console.log(`Listo: ${result.user.email} (${result.user.role}).`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
