import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/layout/PublicShell";
import { SurveyForm } from "@/components/store/SurveyForm";
import { Notice, PageHead } from "@/components/ui";
import { getDb, hasDatabase } from "@/db";
import { loadSurvey } from "@/server/survey";

// Link privado: no se indexa ni se guarda en caché, y no muestra datos personales.
export const metadata: Metadata = { title: "Tu opinión", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EvaluacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!hasDatabase()) notFound();

  const survey = await loadSurvey(await getDb(), token, new Date());
  if (survey.state === "NOT_FOUND") notFound();

  return (
    <PublicShell>
      <PageHead label="ENCUESTA" title="Contanos cómo te fue">
        Calificá los platos que probaste. Podés guardar de a uno y volver más tarde. No te pedimos
        ningún dato personal.
      </PageHead>
      {survey.state === "EXPIRED" ? (
        <Notice role="status">
          <span>
            <strong>Esta encuesta ya cerró.</strong> Igual, gracias por elegir PASTO.
          </span>
        </Notice>
      ) : (
        <SurveyForm token={token} dishes={survey.dishes} />
      )}
    </PublicShell>
  );
}
