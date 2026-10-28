import Link from "next/link";
import { PublicShell } from "@/components/layout/PublicShell";
import { PageHead } from "@/components/ui";

const SCREENS = [
  {
    href: "/sistema/pantallas/pedido-enviado",
    title: "Pedido enviado",
    route: "/pedido/:numero",
    text: "Confirmación después del checkout, con acceso para reabrir WhatsApp.",
  },
  {
    href: "/sistema/pantallas/estados",
    title: "Estados vacíos y de error",
    route: "404, error, carrito vacío, sin días",
    text: "Qué pasó y qué hacer, con una sola acción.",
  },
  {
    href: "/sistema/pantallas/editor-pedido",
    title: "Editor de pedido",
    route: "/admin/pedidos/:id",
    text: "Edición completa hasta confirmar, con recálculo e historial de cambios.",
  },
  {
    href: "/sistema/pantallas/catalogo",
    title: "Catálogo",
    route: "/admin/catalogo",
    text: "Lista de platos y complementos con filtro, estado y versión de receta.",
  },
  {
    href: "/sistema/pantallas/plato",
    title: "Formulario de plato",
    route: "/admin/catalogo/:id",
    text: "Datos, alérgenos, macros, imagen, versión de receta y precio.",
  },
  {
    href: "/sistema/pantallas/usuarios",
    title: "Usuarios del staff",
    route: "/admin/usuarios",
    text: "Alta, baja y cambio de contraseña, con reglas para no quedarse sin administrador.",
  },
] as const;

export default function PantallasPage() {
  return (
    <PublicShell>
      <PageHead label="Referencia" title="Pantallas">
        Pantallas que no estaban en las vistas del sistema de diseño. Usan solo los tokens y los
        componentes de la app, con datos de ejemplo.
      </PageHead>
      <div className="grid grid-3">
        {SCREENS.map((screen) => (
          <Link
            key={screen.href}
            href={screen.href}
            className="pasto-panel"
            style={{ textDecoration: "none" }}
          >
            <span className="label muted">{screen.route}</span>
            <span className="title">{screen.title}</span>
            <span className="body-sm muted">{screen.text}</span>
          </Link>
        ))}
      </div>
    </PublicShell>
  );
}
