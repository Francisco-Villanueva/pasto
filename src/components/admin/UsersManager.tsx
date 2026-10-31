"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@design/react";
import {
  ChefHat,
  Clock,
  KeyRound,
  Plus,
  Save,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { Icon, Modal, Notice, SelectField, Status, TextField, useToast } from "@/components/ui";
import {
  createUserAction,
  resetUserPasswordAction,
  setUserActiveAction,
  setUserRoleAction,
  type UsersActionResult,
} from "@/app/admin/(panel)/usuarios/actions";

export type UserRow = {
  id: string;
  email: string;
  fullName: string | null;
  role: "ADMIN" | "COCINA";
  isActive: boolean;
  lastLogin: string | null;
};

const ROLE_LABEL = { ADMIN: "Administración", COCINA: "Cocina" } as const;

const ROLE_INFO: Record<UserRow["role"], { icon: LucideIcon; what: string }> = {
  ADMIN: {
    icon: ShieldCheck,
    what: "Ve y maneja todo: pedidos, importes, agenda, catálogo y usuarios.",
  },
  COCINA: {
    icon: ChefHat,
    what: "Solo ve Producción y marca los pedidos como cocinando o listos.",
  },
};

type Dialog = { kind: "create" } | { kind: "password"; user: UserRow } | null;

export function UsersManager({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", fullName: "", role: "COCINA", password: "" });

  function run(action: () => Promise<UsersActionResult>, done: string, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast(done);
        after?.();
        router.refresh();
      } else setError(result.message);
    });
  }

  function close() {
    setDialog(null);
    setError(null);
    setForm({ email: "", fullName: "", role: "COCINA", password: "" });
  }

  return (
    <div className="stack">
      <div className="pasto-roles">
        {(Object.keys(ROLE_INFO) as UserRow["role"][]).map((role) => {
          const info = ROLE_INFO[role];
          const total = users.filter((u) => u.role === role && u.isActive).length;
          return (
            <div key={role} className="pasto-roles__item">
              <span className="pasto-roles__icon">
                <Icon icon={info.icon} size={22} />
              </span>
              <div className="stack" style={{ gap: 2 }}>
                <b>
                  {ROLE_LABEL[role]} <span className="muted num">· {total} activos</span>
                </b>
                <span className="body-sm muted">{info.what}</span>
              </div>
            </div>
          );
        })}
        <Button onClick={() => setDialog({ kind: "create" })}>
          <Icon icon={Plus} /> Nuevo usuario
        </Button>
      </div>

      {error && !dialog && (
        <Notice tone="brand" role="alert">
          {error}
        </Notice>
      )}

      <ul className="pasto-users">
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          const roleIcon = ROLE_INFO[u.role].icon;
          return (
            <li key={u.id} className={u.isActive ? "pasto-user" : "pasto-user is-off"}>
              <div className="pasto-user__top">
                <span className="pasto-avatar pasto-user__avatar" aria-hidden="true">
                  {(u.fullName ?? u.email).trim().charAt(0).toUpperCase()}
                </span>
                <div className="pasto-user__who">
                  <b>
                    {u.fullName ?? u.email}
                    {isSelf && <span className="pasto-youtag">Vos</span>}
                  </b>
                  {u.fullName && <span className="caption muted">{u.email}</span>}
                </div>
                <Status
                  tone={u.isActive ? "verde" : "hollow"}
                  tag={u.isActive ? "brand" : "outline"}
                >
                  {u.isActive ? "Activo" : "De baja"}
                </Status>
              </div>

              <ul className="pasto-user__facts caption">
                <li>
                  <Icon icon={roleIcon} size={14} /> {ROLE_LABEL[u.role]}
                </li>
                <li>
                  <Icon icon={Clock} size={14} />{" "}
                  {u.lastLogin ? `Último ingreso ${u.lastLogin}` : "Todavía no ingresó"}
                </li>
              </ul>

              {!isSelf && (
                <SelectField
                  label={`Rol de ${u.email}`}
                  value={u.role}
                  disabled={pending}
                  onChange={(e) =>
                    run(
                      () => setUserRoleAction({ userId: u.id, role: e.target.value }),
                      "Rol actualizado",
                    )
                  }
                >
                  <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
                  <option value="COCINA">{ROLE_LABEL.COCINA}</option>
                </SelectField>
              )}

              <div className="row">
                <Button
                  small
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setDialog({ kind: "password", user: u })}
                >
                  <Icon icon={KeyRound} size={16} /> Nueva contraseña
                </Button>
                {!isSelf && (
                  <Button
                    small
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => setUserActiveAction({ userId: u.id, active: !u.isActive }),
                        u.isActive ? "Usuario dado de baja" : "Usuario reactivado",
                      )
                    }
                  >
                    <Icon icon={u.isActive ? UserX : UserCheck} size={16} />{" "}
                    {u.isActive ? "Dar de baja" : "Reactivar"}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Modal open={dialog?.kind === "create"} onClose={close} title="Nuevo usuario">
        <TextField
          label="Email"
          type="email"
          autoComplete="off"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <TextField
          label="Nombre"
          autoComplete="off"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        />
        <SelectField
          label="Rol"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="COCINA">{ROLE_LABEL.COCINA}</option>
          <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
        </SelectField>
        <TextField
          label="Contraseña inicial"
          type="password"
          autoComplete="new-password"
          hint="Al menos 10 caracteres. Pasásela por un canal privado."
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        {error && (
          <Notice tone="brand" role="alert">
            {error}
          </Notice>
        )}
        <div className="row">
          <Button
            disabled={pending}
            onClick={() => run(() => createUserAction(form), "Usuario creado", close)}
          >
            <Icon icon={UserPlus} /> Crear usuario
          </Button>
          <Button variant="ghost" onClick={close}>
            Volver
          </Button>
        </div>
      </Modal>

      <Modal
        open={dialog?.kind === "password"}
        onClose={close}
        title={dialog?.kind === "password" ? `Nueva contraseña de ${dialog.user.email}` : ""}
      >
        <TextField
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          hint="Se cierran todas sus sesiones abiertas."
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        {error && (
          <Notice tone="brand" role="alert">
            {error}
          </Notice>
        )}
        <div className="row">
          <Button
            disabled={pending}
            onClick={() =>
              dialog?.kind === "password" &&
              run(
                () => resetUserPasswordAction({ userId: dialog.user.id, password: form.password }),
                "Contraseña actualizada",
                close,
              )
            }
          >
            <Icon icon={Save} /> Guardar contraseña
          </Button>
          <Button variant="ghost" onClick={close}>
            Volver
          </Button>
        </div>
      </Modal>
    </div>
  );
}
