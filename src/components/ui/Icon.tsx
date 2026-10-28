import type { LucideIcon } from "lucide-react";

/**
 * Íconos de Lucide con trazo redondeado y grosor parejo. Siempre acompañan a un texto,
 * así que van ocultos para lectores de pantalla. Incorporación al sistema (el manual no define íconos).
 */
export function Icon({ icon: Glyph, size = 18 }: { icon: LucideIcon; size?: number }) {
  return <Glyph className="pasto-icon" size={size} strokeWidth={2} aria-hidden="true" />;
}
