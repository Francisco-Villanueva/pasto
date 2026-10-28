import type { ReactNode } from "react";

type Props = {
  title: string;
  text?: string;
  media?: ReactNode;
  footer?: ReactNode;
  brand?: boolean;
  className?: string;
};

/** Tarjeta de producto o contenido. `brand` la pone en verde: una sola por fila. */
export function Card({ title, text, media, footer, brand, className }: Props) {
  return (
    <article className={["pasto-card", brand && "pasto-card--brand", className].filter(Boolean).join(" ")}>
      {media}
      <div className="pasto-card__body">
        <h3 className="pasto-card__title">{title}</h3>
        {text && <p className="pasto-card__text">{text}</p>}
        {footer && <div className="pasto-card__footer">{footer}</div>}
      </div>
    </article>
  );
}
