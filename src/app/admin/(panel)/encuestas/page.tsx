import type { Metadata } from "next";
import {
  ChefHat,
  MessageSquareText,
  MessagesSquare,
  Star,
  TriangleAlert,
  Utensils,
} from "lucide-react";
import { EmptyState, Icon, PageHead } from "@/components/ui";
import { getDb } from "@/db";
import { PORTION_LABEL, PORTION_SIZES, type ProductSummary } from "@/domain/survey";
import { requireStaff } from "@/server/auth/dal";
import { loadSurveySummaries } from "@/server/survey";

export const metadata: Metadata = { title: "Encuestas" };

/** Debajo de este promedio general un plato se marca para revisar la receta. */
const REVIEW_BELOW = 3.5;

const score = (value: number | null) => (value === null ? "-" : value.toFixed(1).replace(".", ","));

const PORTION_TONE = { MUY_CHICA: "cobre", ADECUADA: "verde", MUY_GRANDE: "terracota" } as const;

function Stars({ value }: { value: number | null }) {
  const rounded = value === null ? 0 : Math.round(value);
  return (
    <span
      className="pasto-stars"
      role="img"
      aria-label={value === null ? "Sin puntaje" : `${score(value)} de 5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={18}
          strokeWidth={2}
          aria-hidden="true"
          className={n <= rounded ? "is-on" : undefined}
        />
      ))}
    </span>
  );
}

function RatingBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="pasto-rating">
      <span>{label}</span>
      <span className="pasto-rating__track" aria-hidden="true">
        <i style={{ width: `${((value ?? 0) / 5) * 100}%` }} />
      </span>
      <b className="num">{score(value)}</b>
    </div>
  );
}

function DishCard({ s }: { s: ProductSummary }) {
  const toReview = s.avgOverall !== null && s.avgOverall < REVIEW_BELOW;
  const portionTotal = PORTION_SIZES.reduce((sum, p) => sum + s.portions[p], 0);
  return (
    <li className={toReview ? "pasto-dish is-review" : "pasto-dish"}>
      <div className="pasto-dish__head">
        <div className="stack" style={{ gap: 2 }}>
          <b className="title">{s.productName}</b>
          <span className="caption muted">
            Receta {s.recipeVersion} · {s.responses}{" "}
            {s.responses === 1 ? "respuesta" : "respuestas"}
          </span>
        </div>
        <div className="pasto-dish__score">
          <span className="pasto-dish__num num">{score(s.avgOverall)}</span>
          <Stars value={s.avgOverall} />
        </div>
      </div>

      {toReview && (
        <span className="pasto-flagtag">
          <Icon icon={TriangleAlert} size={12} /> Para revisar la receta
        </span>
      )}

      <div className="stack" style={{ gap: "var(--space-2)" }}>
        <RatingBar label="Sabor" value={s.avgFlavor} />
        <RatingBar label="Textura" value={s.avgTexture} />
      </div>

      <div className="stack" style={{ gap: "var(--space-2)" }}>
        <span className="caption muted pasto-iconline">
          <Icon icon={Utensils} size={14} /> Porción
        </span>
        {portionTotal === 0 ? (
          <span className="caption muted">Sin datos de porción.</span>
        ) : (
          <>
            <div className="pasto-portion" aria-hidden="true">
              {PORTION_SIZES.filter((p) => s.portions[p] > 0).map((p) => (
                <i
                  key={p}
                  className={`pasto-bar--${PORTION_TONE[p]}`}
                  style={{ flexGrow: s.portions[p] }}
                />
              ))}
            </div>
            <ul className="pasto-portion__legend caption">
              {PORTION_SIZES.map((p) => (
                <li key={p}>
                  <span className={`pasto-dot pasto-dot--${PORTION_TONE[p]}`} aria-hidden="true" />
                  {PORTION_LABEL[p]}: <b className="num">{s.portions[p]}</b>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {s.notTested > 0 && (
        <span className="caption muted">
          {s.notTested} {s.notTested === 1 ? "persona no lo probó" : "personas no lo probaron"}
        </span>
      )}

      {s.comments.length > 0 && (
        <details className="pasto-dish__comments">
          <summary>
            <Icon icon={MessageSquareText} size={16} />
            {s.comments.length === 1 ? "1 comentario" : `${s.comments.length} comentarios`}
          </summary>
          <ul>
            {s.comments.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

export default async function EncuestasPage() {
  await requireStaff("SURVEYS_VIEW");
  const summaries = await loadSurveySummaries(await getDb());

  const responses = summaries.reduce((sum, s) => sum + s.responses, 0);
  const rated = summaries.filter((s) => s.avgOverall !== null);
  const weighted = rated.reduce((sum, s) => sum + (s.avgOverall ?? 0) * s.responses, 0);
  const ratedResponses = rated.reduce((sum, s) => sum + s.responses, 0);
  const average = ratedResponses > 0 ? weighted / ratedResponses : null;
  const toReview = summaries.filter((s) => s.avgOverall !== null && s.avgOverall < REVIEW_BELOW);
  const comments = summaries.reduce((sum, s) => sum + s.comments.length, 0);

  // Lo que hay que revisar primero, después de peor a mejor puntaje.
  const sorted = [...summaries].sort(
    (a, b) => (a.avgOverall ?? 6) - (b.avgOverall ?? 6) || b.responses - a.responses,
  );

  return (
    <>
      <PageHead label="ENCUESTAS" title="Encuestas">
        Promedio por plato y versión de receta. Cuando cambia la receta, el promedio arranca de
        cero.
      </PageHead>

      {summaries.length === 0 ? (
        <EmptyState icon={Star} title="Todavía no hay respuestas">
          Las encuestas se envían a los 12 días de la entrega desde Seguimiento.
        </EmptyState>
      ) : (
        <>
          <section className="pasto-kpis" aria-label="Resumen de respuestas">
            <div className="pasto-kpi">
              <Icon icon={Star} size={22} />
              <span className="pasto-kpi__num num">{score(average)}</span>
              <span className="body-sm muted">puntaje general promedio</span>
            </div>
            <div className="pasto-kpi">
              <Icon icon={MessagesSquare} size={22} />
              <span className="pasto-kpi__num num">{responses}</span>
              <span className="body-sm muted">
                {responses === 1 ? "respuesta" : "respuestas"} · {comments}{" "}
                {comments === 1 ? "comentario" : "comentarios"}
              </span>
            </div>
            <div className={toReview.length > 0 ? "pasto-kpi is-alert" : "pasto-kpi"}>
              <Icon icon={toReview.length > 0 ? TriangleAlert : ChefHat} size={22} />
              <span className="pasto-kpi__num num">{toReview.length}</span>
              <span className="body-sm muted">
                {toReview.length === 1 ? "plato" : "platos"} para revisar (menos de{" "}
                {String(REVIEW_BELOW).replace(".", ",")})
              </span>
            </div>
          </section>

          <ul className="pasto-dishes">
            {sorted.map((s) => (
              <DishCard key={`${s.productId}-${s.recipeVersion}`} s={s} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
