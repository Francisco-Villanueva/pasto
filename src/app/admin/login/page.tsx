import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wave } from "@design/react";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { homeFor, safeNextPath } from "@/domain/permissions";
import { getStaffUser } from "@/server/auth/dal";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getStaffUser();
  if (user) redirect(homeFor(user.role));

  const { next } = await searchParams;

  return (
    <main className="wrap page">
      <div
        className="stack-lg"
        style={{ maxWidth: 420, margin: "var(--space-12) auto 0", width: "100%" }}
      >
        <div className="stack">
          <Logo href="/" />
          <span className="label">BACKOFFICE</span>
          <h1 className="display-md">Ingresá a tu cuenta</h1>
          <Wave />
        </div>
        <LoginForm next={safeNextPath(next)} />
        {process.env.NODE_ENV === "development" && (
          <p className="caption muted">
            Desarrollo: <b>admin@pasto.test</b> / admin-dev-1234 · <b>cocina@pasto.test</b> /
            cocina-dev-1234
          </p>
        )}
        <div>
          <ThemeToggle />
        </div>
      </div>
    </main>
  );
}
