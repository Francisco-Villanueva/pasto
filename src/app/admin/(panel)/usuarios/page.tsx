import type { Metadata } from "next";
import { UsersManager } from "@/components/admin/UsersManager";
import { PageHead } from "@/components/ui";
import { getDb } from "@/db";
import { formatDateTime } from "@/domain/schedule";
import { requireStaff } from "@/server/auth/dal";
import { listStaffUsers } from "@/server/staff-users";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsuariosPage() {
  const me = await requireStaff("USERS_MANAGE");
  const users = await listStaffUsers(await getDb());

  return (
    <>
      <PageHead label="USUARIOS" title="Usuarios del staff">
        Quién entra al backoffice y con qué rol. Dar de baja cierra sus sesiones al instante.
      </PageHead>
      <UsersManager
        currentUserId={me.id}
        users={users.map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          isActive: u.isActive,
          lastLogin: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : null,
        }))}
      />
    </>
  );
}
