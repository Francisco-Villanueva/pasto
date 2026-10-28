"use client";

type Props = {
  /** Qué se cuenta, para los botones (ej. "Milanesa de pollo napolitana"). */
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  /** Tope: con el valor al máximo se deshabilita el botón de sumar. */
  max?: number;
};

export function Counter({ label, value, onChange, min = 0, max }: Props) {
  return (
    <div className="pasto-counter">
      <button
        type="button"
        aria-label={`Quitar uno de ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output key={value} aria-live="polite" aria-label={`Cantidad de ${label}`}>
        {value}
      </output>
      <button
        type="button"
        aria-label={`Sumar uno de ${label}`}
        disabled={max !== undefined && value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
