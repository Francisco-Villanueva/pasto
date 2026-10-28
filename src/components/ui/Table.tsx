import type { ReactNode } from "react";

type Props = {
  /** Nombre de la tabla para lectores de pantalla. */
  label: string;
  children: ReactNode;
};

/**
 * Tabla con desplazamiento horizontal en pantallas chicas. La región se puede enfocar
 * con el teclado para poder desplazarla. Usá <thead>, <tbody>, <th scope="col"> y
 * la clase `is-num` en las celdas numéricas.
 */
export function Table({ label, children }: Props) {
  return (
    <div className="pasto-table-wrap" role="region" aria-label={label} tabIndex={0}>
      <table className="pasto-table">{children}</table>
    </div>
  );
}

export function Timeline({
  items,
}: {
  items: readonly { id: string; when: string; who: string; what: ReactNode }[];
}) {
  return (
    <ol className="pasto-timeline">
      {items.map((item) => (
        <li key={item.id}>
          <span className="pasto-dot pasto-dot--verde" aria-hidden="true" />
          <div className="stack" style={{ gap: 2 }}>
            <span className="body-sm">{item.what}</span>
            <span className="caption muted">
              {item.who} · {item.when}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
