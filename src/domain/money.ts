/** Importes en centavos (enteros). Nunca se opera con float. */
export type Cents = number;

/** Convierte el NUMERIC(10,2) de la base (string "21500.00") a centavos. */
export function centsFromNumeric(value: string | number): Cents {
  const [whole = "0", fraction = ""] = String(value).split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  const cents = Math.abs(Number(whole)) * 100 + Number((fraction + "00").slice(0, 2));
  return sign * cents;
}

/** Convierte centavos al NUMERIC(10,2) de la base. */
export function numericFromCents(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** "$21.500" o "$21.500,50" (es-AR). */
export function formatMoney(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = abs % 100;
  return `${sign}$${whole}${fraction ? `,${String(fraction).padStart(2, "0")}` : ""}`;
}
