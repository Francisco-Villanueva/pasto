/** La onda terracota: subrayado decorativo bajo titulares display, de 3 a 4 crestas. */
export function Wave({ color = "var(--accent)", width = 120 }: { color?: string; width?: number }) {
  return (
    <svg width={width} height={(width * 14) / 100} viewBox="0 0 100 14" fill="none" aria-hidden="true">
      <path d="M3 9C9 1 15 1 21 9S33 17 39 9 51 1 57 9s12 8 18 0 12-8 18 0" stroke={color} strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}
