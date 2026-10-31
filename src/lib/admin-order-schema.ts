import { z } from "zod";
import { normalizeArPhone } from "@/domain/phone";
import { cartSchema } from "./cart-persistence";
import { addressSchema } from "./checkout-schema";

/**
 * Datos con los que la administración crea o edita un pedido. Igual que en el checkout, no hay
 * precios: el servidor los calcula. La única excepción es el costo de envío, que la administración
 * puede fijar a mano (por ejemplo, el que se acordó por WhatsApp).
 */
export const adminOrderSchema = z
  .object({
    cart: cartSchema,
    deliveryType: z.enum(["DELIVERY", "RETIRO"]),
    address: addressSchema.optional(),
    /** Lugar elegido en el buscador, para medir la distancia si no hay costo manual. */
    placeId: z.string().trim().min(1).max(300).optional(),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí un día."),
    timeSlot: z.string().trim().min(1, "Elegí una franja horaria.").max(64),
    customer: z.object({
      name: z.string().trim().min(2, "Escribí nombre y apellido.").max(120),
      phone: z
        .string()
        .trim()
        .min(1, "Escribí el WhatsApp.")
        .max(40)
        .refine((value) => normalizeArPhone(value) !== null, {
          message: "Revisá el número: tiene que ser un celular con código de área.",
        }),
      email: z.union([z.literal(""), z.email("Revisá el email.")]).optional(),
    }),
    /** En centavos. Nulo o ausente = se calcula por distancia o queda a confirmar. */
    deliveryFeeCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
    paymentMethod: z.enum(["EFECTIVO", "TRANSFERENCIA", "PENDIENTE"]).optional(),
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

export type AdminOrderInput = z.infer<typeof adminOrderSchema>;
