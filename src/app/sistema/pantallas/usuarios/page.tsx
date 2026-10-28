"use client";

import { useState } from "react";
import { Button } from "@design/react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  Modal,
  Notice,
  PageHead,
  SelectField,
  Status,
  Table,
  TextField,
  useToast,
} from "@/components/ui";

const USERS = [
  {
    id: "1",
    email: "ana@pasto.example",
    role: "Administración",
    active: true,
    since: "01/10/2026",
  },
  { id: "2", email: "cocina@pasto.example", role: "Cocina", active: true, since: "05/10/2026" },
  { id: "3", email: "ex@pasto.example", role: "Cocina", active: false, since: "02/10/2026" },
];

export default function UsuariosPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  return (
    <AdminShell role="ADMIN" current="/admin/usuarios">
      <div className="row-between">
        <PageHead label="Usuarios" title="Staff" />
        <Button onClick={() => setOpen(true)}>Nuevo usuario</Button>
      </div>
      <Notice>
        Cocina ve la hoja de producción sin importes. No se puede desactivar a la última persona con
        rol de administración, ni a uno mismo.
      </Notice>
      <Table label="Usuarios del staff">
        <thead>
          <tr>
            <th scope="col">Email</th>
            <th scope="col">Rol</th>
            <th scope="col">Estado</th>
            <th scope="col">Alta</th>
            <th scope="col">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {USERS.map((user) => (
            <tr key={user.id}>
              <td>
                <b>{user.email}</b>
              </td>
              <td>{user.role}</td>
              <td>
                {user.active ? (
                  <Status tone="verde" tag="brand">
                    Activo
                  </Status>
                ) : (
                  <Status tone="hollow">Inactivo</Status>
                )}
              </td>
              <td className="num">{user.since}</td>
              <td className="is-num">
                <Button
                  variant="ghost"
                  small
                  onClick={() => toast("Se envió el enlace para cambiar la contraseña")}
                >
                  Cambiar contraseña
                </Button>
                <Button variant="ghost" small>
                  {user.active ? "Desactivar" : "Reactivar"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo usuario">
        <TextField label="Email" type="email" placeholder="nombre@dominio.com" required />
        <SelectField label="Rol" defaultValue="COCINA">
          <option value="COCINA">Cocina</option>
          <option value="ADMIN">Administración</option>
        </SelectField>
        <p className="body-sm muted">
          Le llega un enlace para crear su contraseña. No compartimos contraseñas por chat.
        </p>
        <div className="row">
          <Button
            onClick={() => {
              setOpen(false);
              toast("Usuario creado");
            }}
          >
            Crear usuario
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </div>
      </Modal>
    </AdminShell>
  );
}
