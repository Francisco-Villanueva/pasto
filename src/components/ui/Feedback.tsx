import { Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button, Wave } from "@design/react";
import { cx } from "./cx";
import { Icon } from "./Icon";

type NoticeProps = {
  tone?: "neutral" | "brand";
  /** "alert" para avisos que bloquean algo (ej. complemento sin pack). */
  role?: "status" | "alert";
  icon?: LucideIcon;
  children: ReactNode;
};

export function Notice({ tone = "neutral", role, icon, children }: NoticeProps) {
  const glyph = icon ?? (tone === "brand" ? TriangleAlert : Info);
  return (
    <div className={cx("pasto-notice", tone === "brand" && "pasto-notice--brand")} role={role}>
      <span className="pasto-notice__icon">
        <Icon icon={glyph} />
      </span>
      <span>{children}</span>
    </div>
  );
}

type ProgressProps = { value: number; max: number; label: string };

/** Barra de avance (ej. unidades elegidas de un pack). */
export function Progress({ value, max, label }: ProgressProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className="pasto-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

type StatProps = { label: string; value: ReactNode; note?: string };

export function Stat({ label, value, note }: StatProps) {
  return (
    <div className="pasto-stat">
      <span className="label muted">{label}</span>
      <span className="pasto-stat__value">{value}</span>
      {note && <span className="body-sm muted">{note}</span>}
    </div>
  );
}

type EmptyProps = {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: { label: string; href: string };
};

/** Estado vacío o de error: dice qué pasó y qué hacer, con una sola acción. */
export function EmptyState({ icon, title, children, action }: EmptyProps) {
  return (
    <div className="pasto-empty">
      <span className="pasto-empty__icon">
        <Icon icon={icon} size={28} />
      </span>
      <h2 className="heading">{title}</h2>
      {children && <p className="muted">{children}</p>}
      {action && <Button href={action.href}>{action.label}</Button>}
    </div>
  );
}

type PageHeadProps = { label: string; title: string; children?: ReactNode };

/** Rótulo, titular display con la onda terracota y, opcional, una bajada. */
export function PageHead({ label, title, children }: PageHeadProps) {
  return (
    <div className="pasto-pagehead">
      <span className="label">{label}</span>
      <h1 className="display-lg">{title}</h1>
      <Wave />
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

export function Panel({
  label,
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("pasto-panel", className)}>
      {label && <span className="label">{label}</span>}
      {children}
    </section>
  );
}

/** Bloque de color con el nombre del plato, hasta que haya fotos reales. */
export function Plate({
  name,
  small,
  tone = "verde",
}: {
  name: string;
  small?: boolean;
  tone?: "verde" | "cafe";
}) {
  return (
    <div
      className={cx(
        "pasto-plate",
        small && "pasto-plate--sm",
        tone === "cafe" && "pasto-plate--cafe",
      )}
      role="img"
      aria-label={name}
    >
      {name.split(" ")[0]}
    </div>
  );
}
