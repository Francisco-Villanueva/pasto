import { z } from "zod";
import { normalizeArPhone } from "@/domain/phone";
import { cartSchema } from "./cart-persistence";

/**
 * Lo que el navegador manda para crear un pedido. Nunca incluye precios, costo de envío ni
 * distancia: el servidor los calcula. Los mensajes están en español porque se muestran al cliente.
 */
export const addressSchema = z.object({
  street: z.string().trim().min(1, "Escribí la calle.").max(120),
  number: z.string().trim().min(1, "Escribí el número.").max(20),
  floorApt: z.string().trim().max(40).optional(),
  neighborhood: z.string().trim().min(1, "Escribí el barrio.").max(80),
  notes: z.string().trim().max(300).optional(),
});

export const checkoutSchema = z
  .object({
    cart: cartSchema,
    deliveryType: z.enum(["DELIVERY", "RETIRO"]),
    address: addressSchema.optional(),
    /** Lugar elegido en el autocompletado de Google, para medir la distancia en el servidor. */
    placeId: z.string().trim().min(1).max(300).optional(),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí un día."),
    timeSlot: z.string().trim().min(1, "Elegí una franja horaria.").max(64),
    customer: z.object({
      name: z.string().trim().min(2, "Escribí tu nombre y apellido.").max(120),
      phone: z
        .string()
        .trim()
        .min(1, "Escribí tu WhatsApp.")
        .max(40)
        .refine((value) => normalizeArPhone(value) !== null, {
          message: "Revisá el número: tiene que ser un celular con código de área.",
        }),
      email: z.union([z.literal(""), z.email("Revisá el email.")]).optional(),
    }),
    consentCommercial: z.boolean().default(false),
    acceptTerms: z.literal(true, { error: "Para pedir tenés que aceptar los términos." }),
    turnstileToken: z.string().max(4096).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.deliveryType === "DELIVERY" && !value.address) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "Completá la dirección de entrega.",
      });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Errores del esquema como `{ "customer.phone": "mensaje" }`, listo para mostrar junto a cada campo. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    result[key] ??= issue.message;
  }
  return result;
}
