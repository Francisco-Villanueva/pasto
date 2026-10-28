"use client";

import { cx } from "./cx";

type Option<T extends string | number> = { value: T; label: string; disabled?: boolean };

type Props<T extends string | number> = {
  /** Nombre del grupo para lectores de pantalla (ej. "Tamaño del pack"). */
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** Selector de una opción entre pocas (plan, tamaño, tipo de entrega). */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: Props<T>) {
  return (
    <div className={cx("pasto-seg", className)} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
