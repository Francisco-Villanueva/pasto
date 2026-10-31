import { expect, test, type Page } from "@playwright/test";

/**
 * Corren contra `npm run dev:local`: incluye un pedido entregado hace 13 días (Sofía Díaz) con sus
 * tareas de seguimiento vencidas y la encuesta abierta.
 */

async function ingresarComoAdmin(page: Page, destino: string) {
  await page.goto(destino);
  await page.getByLabel("Email").fill("admin@pasto.test");
  await page.getByLabel("Contraseña").fill("admin-dev-1234");
  await page.getByRole("button", { name: "Ingresar" }).click();
}

test.describe("seguimiento y encuesta", () => {
  test("de la tarea a la encuesta y al promedio", async ({ page }) => {
    await ingresarComoAdmin(page, "/admin/crm");
    const fila = page.getByRole("row").filter({ hasText: "Encuesta a los 12 días" });
    await expect(fila.getByText("Sofía Díaz")).toBeVisible();

    // El mensaje de WhatsApp lleva el link privado de la encuesta.
    const whatsapp = await fila.getByRole("link", { name: "Abrir WhatsApp" }).getAttribute("href");
    const link = decodeURIComponent(whatsapp ?? "").match(/\/evaluacion\/[0-9a-f-]{36}/)?.[0];
    expect(link).toBeTruthy();

    await page.goto(link!);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const plato = page.getByRole("region", { name: "Guiso de lentejas" });
    await plato
      .getByRole("group", { name: /^Nota general/ })
      .getByRole("button", { name: "5" })
      .click();
    await plato.getByRole("button", { name: /^Guardar/ }).click();
    await expect(plato.getByText("Guardado")).toBeVisible();

    await page.goto("/admin/encuestas");
    await expect(page.getByRole("row").filter({ hasText: "Guiso de lentejas" })).toContainText(
      "5,0",
    );
  });

  test("omitir una tarea pide el motivo", async ({ page }) => {
    await ingresarComoAdmin(page, "/admin/crm");
    await page.getByRole("button", { name: "Omitir" }).first().click();
    await page.getByRole("button", { name: "Omitir tarea" }).click();
    await expect(page.getByRole("alert")).toContainText("Escribí por qué la omitís");
  });

  test("un link de encuesta inventado da 404", async ({ page }) => {
    const response = await page.goto("/evaluacion/00000000-0000-4000-8000-000000000000");
    expect(response?.status()).toBe(404);
  });
});
