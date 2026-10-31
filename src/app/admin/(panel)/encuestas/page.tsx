import type { Metadata } from "next";
import { Star } from "lucide-react";
import { EmptyState, PageHead, Table } from "@/components/ui";
import { getDb } from "@/db";
import { PORTION_LABEL, PORTION_SIZES } from "@/domain/survey";
import { requireStaff } from "@/server/auth/dal";
import { loadSurveySummaries } from "@/server/survey";

export const metadata: Metadata = { title: "Encuestas" };

const score = (value: number | null) => (value === null ? "-" : value.toFixed(1).replace(".", ","));

export default async function EncuestasPage() {
  await requireStaff("SURVEYS_VIEW");
  const summaries = await loadSurveySummaries(await getDb());

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
          <Table label="Promedios por plato">
            <thead>
              <tr>
                <th scope="col">Plato</th>
                <th scope="col">Receta</th>
                <th scope="col" className="is-num">
                  Respuestas
                </th>
                <th scope="col" className="is-num">
                  General
                </th>
                <th scope="col" className="is-num">
                  Sabor
                </th>
                <th scope="col" className="is-num">
                  Textura
                </th>
                <th scope="col">Porción</th>
                <th scope="col" className="is-num">
                  No lo probó
                </th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={`${s.productId}-${s.recipeVersion}`}>
                  <td>{s.productName}</td>
                  <td>{s.recipeVersion}</td>
                  <td className="is-num">{s.responses}</td>
                  <td className="is-num">{score(s.avgOverall)}</td>
                  <td className="is-num">{score(s.avgFlavor)}</td>
                  <td className="is-num">{score(s.avgTexture)}</td>
                  <td>
                    {PORTION_SIZES.filter((p) => s.portions[p] > 0)
                      .map((p) => `${PORTION_LABEL[p]}: ${s.portions[p]}`)
                      .join(" · ") || "-"}
                  </td>
                  <td className="is-num">{s.notTested}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          <section className="stack" aria-labelledby="comentarios">
            <h2 id="comentarios" className="heading">
              Comentarios
            </h2>
            {summaries
              .filter((s) => s.comments.length > 0)
              .map((s) => (
                <div key={`${s.productId}-${s.recipeVersion}`} className="pasto-panel stack">
                  <b>
                    {s.productName} ({s.recipeVersion})
                  </b>
                  <ul className="stack" style={{ margin: 0, paddingLeft: "var(--space-4)" }}>
                    {s.comments.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </section>
        </>
      )}
    </>
  );
}
