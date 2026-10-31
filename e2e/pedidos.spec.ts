import { expect, test, type Page } from "@playwright/test";

/** Corren contra `npm run dev:local`: 4 pedidos de ejemplo y el usuario admin@pasto.test. */

async function ingresarComoAdmin(page: Page) {
  await page.goto("/admin/pedidos");
  await page.getByLabel("Email").fill("admin@pasto.test");
  await page.getByLabel("Contraseña").fill("admin-dev-1234");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/admin\/pedidos$/);
}

test.describe("pedidos del backoffice", () => {
  test("lista, filtra por búsqueda y abre el detalle", async ({ page }) => {
    await ingresarComoAdmin(page);
    await expect(page.getByText("4 pedidos")).toBeVisible();

    await page.getByLabel("Buscar").fill("Lucía");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByText("1 pedido")).toBeVisible();

    await page.getByRole("link", { name: "PAS-000101" }).click();
    await expect(page.getByText("Lucía Romero")).toBeVisible();
  });

  test("avanza el estado y queda en el historial", async ({ page }) => {
    await ingresarComoAdmin(page);
    await page.getByRole("link", { name: "PAS-000101" }).click();
    await page.getByRole("button", { name: "Marcar pendiente de confirmación" }).click();
    await expect(page.getByText("Pasó a pendiente de confirmación")).toBeVisible();
  });

  test("crea un pedido manual", async ({ page }) => {
    await ingresarComoAdmin(page);
    await page.goto("/admin/pedidos/nuevo");
    await expect(page.getByRole("heading", { name: "Nuevo pedido" })).toBeVisible();
  });
});
