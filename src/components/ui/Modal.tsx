"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

type Props = {
  open: boolean;
  /** Se llama al cerrar con Esc. Las acciones del modal cierran desde su propio handler. */
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/**
 * Diálogo modal sobre <dialog>: el navegador atrapa el foco, lo devuelve al cerrar y cierra con Esc.
 * Pensado para decisiones que el cliente tiene que tomar (ej. plan incompatible en el carrito).
 */
export function Modal({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="pasto-modal" aria-labelledby={titleId} onClose={onClose}>
      <div className="pasto-modal__body">
        <h2 className="heading" id={titleId}>
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
