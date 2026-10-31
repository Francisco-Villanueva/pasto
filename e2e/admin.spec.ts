import { expect, test, type Page } from "@playwright/test";

/**
 * Corren contra `npm run dev:local`: base en memoria con los usuarios de prueba
 * admin@pasto.test y cocina@pasto.test.
 */

async function ingresar(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

test.describe("acceso al backoffice", () => {
  test("sin sesión, cualquier pantalla lleva al login y recuerda el destino", async ({ page }) => {
    await page.goto("/admin/usuarios");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fusuarios/);
    await expect(page.getByRole("heading", { name: "Ingresá a tu cuenta" })).toBeVisible();
  });

  test("contraseña incorrecta: mensaje genérico y conserva el email", async ({ page }) => {
    await page.goto("/admin/login");
    await ingresar(page, "admin@pasto.test", "clave-equivocada-1");

    await expect(page.getByRole("alert")).toHaveText("El email o la contraseña no son correctos.");
    await expect(page.getByLabel("Email")).toHaveValue("admin@pasto.test");

    // Un email que no existe responde exactamente igual.
    await ingresar(page, "nadie@pasto.test", "clave-equivocada-1");
    await expect(page.getByRole("alert")).toHaveText("El email o la contraseña no son correctos.");
  });

  test("administración ingresa a la pantalla que pidió y ve todo el menú", async ({ page }) => {
    await page.goto("/admin/pedidos");
    await ingresar(page, "admin@pasto.test", "admin-dev-1234");

    await expect(page).toHaveURL(/\/admin\/pedidos$/);
    const menu = page.getByRole("navigation", { name: "Backoffice" });
    await expect(menu.getByRole("link")).toHaveCount(8);

    // La cookie de sesión no se puede leer desde JavaScript.
    expect(await page.evaluate(() => document.cookie)).not.toContain("pasto_session");
  });

  test("cerrar sesión vuelve al login y las pantallas dejan de abrirse", async ({ page }) => {
    await page.goto("/admin/login");
    await ingresar(page, "admin@pasto.test", "admin-dev-1234");
    await expect(page).toHaveURL(/\/admin\/dashboard$/);

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);

    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("cocina solo ve Producción y no puede abrir el resto por URL", async ({ page }) => {
    await page.goto("/admin/login");
    await ingresar(page, "cocina@pasto.test", "cocina-dev-1234");

    await expect(page).toHaveURL(/\/admin\/produccion$/);
    const menu = page.getByRole("navigation", { name: "Backoffice" });
    await expect(menu.getByRole("link")).toHaveCount(1);

    for (const path of ["/admin/pedidos", "/admin/usuarios", "/admin/agenda", "/admin/dashboard"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/admin\/produccion$/);
    }
  });

  test("el backoffice no se indexa y no se puede incrustar", async ({ request }) => {
    const respuesta = await request.get("/admin/login");
    expect(respuesta.headers()["x-frame-options"]).toBe("DENY");
    expect(respuesta.headers()["x-robots-tag"]).toContain("noindex");
    expect(respuesta.headers()["cache-control"]).toBe("no-store");
  });

  test("un destino externo en ?next se ignora", async ({ page }) => {
    await page.goto("/admin/login?next=https://sitio-malo.example");
    await ingresar(page, "admin@pasto.test", "admin-dev-1234");
    await expect(page).toHaveURL(/localhost:\d+\/admin\/dashboard$/);
  });
});
