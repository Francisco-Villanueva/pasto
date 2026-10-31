import { expect, test } from "@playwright/test";

/**
 * Corren contra `npm run dev:local`: sin credenciales de Google, "Continuar con Google" entra con un
 * cliente de prueba (sofia.diaz@pasto.test), que ya tiene un pedido entregado.
 */

test.describe("mi cuenta", () => {
  test("sin sesión ofrece ingresar con Google", async ({ page }) => {
    await page.goto("/mi-cuenta");
    await expect(page.getByRole("link", { name: "Continuar con Google" })).toBeVisible();
  });

  test("ingresar, ver el pedido y repetirlo en el carrito", async ({ page }) => {
    await page.goto("/mi-cuenta");
    await page.getByRole("link", { name: "Continuar con Google" }).click();
    await expect(page.getByRole("heading", { name: /Hola, Sofía/ })).toBeVisible();

    const fila = page.getByRole("row").filter({ hasText: "ENTREGADO" });
    await expect(fila.getByRole("link", { name: "Calificar platos" })).toBeVisible();

    await fila.getByRole("button", { name: "Repetir pedido" }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByText("Milanesa de pollo napolitana")).toBeVisible();
  });

  test("cerrar sesión vuelve al inicio", async ({ page }) => {
    await page.goto("/api/cuenta/google");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL("/");
    await page.goto("/mi-cuenta");
    await expect(page.getByRole("link", { name: "Continuar con Google" })).toBeVisible();
  });
});
