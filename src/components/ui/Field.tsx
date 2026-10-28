import { useId } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx";

type ShellProps = {
  label: string;
  hint?: string;
  /** Mensaje de error. Se muestra con el prefijo "Revisá:" para no depender del color. */
  error?: string;
  className?: string;
};

type Ids = { id: string; describedBy: string | undefined; invalid: boolean };

function Shell({
  label,
  hint,
  error,
  className,
  render,
}: ShellProps & { render: (ids: Ids) => ReactNode }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("pasto-field", className)}>
      <label className="pasto-field__label" htmlFor={id}>
        {label}
      </label>
      {render({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <span className="pasto-field__hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="pasto-field__error" id={errorId}>
          Revisá: {error}
        </span>
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  className,
  ...input
}: ShellProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Shell
      {...{ label, hint, error, className }}
      render={({ id, describedBy, invalid }) => (
        <input
          className="pasto-input"
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          {...input}
        />
      )}
    />
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...select
}: ShellProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Shell
      {...{ label, hint, error, className }}
      render={({ id, describedBy, invalid }) => (
        <select
          className="pasto-select"
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          {...select}
        >
          {children}
        </select>
      )}
    />
  );
}

export function TextareaField({
  label,
  hint,
  error,
  className,
  ...textarea
}: ShellProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Shell
      {...{ label, hint, error, className }}
      render={({ id, describedBy, invalid }) => (
        <textarea
          className="pasto-textarea"
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          {...textarea}
        />
      )}
    />
  );
}
