"use client";

import { useActionState } from "react";
import { Button } from "@design/react";
import { Notice, TextField } from "@/components/ui";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form className="stack" action={action}>
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && (
        <Notice tone="brand" role="alert">
          {state.error}
        </Notice>
      )}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        defaultValue={state.email}
        required
      />
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
      <p className="caption muted">Acceso para administración y cocina.</p>
    </form>
  );
}
