import { expect, test, type Page } from "@playwright/test";

const MILANESA = "Milanesa de pollo napolitana";
const BIFE = "Bife con puré de calabaza";
const BURRITO = "Burrito de carne y cheddar";

async function sumar(page: Page, plato: string, veces: number) {
  const boton = page.getByRole("button", { name: `Sumar uno de ${plato}` });
  for (let i = 0; i < veces; i++) await boton.click();
}

const agregar = (page: Page) => page.getByRole("button", { name: "Agregar al carrito" });

test.describe("armado de packs", () => {
  test("criterio 1: con 9 de 10 unidades, Agregar al carrito sigue deshabilitado", async ({
    page,
  }) => {
    await page.goto("/meal-prep");
    await page.getByRole("button", { name: "10 unidades" }).click();

    await sumar(page, MILANESA, 9);
    await expect(page.getByText("9 de 10")).toBeVisible();
    await expect(agregar(page)).toBeDisabled();

    await sumar(page, MILANESA, 1);
    await expect(agregar(page)).toBeEnabled();
  });

  test("diez unidades del mismo plato es un pack válido y no deja pasarse del tamaño", async ({
    page,
  }) => {
    await page.goto("/meal-prep");
    await page.getByRole("button", { name: "10 unidades" }).click();
    await sumar(page, MILANESA, 10);

    await expect(page.getByRole("button", { name: `Sumar uno de ${MILANESA}` })).toBeDisabled();
    await expect(agregar(page)).toBeEnabled();
  });

  test("las macros se calculan en vivo", async ({ page }) => {
    await page.goto("/meal-prep");
    await sumar(page, MILANESA, 2); // 520 kcal c/u
    await expect(page.getByLabel("Resumen del pack")).toContainText("1040");
  });

  test("cambiar el tamaño o el plan reinicia las unidades", async ({ page }) => {
    await page.goto("/meal-prep");
    await sumar(page, MILANESA, 3);
    await page.getByRole("button", { name: "Proteico" }).click();
    await expect(page.getByText("0 de 5")).toBeVisible();
  });

  test("burritos: tamaños 6 y 12, sin selector de plan", async ({ page }) => {
    await page.goto("/burritos");
    await expect(page.getByRole("button", { name: "6 unidades" })).toBeVisible();
    await expect(page.getByRole("button", { name: "12 unidades" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Proteico" })).toHaveCount(0);
  });

  test("ingredientes y alérgenos se piden en el detalle y no se inventan", async ({ page }) => {
    await page.goto("/meal-prep");
    await page.getByRole("button", { name: "Ver ingredientes y alérgenos" }).first().click();

    const dialog = page.getByRole("dialog", { name: MILANESA });
    await expect(dialog).toContainText("Consultanos por WhatsApp");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});

test.describe("carrito", () => {
  test("persiste al recargar y muestra la cantidad en el encabezado", async ({ page }) => {
    await page.goto("/meal-prep");
    await sumar(page, MILANESA, 5);
    await agregar(page).click();

    await expect(page.getByRole("navigation", { name: "Principal" })).toContainText("Carrito");
    await page.goto("/cart");
    await expect(page.getByText("Esencial x5")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Esencial x5")).toBeVisible();
  });

  test("criterio 2: Esencial en el carrito y Proteico pide confirmar; nunca conviven", async ({
    page,
  }) => {
    await page.goto("/meal-prep");
    await sumar(page, MILANESA, 5);
    await agregar(page).click();

    await page.getByRole("button", { name: "Proteico" }).click();
    await sumar(page, BIFE, 5);
    await agregar(page).click();

    const modal = page.getByRole("dialog", { name: "Tu carrito ya tiene un pack Esencial" });
    await expect(modal).toBeVisible();
    await expect(modal).toContainText("Se quitaría: Esencial x5");

    // Mantener: el carrito queda como estaba.
    await modal.getByRole("button", { name: "Mantener mi carrito" }).click();
    await page.goto("/cart");
    await expect(page.getByText("Esencial x5")).toBeVisible();
    await expect(page.getByText("Proteico x5")).toHaveCount(0);

    // Reemplazar: queda solo el Proteico.
    await page.goto("/meal-prep");
    await page.getByRole("button", { name: "Proteico" }).click();
    await sumar(page, BIFE, 5);
    await agregar(page).click();
    await page.getByRole("button", { name: "Reemplazar el pack Esencial" }).click();
    await page.goto("/cart");
    await expect(page.getByText("Proteico x5")).toBeVisible();
    await expect(page.getByText("Esencial x5")).toHaveCount(0);
  });

  test("reemplazar el plan conserva burritos y complementos", async ({ page }) => {
    await page.goto("/burritos");
    await sumar(page, BURRITO, 6);
    await agregar(page).click();

    await page.goto("/meal-prep");
    await sumar(page, MILANESA, 5);
    await agregar(page).click();

    await page.goto("/cart");
    await page.getByRole("button", { name: "Sumar uno de Pollo preparado" }).click();

    await page.goto("/meal-prep");
    await page.getByRole("button", { name: "Proteico" }).click();
    await sumar(page, BIFE, 5);
    await agregar(page).click();
    await page.getByRole("button", { name: "Reemplazar el pack Esencial" }).click();

    await page.goto("/cart");
    await expect(page.getByText("Burritos x6")).toBeVisible();
    await expect(page.getByText("Proteico x5")).toBeVisible();
    await expect(page.getByText("Esencial x5")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Pollo preparado" })).toHaveCount(0);
    await expect(page.getByLabel("Cantidad de Pollo preparado")).toHaveText("1");
  });

  test("criterio 3: un complemento sin pack se rechaza y el checkout se bloquea", async ({
    page,
  }) => {
    await page.goto("/burritos");
    await sumar(page, BURRITO, 6);
    await agregar(page).click();

    await page.goto("/cart");
    await page.getByRole("button", { name: "Sumar uno de Pollo preparado" }).click();
    await expect(page.getByLabel("Cantidad de Pollo preparado")).toHaveText("1");

    // Se quita el único pack: el complemento queda, se avisa y el checkout se bloquea.
    await page.getByRole("button", { name: "Quitar pack" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Falta un pack principal" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Continuar al checkout" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    // Intentar sumar otro sin pack se rechaza: el aviso fijo sigue y un toast responde al clic.
    await page.getByRole("button", { name: "Sumar uno de Vegetales preparados" }).click();
    await expect(page.getByText("Sumá primero un pack")).toBeVisible();
    await expect(page.getByLabel("Cantidad de Vegetales preparados")).toHaveText("0");

    // Quitar el complemento resuelve el bloqueo (queda el carrito vacío).
    await page.getByRole("button", { name: "Quitar uno de Pollo preparado" }).click();
    await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
  });

  test("un carrito guardado con formato inválido no rompe la página", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("pasto-cart", "esto no es json"));
    await page.goto("/cart");
    await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
  });
});
