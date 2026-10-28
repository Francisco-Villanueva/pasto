/**
 * Normaliza un celular argentino a E.164 (`+549` + 10 dígitos), el formato que usa WhatsApp.
 * Acepta lo que la gente escribe: "+54 9 291 555 0123", "0291 15 555 0123", "291-5550123".
 * Devuelve null si no se puede interpretar como un celular de 10 dígitos nacionales.
 */
export function normalizeArPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("54")) {
    digits = digits.slice(2);
    if (digits.startsWith("9")) digits = digits.slice(1);
  }
  if (digits.startsWith("0")) digits = digits.slice(1);

  // Prefijo "15" de los celulares, que va después del código de área (2, 3 o 4 dígitos).
  if (digits.length === 12) {
    for (const area of [2, 3, 4]) {
      if (digits.slice(area, area + 2) === "15") {
        digits = digits.slice(0, area) + digits.slice(area + 2);
        break;
      }
    }
  }

  if (digits.length !== 10 || digits.startsWith("0")) return null;
  return `+549${digits}`;
}

/** ¿Es un celular argentino en formato E.164 (`+549` y 10 dígitos)? */
export function isE164Mobile(phone: string): boolean {
  return /^\+549\d{10}$/.test(phone);
}
