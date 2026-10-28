import { expect, test, type Page } from "@playwright/test";

/**
 * Estos tests corren contra el servidor en modo desarrollo: base de datos en memoria con el catálogo
 * de ejemplo, WhatsApp de PASTO falso y direcciones simuladas (placeId `dev:<metros>`).
 */

const MILANESA = "Milanesa de pollo napolitana";

async function agregarPack(page: Page) {
  await page.goto("/meal-prep");
  const sumar = page.getByRole("button", { name: `Sumar uno de ${MILANESA}` });
  for (let i = 0; i < 5; i++) await sumar.click();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByRole("navigation", { name: "Principal" })).toContainText("Carrito");
}

async function completarDatos(page: Page, telefono = "0291 15 555 0123") {
  await page.getByLabel("Nombre y apellido").fill("Lucía Romero");
  await page.getByLabel("WhatsApp").fill(telefono);
  await page.getByRole("switch", { name: /Acepto los/ }).check();
}

test.describe("checkout", () => {
  test("sin carrito muestra el estado vacío", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
  });

  test("criterio 4: el pedido se crea y se envía a WhatsApp con el formato de la especificación", async ({
    page,
  }) => {
    // El destino real es WhatsApp: se intercepta para leer el enlace sin salir de la app.
    let whatsappUrl = "";
    await page.route(/(wa\.me|api\.whatsapp\.com)/, async (route) => {
      whatsappUrl = route.request().url();
      await route.fulfill({ status: 200, contentType: "text/html", body: "<p>WhatsApp</p>" });
    });

    await agregarPack(page);
    await page.goto("/checkout");

    await page.getByRole("button", { name: "Retiro en el local" }).click();
    await expect(page.getByLabel("Tu pedido")).toContainText("$0");
    await completarDatos(page);
    await page.getByRole("button", { name: "Enviar pedido por WhatsApp" }).click();

    await expect.poll(() => whatsappUrl, { timeout: 15_000 }).not.toBe("");

    const message = decodeURIComponent(
      new URL(whatsappUrl).searchParams.get("text") ?? whatsappUrl.split("?text=")[1] ?? "",
    ).replaceAll("+", " ");
    expect(whatsappUrl).toContain("5490000000000");
    expect(message).toMatch(/Hola, Pasto\. Quiero solicitar el pedido PAS-\d{6}\./);
    expect(message).toContain("- Esencial x5: 5x Milanesa de pollo napolitana");
    expect(message).toContain("(Retiro)");
    expect(message).toContain("Total: $21.500");
    expect(message).toContain("Teléfono: +5492915550123"); // normalizado
    expect(message).toContain("Entiendo que el pedido queda sujeto a confirmación de Pasto.");
  });

  test("después de enviar el carrito queda vacío y la página del pedido se abre con su enlace privado", async ({
    page,
  }) => {
    await page.route(/(wa\.me|api\.whatsapp\.com)/, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<p>WhatsApp</p>" }),
    );
    await agregarPack(page);
    await page.goto("/checkout");
    await page.getByRole("button", { name: "Retiro en el local" }).click();
    await completarDatos(page, "11 5555 0001");
    await page.getByRole("button", { name: "Enviar pedido por WhatsApp" }).click();
    await page.waitForURL(/(wa\.me|api\.whatsapp\.com)/);

    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "Ya casi está" })).toBeVisible();
    await expect(page.getByLabel("Resumen del pedido")).toContainText("PAS-");
    await expect(page).not.toHaveURL(/enviar=1/); // volver atrás no reabre WhatsApp

    await page.goto("/cart");
    await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
  });

  test("no deja enviar sin aceptar los términos", async ({ page }) => {
    await agregarPack(page);
    await page.goto("/checkout");
    await page.getByRole("button", { name: "Retiro en el local" }).click();
    await page.getByLabel("Nombre y apellido").fill("Lucía Romero");
    await page.getByLabel("WhatsApp").fill("11 5555 0002");
    await page.getByRole("button", { name: "Enviar pedido por WhatsApp" }).click();

    await expect(page.getByText("Para pedir tenés que aceptar los términos.")).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
  });

  test("valida el teléfono con un mensaje claro", async ({ page }) => {
    await agregarPack(page);
    await page.goto("/checkout");
    await page.getByRole("button", { name: "Retiro en el local" }).click();
    await completarDatos(page, "123");
    await page.getByRole("button", { name: "Enviar pedido por WhatsApp" }).click();
    await expect(page.getByText(/tiene que ser un celular con código de área/)).toBeVisible();
  });

  test("elegir una dirección cotiza el envío por tramos y fuera de zona bloquea el pedido", async ({
    page,
  }) => {
    await agregarPack(page);
    await page.goto("/checkout");

    const buscador = page.getByRole("combobox", { name: "Buscá tu dirección" });
    await buscador.fill("Alsina");
    await page.getByRole("option", { name: /Alsina 456/ }).click();
    await expect(page.getByLabel("Tu pedido")).toContainText("$1.500"); // 1,2 km: primer tramo
    await expect(page.getByLabel("Calle")).toHaveValue("Alsina");
    await expect(page.getByLabel("Número")).toHaveValue("456");

    await buscador.fill("Camino de la");
    await page.getByRole("option", { name: /Carrindanga/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Todavía no llegamos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar pedido por WhatsApp" })).toBeDisabled();

    await page.getByRole("button", { name: "Elegir retiro" }).click();
    await expect(page.getByRole("button", { name: "Enviar pedido por WhatsApp" })).toBeEnabled();
  });

  test("el miércoles de hoy no se ofrece: cierra el lunes a las 12:00", async ({ page }) => {
    await agregarPack(page);
    await page.goto("/checkout");
    const dias = page.getByRole("radiogroup", { name: "Día de entrega" });
    await expect(dias.getByText(/Pedí hasta el lunes a las 12:00/).first()).toBeVisible();
  });

  test("la API ignora importes del cliente y rechaza pedidos inválidos con mensajes en español", async ({
    request,
  }) => {
    const respuesta = await request.post("/api/orders/preliminary", {
      data: {
        cart: {
          packs: [
            { id: "a", category: "ESENCIAL", size: 5, items: [{ productId: "x", quantity: 5 }] },
          ],
          complements: [],
        },
        deliveryType: "RETIRO",
        scheduledDate: "2026-11-04",
        timeSlot: "12:00 a 14:00",
        customer: { name: "Ana Pérez", phone: "2915550123" },
        acceptTerms: true,
        total: 1,
      },
    });
    expect(respuesta.status()).toBe(422);
    const cuerpo = await respuesta.json();
    expect(cuerpo.error.code).toBe("INVALID_ORDER");
    expect(cuerpo.error.messages.join(" ")).toMatch(/pack|día/);
  });

  test("la página del pedido no se abre con el número de pedido", async ({ request }) => {
    expect((await request.get("/pedido/PAS-000101")).status()).toBe(404);
  });
});
