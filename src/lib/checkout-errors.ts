import type { CartIssue } from "@/domain/cart";
import type { DraftError } from "@/domain/order-draft";

function cartMessage(issue: CartIssue): string {
  switch (issue.code) {
    case "EMPTY":
      return "Tu carrito está vacío.";
    case "MIXED_PLANS":
      return "No se pueden mezclar los planes Esencial y Proteico en un mismo pedido.";
    case "ORPHAN_COMPLEMENTS":
      return "Los complementos no se pueden pedir solos: agregá un pack de meal prep o de burritos.";
    case "INVALID_COMPLEMENT":
      return "Un complemento del carrito ya no está disponible.";
    case "PACK_ISSUE":
      return "Un pack del carrito ya no se puede pedir tal cual: algún plato dejó de estar disponible o no suma sus unidades.";
  }
}

/** Mensajes en español para mostrar al cliente. Sin repetir el mismo texto. */
export function describeDraftErrors(errors: readonly DraftError[]): string[] {
  const messages = errors.flatMap((error) => {
    switch (error.code) {
      case "CART_INVALID":
        return error.issues.map(cartMessage);
      case "PRICE_MISSING":
        return ["No pudimos calcular el precio de tu pedido. Probá de nuevo en un rato."];
      case "DAY_UNAVAILABLE":
        return ["Ese día ya no está disponible. Elegí otro."];
      case "SLOT_INVALID":
        return ["Esa franja horaria no está disponible para el día elegido."];
      case "ADDRESS_REQUIRED":
        return ["Completá la dirección de entrega."];
      case "OUT_OF_RANGE":
        return [
          "Todavía no llegamos a esa dirección. Podés retirar tu pedido en el local sin costo.",
        ];
    }
  });
  return [...new Set(messages)];
}
