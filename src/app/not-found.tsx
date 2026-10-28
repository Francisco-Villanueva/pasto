import { Compass } from "lucide-react";
import { PublicShell } from "@/components/layout/PublicShell";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <PublicShell>
      <EmptyState
        icon={Compass}
        title="No encontramos esta página"
        action={{ label: "Volver al inicio", href: "/" }}
      >
        Puede que el enlace esté viejo o tenga un error. Desde el inicio llegás a todo.
      </EmptyState>
    </PublicShell>
  );
}
