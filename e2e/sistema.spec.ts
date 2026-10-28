import { expect, test } from "@playwright/test";

test.describe("sistema de diseño", () => {
  test("carga tokens y fuentes de PASTO", async ({ page }) => {
    await page.goto("/sistema");
    await expect(page.getByRole("heading", { name: "Componentes" })).toBeVisible();

    const surface = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(surface).toBe("rgb(214, 210, 200)");

    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        display: document.fonts.check('32px "Gabriel Weiss"'),
        sans: document.fonts.check('16px "Hanken Grotesk"'),
      };
    });
    expect(fonts).toEqual({ display: true, sans: true });
  });

  test("alterna entre Arena y Carbón y lo recuerda", async ({ page }) => {
    await page.goto("/sistema");
    await page.getByRole("button", { name: "Tema Carbón" }).click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "carbon");
    const surface = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(surface).toBe("rgb(39, 43, 41)");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "carbon");
  });

  test("el pack solo se puede agregar cuando suma el tamaño", async ({ page }) => {
    await page.goto("/sistema");
    const add = page.getByRole("button", { name: "Agregar al carrito" });
    await expect(add).toBeDisabled(); // 3 de 5

    await page.getByRole("button", { name: "Sumar uno de Guiso de lentejas" }).click();
    await page.getByRole("button", { name: "Sumar uno de Guiso de lentejas" }).click();
    await expect(add).toBeEnabled(); // 5 de 5

    // Con el pack completo no se puede sumar más.
    await expect(
      page.getByRole("button", { name: "Sumar uno de Guiso de lentejas" }),
    ).toBeDisabled();
  });

  test("el modal se abre, atrapa el foco y se cierra con Esc", async ({ page }) => {
    await page.goto("/sistema");
    await page.getByRole("button", { name: "Abrir modal" }).click();

    const dialog = page.getByRole("dialog", { name: "Tu carrito ya tiene un pack Esencial" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Mantener mi carrito" })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("el foco del teclado es visible", async ({ page }) => {
    await page.goto("/sistema");
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const style = getComputedStyle(el);
      return { width: style.outlineWidth, style: style.outlineStyle };
    });
    expect(outline).toEqual({ width: "2px", style: "solid" });
  });
});

test.describe("pantallas de referencia", () => {
  const screens = [
    ["/sistema/pantallas/pedido-enviado", "Ya casi está"],
    ["/sistema/pantallas/estados", "Estados"],
    ["/sistema/pantallas/editor-pedido", "PAS-000102"],
    ["/sistema/pantallas/catalogo", "Platos"],
    ["/sistema/pantallas/plato", "Editar plato"],
    ["/sistema/pantallas/usuarios", "Staff"],
  ] as const;

  for (const [path, heading] of screens) {
    test(`${path} carga sin errores`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test("el editor de pedido bloquea el guardado con un pack incompleto", async ({ page }) => {
    await page.goto("/sistema/pantallas/editor-pedido");
    const save = page.getByRole("button", { name: "Guardar cambios" });
    await expect(save).toBeEnabled();

    await page.getByRole("button", { name: "Quitar uno de Guiso de lentejas" }).first().click();
    await expect(save).toBeDisabled();
    await expect(page.getByRole("alert")).toContainText("no se puede guardar todavía");
  });

  test("el menú de administración muestra todas las secciones y marca la actual", async ({
    page,
  }) => {
    await page.goto("/sistema/pantallas/usuarios");
    const nav = page.getByRole("navigation", { name: "Backoffice" });
    await expect(nav.getByRole("link")).toHaveCount(8);
    await expect(nav.getByRole("link", { name: "Usuarios" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

test("una ruta inexistente muestra la 404 de PASTO", async ({ page }) => {
  const response = await page.goto("/no-existe");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
});
