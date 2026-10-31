"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@design/react";
import { Check, MessageCircle, SkipForward } from "lucide-react";
import { Icon, Modal, Notice, TextareaField, useToast } from "@/components/ui";
import { resolveTaskAction } from "@/app/admin/(panel)/crm/actions";

type Props = { taskId: string; whatsappUrl: string };

/** WhatsApp con el mensaje armado, completar y omitir con motivo. El servidor valida cada cambio. */
export function CrmTaskActions({ taskId, whatsappUrl }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const [reason, setReason] = useState("");

  function resolve(outcome: "COMPLETADA" | "OMITIDA", notes?: string) {
    setError(null);
    startTransition(async () => {
      const result = await resolveTaskAction({ taskId, outcome, notes });
      if (result.ok) {
        toast(outcome === "COMPLETADA" ? "Tarea completada" : "Tarea omitida");
        setSkipOpen(false);
        setReason("");
        router.refresh();
      } else setError(result.message);
    });
  }

  return (
    <div className="stack" style={{ gap: "var(--space-2)" }}>
      <div className="row">
        <Button
          small
          variant="secondary"
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon icon={MessageCircle} size={16} /> Abrir WhatsApp
        </Button>
        <Button small disabled={pending} onClick={() => resolve("COMPLETADA")}>
          <Icon icon={Check} size={16} /> Completar
        </Button>
        <Button small variant="ghost" disabled={pending} onClick={() => setSkipOpen(true)}>
          <Icon icon={SkipForward} size={16} /> Omitir
        </Button>
      </div>
      {error && !skipOpen && (
        <span className="caption" role="alert">
          {error}
        </span>
      )}

      <Modal open={skipOpen} onClose={() => setSkipOpen(false)} title="Omitir tarea">
        <TextareaField
          label="Motivo"
          hint="Por ejemplo: no contesta, ya hablamos, pidió que no lo contactemos."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
        {error && (
          <Notice tone="brand" role="alert">
            {error}
          </Notice>
        )}
        <div className="row">
          <Button disabled={pending} onClick={() => resolve("OMITIDA", reason)}>
            Omitir tarea
          </Button>
          <Button variant="ghost" onClick={() => setSkipOpen(false)}>
            Volver
          </Button>
        </div>
      </Modal>
    </div>
  );
}
