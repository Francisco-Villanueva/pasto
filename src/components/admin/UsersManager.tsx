"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Tag } from "@design/react";
import { Modal, Notice, SelectField, Table, TextField, useToast } from "@/components/ui";
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
      <div>
        <Button onClick={() => setDialog({ kind: "create" })}>Nuevo usuario</Button>
      </div>

      {error && !dialog && (
        <Notice tone="brand" role="alert">
          {error}
        </Notice>
      )}

      <Table label="Usuarios del staff">
        <thead>
          <tr>
            <th scope="col">Persona</th>
            <th scope="col">Rol</th>
            <th scope="col">Estado</th>
            <th scope="col">Último ingreso</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <tr key={u.id}>
                <td>
                  <b>{u.fullName ?? u.email}</b>
                  {u.fullName && <div className="caption">{u.email}</div>}
                </td>
                <td>
                  {isSelf ? (
                    ROLE_LABEL[u.role]
                  ) : (
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
                </td>
                <td>
                  <Tag tone={u.isActive ? "brand" : "outline"}>
                    {u.isActive ? "Activo" : "De baja"}
                  </Tag>
                </td>
                <td>{u.lastLogin ?? "Nunca"}</td>
                <td>
                  <div className="row">
                    <Button
                      small
                      variant="secondary"
                      disabled={pending}
                      onClick={() => setDialog({ kind: "password", user: u })}
                    >
                      Nueva contraseña
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
                        {u.isActive ? "Dar de baja" : "Reactivar"}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

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
            Crear usuario
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
            Guardar contraseña
          </Button>
          <Button variant="ghost" onClick={close}>
            Volver
          </Button>
        </div>
      </Modal>
    </div>
  );
}
