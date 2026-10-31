"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@design/react";
import { CalendarCheck, Clock, Plus, Route, Save, ShoppingBag, Timer, Trash2 } from "lucide-react";
import {
  Icon,
  Notice,
  Panel,
  Status,
  Switch,
  TextareaField,
  TextField,
  useToast,
} from "@/components/ui";
import { formatDeliveryDay } from "@/domain/schedule";
import type { AgendaData, AgendaDay } from "@/server/admin-agenda";
import {
  saveGeneralAction,
  saveShippingAction,
  updateDayAction,
  type AgendaActionResult,
} from "@/app/admin/(panel)/agenda/actions";

const linesToSlots = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** "1.500,50" o "1500" → centavos; NaN si no es un importe válido. */
function pesosToCents(text: string): number {
  const clean = text.trim().replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return Number.NaN;
  return Math.round(Number(clean) * 100);
}

const centsToPesos = (cents: number) => String(cents / 100).replace(".", ",");

/** Corre una acción del servidor y muestra el resultado: aviso de éxito o el error en pantalla. */
function useSave() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save(task: () => Promise<AgendaActionResult>, success: string) {
    setError(null);
    startTransition(async () => {
      const result = await task();
      if (result.ok) {
        toast(success);
        router.refresh();
      } else setError(result.message);
    });
  }
  return { save, pending, error };
}

function DayRow({ day }: { day: AgendaDay }) {
  const { save, pending, error } = useSave();
  const [isOpen, setIsOpen] = useState(day.isOpen);
  const [slots, setSlots] = useState(day.slots.join("\n"));
  const dirty = isOpen !== day.isOpen || linesToSlots(slots).join("|") !== day.slots.join("|");

  return (
    <li className={day.isOpen ? "pasto-day is-open" : "pasto-day"}>
      <div className="pasto-day__head">
        <b className="pasto-day__date">{formatDeliveryDay(day.date)}</b>
        <Status tone={day.isOpen ? "verde" : "hollow"} tag={day.isOpen ? "brand" : "outline"}>
          {day.isOpen ? "Abierto" : "Cerrado"}
        </Status>
      </div>
      <p className="pasto-day__facts caption">
        <span className="pasto-iconline">
          <Icon icon={Clock} size={14} />
          {day.cutoffPassed ? "Cerró" : "Cierra"} {day.cutoff}
        </span>
        <span className="pasto-iconline">
          <Icon icon={ShoppingBag} size={14} />
          {day.activeOrders === 0
            ? "Sin pedidos"
            : `${day.activeOrders} ${day.activeOrders === 1 ? "pedido" : "pedidos"}`}
        </span>
      </p>

      <Switch
        label="Recibir pedidos"
        checked={isOpen}
        onChange={(e) => setIsOpen(e.target.checked)}
      />
      <TextareaField
        label="Franjas (una por línea)"
        value={slots}
        rows={2}
        onChange={(e) => setSlots(e.target.value)}
      />
      {!isOpen && day.isOpen && day.activeOrders > 0 && (
        <Notice tone="brand">
          Ya hay pedidos para este día. Cerrarlo solo impide pedidos nuevos: los existentes siguen.
        </Notice>
      )}
      {error && (
        <Notice tone="brand" role="alert">
          {error}
        </Notice>
      )}
      <Button
        small
        variant="secondary"
        disabled={pending || !dirty}
        onClick={() =>
          save(
            () => updateDayAction({ date: day.date, isOpen, slots: linesToSlots(slots) }),
            "Día guardado",
          )
        }
      >
        <Icon icon={Save} size={16} /> {dirty ? "Guardar cambios" : "Sin cambios"}
      </Button>
    </li>
  );
}

const toNumber = (text: string) => Number(text.trim().replace(",", "."));

