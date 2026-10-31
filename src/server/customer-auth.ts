import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { customerAccounts, customerSessions } from "@/db/schema";
import type { AppDb } from "@/db/types";
import type { GoogleIdentity } from "@/domain/google-oidc";

/** Cookie de la sesión del cliente y la del ingreso en curso (state, nonce y PKCE). */
export const CUSTOMER_COOKIE = "pasto_cuenta";
export const LOGIN_ATTEMPT_COOKIE = "pasto_oidc";

/** El cliente no es staff: la sesión dura 30 días. */
export const CUSTOMER_SESSION_TTL_MS = 30 * 86_400_000;

export type CustomerAccount = { id: string; email: string; fullName: string | null };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Crea la cuenta la primera vez y la reconoce por el `sub` de Google después (el email puede cambiar). */
export async function upsertCustomerAccount(
  db: AppDb,
  identity: GoogleIdentity,
  now: Date = new Date(),
): Promise<CustomerAccount> {
  const [account] = await db
    .insert(customerAccounts)
    .values({
      googleSub: identity.sub,
      email: identity.email,
      fullName: identity.name,
      lastLoginAt: now,
    })
    .onConflictDoUpdate({
      target: customerAccounts.googleSub,
      set: { email: identity.email, fullName: identity.name, lastLoginAt: now },
    })
    .returning({
      id: customerAccounts.id,
      email: customerAccounts.email,
      fullName: customerAccounts.fullName,
    });
  return account!;
}

export async function createCustomerSession(
  db: AppDb,
  accountId: string,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + CUSTOMER_SESSION_TTL_MS);
  await db.insert(customerSessions).values({ accountId, tokenHash: hashToken(token), expiresAt });
  await db
    .delete(customerSessions)
    .where(and(eq(customerSessions.accountId, accountId), lt(customerSessions.expiresAt, now)));
  return { token, expiresAt };
}

export async function findCustomerSession(
  db: AppDb,
  token: string | undefined,
  now: Date = new Date(),
): Promise<CustomerAccount | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const [row] = await db
    .select({
      id: customerAccounts.id,
      email: customerAccounts.email,
      fullName: customerAccounts.fullName,
    })
    .from(customerSessions)
    .innerJoin(customerAccounts, eq(customerAccounts.id, customerSessions.accountId))
    .where(
      and(eq(customerSessions.tokenHash, hashToken(token)), gt(customerSessions.expiresAt, now)),
    )
    .limit(1);
  return row ?? null;
}

export async function destroyCustomerSession(db: AppDb, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(customerSessions).where(eq(customerSessions.tokenHash, hashToken(token)));
}
