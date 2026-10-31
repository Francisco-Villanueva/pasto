import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getDb, hasDatabase } from "@/db";
import { CUSTOMER_COOKIE, findCustomerSession, type CustomerAccount } from "./customer-auth";

/** El cliente con sesión, o null (invitado). Sin base de datos nunca hay sesión. */
export const getCustomer = cache(async (): Promise<CustomerAccount | null> => {
  if (!hasDatabase()) return null;
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  return findCustomerSession(await getDb(), token);
});
