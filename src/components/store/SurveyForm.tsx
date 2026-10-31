"use client";

import { useState, useTransition } from "react";
import { Button } from "@design/react";
import { Notice, Segmented, Switch, TextareaField } from "@/components/ui";
import { PORTION_LABEL, PORTION_SIZES, type PortionSize } from "@/domain/survey";
import type { SurveyDish } from "@/server/survey";
import { saveReviewAction } from "@/app/evaluacion/actions";

const SCORES = [1, 2, 3, 4, 5] as const;

function DishCard({ token, dish }: { token: string; dish: SurveyDish }) {
  const start = dish.review;
  const [notTested, setNotTested] = useState(start.notTestedYet);
  const [overall, setOverall] = useState<number | null>(start.ratingOverall);
  const [flavor, setFlavor] = useState<number | null>(start.ratingFlavor);
  const [texture, setTexture] = useState<number | null>(start.ratingTexture);
  const [portion, setPortion] = useState<PortionSize | null>(start.portionSize);
  const [comments, setComments] = useState(start.comments);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  // Segmented siempre tiene un valor elegido: 0 = todavía sin respuesta.
  const scoreOptions = SCORES.map((n) => ({ value: n, label: String(n) }));

  function save() {
    setStatus(null);
    startTransition(async () => {
      const result = await saveReviewAction({
        token,
        productId: dish.productId,
        review: notTested
          ? { notTestedYet: true }
          : {
              ratingOverall: overall,
              ratingFlavor: flavor,
              ratingTexture: texture,
              portionSize: portion,
              comments,
            },
      });
      setStatus(
        result.ok
          ? { ok: true, text: "Guardado. Si querés, podés cambiarlo más tarde." }
          : { ok: false, text: result.message },
      );
    });
  }

  return (
    <section className="pasto-panel stack" aria-label={dish.name}>
      <h2 className="heading">{dish.name}</h2>
      <Switch
        label="Todavía no lo probé"
        checked={notTested}
        onChange={(e) => setNotTested(e.target.checked)}
      />

      {!notTested && (
        <>
          {(
            [
              ["Nota general", overall, setOverall],
              ["Sabor", flavor, setFlavor],
              ["Textura", texture, setTexture],
            ] as const
          ).map(([label, value, set]) => (
            <div key={label} className="stack" style={{ gap: "var(--space-1)" }}>
              <span className="label">{label.toUpperCase()}</span>
              <Segmented
                label={`${label} de ${dish.name}, de 1 a 5`}
                options={scoreOptions}
                value={value ?? 0}
                onChange={(n) => set(n)}
              />
            </div>
          ))}
          <div className="stack" style={{ gap: "var(--space-1)" }}>
            <span className="label">PORCIÓN</span>
            <Segmented
              label={`Porción de ${dish.name}`}
              options={PORTION_SIZES.map((p) => ({ value: p, label: PORTION_LABEL[p] }))}
              value={portion ?? ("" as PortionSize)}
              onChange={setPortion}
            />
          </div>
          <TextareaField
            label="Comentarios (opcional)"
            rows={3}
            maxLength={1000}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </>
      )}

      {status && (
        <Notice tone={status.ok ? "neutral" : "brand"} role={status.ok ? "status" : "alert"}>
          {status.text}
        </Notice>
      )}
      <div>
        <Button disabled={pending} onClick={save}>
          Guardar {dish.name}
        </Button>
      </div>
    </section>
  );
}

export function SurveyForm({ token, dishes }: { token: string; dishes: SurveyDish[] }) {
  return (
    <div className="stack">
      {dishes.map((dish) => (
        <DishCard key={dish.productId} token={token} dish={dish} />
      ))}
    </div>
  );
}
