/** Calle, número y barrio sacados de una sugerencia de dirección, para precompletar el formulario. */
export function parseSuggestion(
  main: string,
  secondary: string,
): {
  street: string;
  number: string;
  neighborhood: string;
} {
  const match = main.trim().match(/^(.*?)[\s,]+(\d+[A-Za-z]?)$/);
  const street = match ? match[1]!.trim() : main.trim();
  const number = match ? match[2]! : "";
  // "Centro · 1,2 km (simulado)" o "Centro, Bahía Blanca, Provincia de Buenos Aires, Argentina".
  const neighborhood = secondary.split("·")[0]!.split(",")[0]!.trim();
  return { street, number, neighborhood };
}
