import { expect, test, type Page } from "@playwright/test";

/** Corren contra `npm run dev:local`: base en memoria con pedidos de ejemplo y los usuarios de prueba. */

async function ingresar(page: Page, email: string, password: string, destino: string) {
  await page.goto(destino);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

test.describe("agenda, producción y panel", () => {
  test("el panel muestra los números del día a administración", async ({ page }) => {
    await ingresar(page, "admin@pasto.test", "admin-dev-1234", "/admin/dashboard");
    await expect(page.getByText("Por confirmar")).toBeVisible();
    await expect(page.getByText("Próxima entrega")).toBeVisible();
  });

  test("administración abre un viernes en la agenda", async ({ page }) => {
    await ingresar(page, "admin@pasto.test", "admin-dev-1234", "/admin/agenda");
    await expect(page.getByRole("heading", { name: "Días de entrega" })).toBeVisible();

    const viernes = page.getByRole("listitem").filter({ hasText: "Viernes" }).last();
    await viernes.getByRole("switch").check();
    await viernes.getByRole("button", { name: "Guardar día" }).click();
    await expect(viernes.getByText("Abierto")).toBeVisible();
  });

  test("Cocina ve producción sin importes y no entra a la agenda", async ({ page }) => {
    await ingresar(page, "cocina@pasto.test", "cocina-dev-1234", "/admin/produccion");
    await expect(page.getByRole("heading", { name: "Total por receta" })).toBeVisible();
    await expect(page.locator("main")).not.toContainText("$");

    await page.goto("/admin/agenda");
    await expect(page).not.toHaveURL(/\/admin\/agenda$/);
  });

  test("la tarea de abandono rechaza llamadas sin el secreto", async ({ request }) => {
    const response = await request.get("/api/cron/abandoned-orders");
    expect(response.status()).toBe(401);
  });
});
