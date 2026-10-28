"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

type ToastItem = { id: number; message: string; leaving?: boolean };
type ToastApi = { toast: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS = 3200;
/** Coincide con --dur-base: el aviso baja antes de salir del DOM. */
const LEAVE_MS = 240;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string) => {
    const id = nextId.current++;
    setItems((current) => [...current, { id, message }]);
    setTimeout(
      () =>
        setItems((current) =>
          current.map((item) => (item.id === id ? { ...item, leaving: true } : item)),
        ),
      DURATION_MS - LEAVE_MS,
    );
    setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), DURATION_MS);
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext value={api}>
      {children}
      <div className="pasto-toasts" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={item.leaving ? "pasto-toast is-leaving" : "pasto-toast"}>
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

/** Confirmaciones breves ("Pack agregado"). Los errores y bloqueos van en un Notice, no en un toast. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast necesita estar dentro de <ToastProvider>.");
  return api;
}
