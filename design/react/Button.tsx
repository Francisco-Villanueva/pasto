import type { ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

type Common = { variant?: Variant; small?: boolean; className?: string };
type AsButton = Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type AsLink = Common & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

const classes = ({ variant = "primary", small, className }: Common) =>
  ["pasto-btn", `pasto-btn--${variant}`, small && "pasto-btn--sm", className].filter(Boolean).join(" ");

/** Un solo primary por vista. Funciona como <button> o como <a> si recibe href. */
export function Button(props: AsButton | AsLink) {
  if ("href" in props && props.href) {
    const { variant, small, className, ...rest } = props as AsLink;
    return <a className={classes({ variant, small, className })} {...rest} />;
  }
  const { variant, small, className, type = "button", ...rest } = props as AsButton;
  return <button type={type} className={classes({ variant, small, className })} {...rest} />;
}
