import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLSpanElement> & { tone?: "brand" | "neutral" | "outline" };

/** Etiqueta no interactiva. Para filtros usá Button con variant="ghost". */
export function Tag({ tone = "neutral", className, ...rest }: Props) {
  return <span className={["pasto-tag", `pasto-tag--${tone}`, className].filter(Boolean).join(" ")} {...rest} />;
}
