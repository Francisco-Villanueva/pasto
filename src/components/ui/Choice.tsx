import type { InputHTMLAttributes, ReactNode } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> & {
  type?: "radio" | "checkbox";
  title: string;
  description?: ReactNode;
};

/** Opción en tarjeta para elegir un día, un horario o un medio de pago. */
export function ChoiceOption({ type = "radio", title, description, ...input }: Props) {
  return (
    <label className="pasto-option">
      <input type={type} {...input} />
      <span className="stack" style={{ gap: 2 }}>
        <span className="title">{title}</span>
        {description && <span className="body-sm muted">{description}</span>}
      </span>
    </label>
  );
}

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> & {
  label: string;
};

/** Interruptor para opciones sí/no (consentimiento, abrir un viernes). */
export function Switch({ label, ...input }: SwitchProps) {
  return (
    <label className="pasto-switch">
      <input type="checkbox" role="switch" {...input} />
      <span>{label}</span>
    </label>
  );
}