/** Regla de distancias: cada tramo como un segmento proporcional a sus kilómetros, con su costo. */
function TierRuler({ rows, maxKm }: { rows: { km: string; fee: string }[]; maxKm: string }) {
  const stops = rows
    .map((r) => ({ km: toNumber(r.km), fee: pesosToCents(r.fee) }))
    .filter((r) => Number.isFinite(r.km) && r.km > 0)
    .sort((a, b) => a.km - b.km);
  if (stops.length === 0) return null;
  const limit = Math.max(toNumber(maxKm) || 0, stops[stops.length - 1]!.km);
  return (
    <ol className="pasto-ruler" aria-label="Resumen de tramos">
      {stops.map((stop, i) => {
        const from = i === 0 ? 0 : stops[i - 1]!.km;
        const width = ((stop.km - from) / limit) * 100;
        const label = `${String(from).replace(".", ",")} a ${String(stop.km).replace(".", ",")} km`;
        return (
          <li key={i} style={{ flexBasis: `${width}%` }}>
            <span className="pasto-ruler__fee num">
              {Number.isNaN(stop.fee) ? "—" : `$${(stop.fee / 100).toLocaleString("es-AR")}`}
            </span>
            <span className="pasto-ruler__km caption">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ShippingForm({ data }: { data: AgendaData }) {
  const { save, pending, error } = useSave();
  const [maxKm, setMaxKm] = useState(String(data.maxDistanceM / 1000).replace(".", ","));
  const [rows, setRows] = useState(
    data.tiers.map((t) => ({
      km: String(t.upToM / 1000).replace(".", ","),
      fee: centsToPesos(t.feeCents),
    })),
  );

  const kmToM = (text: string) => Math.round(Number(text.trim().replace(",", ".")) * 1000);

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save(
          () =>
            saveShippingAction({
              maxDistanceM: kmToM(maxKm),
              tiers: rows.map((r) => ({ upToM: kmToM(r.km), feeCents: pesosToCents(r.fee) })),
            }),
          "Tramos guardados",
        );
      }}
    >
      <p className="muted body-sm">
        El costo se calcula con la distancia por calle desde el local. Cada tramo vale hasta la
        distancia indicada.
      </p>
      <TierRuler rows={rows} maxKm={maxKm} />
      {rows.map((row, i) => (
        <div key={i} className="pasto-tier">
          <TextField
            label={`Tramo ${i + 1}: hasta (km)`}
            inputMode="decimal"
            value={row.km}
            onChange={(e) =>
              setRows(rows.map((r, j) => (j === i ? { ...r, km: e.target.value } : r)))
            }
          />
          <TextField
            label={`Tramo ${i + 1}: costo ($)`}
            inputMode="decimal"
            value={row.fee}
            onChange={(e) =>
              setRows(rows.map((r, j) => (j === i ? { ...r, fee: e.target.value } : r)))
            }
          />
          <div>
            <Button
              type="button"
              small
              variant="ghost"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
            >
              <Icon icon={Trash2} size={16} /> Quitar tramo {i + 1}
            </Button>
          </div>
        </div>
      ))}
      <div>
        <Button
          type="button"
          small
          variant="secondary"
          onClick={() => setRows([...rows, { km: "", fee: "" }])}
        >
          <Icon icon={Plus} size={16} /> Agregar tramo
        </Button>
      </div>
      <TextField
        label="Radio máximo de entrega (km)"
        hint="Más lejos que esto no se entrega."
        inputMode="decimal"
        value={maxKm}
        onChange={(e) => setMaxKm(e.target.value)}
      />
      {error && (
        <Notice tone="brand" role="alert">
          {error}
        </Notice>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          <Icon icon={Save} /> Guardar tramos
        </Button>
      </div>
    </form>
  );
}

function GeneralForm({ data }: { data: AgendaData }) {
  const { save, pending, error } = useSave();
  const [hours, setHours] = useState(String(data.abandonAfterHours ?? 0));
  const [slots, setSlots] = useState(data.defaultSlots.join("\n"));

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save(
          () =>
            saveGeneralAction({
              abandonAfterHours: Number(hours.trim() === "" ? Number.NaN : hours),
              defaultSlots: linesToSlots(slots),
            }),
          "Ajustes guardados",
        );
      }}
    >
      <TextField
        label="Cancelar pedidos preliminares sin confirmar después de (horas)"
        hint="0 desactiva la cancelación automática. Un pedido cancelado se puede reactivar."
        inputMode="numeric"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
      />
      <TextareaField
        label="Franjas para las fechas nuevas (una por línea)"
        hint="No cambia las fechas que ya están en la agenda."
        rows={3}
        value={slots}
        onChange={(e) => setSlots(e.target.value)}
      />
      {error && (
        <Notice tone="brand" role="alert">
          {error}
        </Notice>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          <Icon icon={Save} /> Guardar ajustes
        </Button>
      </div>
    </form>
  );
}

export function AgendaEditor({ data }: { data: AgendaData }) {
  return (
    <>
      <section className="stack" aria-labelledby="ag-dias">
        <h2 id="ag-dias" className="heading pasto-h-icon">
          <Icon icon={CalendarCheck} size={22} /> Días de entrega
        </h2>
        <p className="muted body-sm">
          Los miércoles se abren solos. Los viernes y los feriados los abrís o cerrás acá.
        </p>
        <ul className="pasto-days">
          {data.days.map((day) => (
            <DayRow key={`${day.date}-${day.isOpen}-${day.slots.join("|")}`} day={day} />
          ))}
        </ul>
      </section>

      <div className="pasto-agenda-settings">
        <section className="stack" aria-labelledby="ag-envio">
          <h2 id="ag-envio" className="heading pasto-h-icon">
            <Icon icon={Route} size={22} /> Envío por distancia
          </h2>
          <Panel>
            <ShippingForm key={JSON.stringify(data.tiers) + data.maxDistanceM} data={data} />
          </Panel>
        </section>

        <section className="stack" aria-labelledby="ag-general">
          <h2 id="ag-general" className="heading pasto-h-icon">
            <Icon icon={Timer} size={22} /> Pedidos sin confirmar
          </h2>
          <Panel>
            <GeneralForm
              key={`${data.abandonAfterHours}-${data.defaultSlots.join("|")}`}
              data={data}
            />
          </Panel>
        </section>
      </div>
    </>
  );
}
