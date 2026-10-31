import { hash, verify } from "@node-rs/argon2";

export const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 200;

/** Argon2id con los parámetros mínimos que recomienda OWASP (19 MiB, 2 pasadas). */
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/** Mensaje si la contraseña no cumple los requisitos; null si está bien. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) return "La contraseña es demasiado larga.";
  if (password.trim() === "") return "La contraseña no puede ser solo espacios.";
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // Un hash dañado cuenta como contraseña incorrecta, nunca como error del servidor.
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Gasta el mismo tiempo que una verificación real. Se usa cuando el email no existe o la cuenta está
 * inactiva, para que el tiempo de respuesta no revele qué emails tienen cuenta.
 */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword("contraseña-que-nadie-usa");
  await verifyPassword(await dummyHash, password);
}
