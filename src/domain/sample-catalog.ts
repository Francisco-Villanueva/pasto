import {
  tierKey,
  type Catalog,
  type PackCategory,
  type PriceTable,
  type ProductCategory,
} from "./catalog";

/**
 * Catálogo de EJEMPLO tomado de design/views. Sirve de semilla y de fixture de tests.
 * Se reemplaza por el catálogo real cuando lleguen los datos de Pasto.
 */
export type SampleProduct = {
  sku: string;
  name: string;
  category: ProductCategory;
  netWeightG: number;
  macros: { calories: number; protein: number; carbs: number; fats: number } | null;
  /** Solo complementos, en centavos. */
  priceCents?: number;
};

const meal = (
  sku: string,
  name: string,
  category: PackCategory,
  calories: number,
  protein: number,
  carbs: number,
  fats: number,
  netWeightG = 350,
): SampleProduct => ({
  sku,
  name,
  category,
  netWeightG,
  macros: { calories, protein, carbs, fats },
});

export const SAMPLE_PRODUCTS: readonly SampleProduct[] = [
  meal("ESE-001", "Milanesa de pollo napolitana", "ESENCIAL", 520, 38, 42, 20),
  meal("ESE-002", "Pollo al limón con arroz", "ESENCIAL", 480, 36, 48, 14),
  meal("ESE-003", "Guiso de lentejas", "ESENCIAL", 430, 24, 58, 10),
  meal("ESE-004", "Fideos con boloñesa", "ESENCIAL", 560, 30, 68, 18),
  meal("PRO-001", "Bife con puré de calabaza", "PROTEICO", 610, 52, 38, 26),
  meal("PRO-002", "Pollo grillado con quinoa", "PROTEICO", 540, 50, 40, 16),
  meal("PRO-003", "Albóndigas con arroz integral", "PROTEICO", 580, 46, 46, 20),
  meal("PRO-004", "Salmón con vegetales", "PROTEICO", 590, 44, 30, 30),
  meal("BUR-001", "Burrito de carne y cheddar", "BURRITO", 620, 34, 62, 24, 280),
  meal("BUR-002", "Burrito de pollo y vegetales", "BURRITO", 560, 36, 58, 18, 280),
  meal("BUR-003", "Burrito de lentejas y queso", "BURRITO", 520, 22, 70, 16, 280),
  {
    sku: "COM-001",
    name: "Pollo preparado",
    category: "COMPLEMENTO",
    netWeightG: 480,
    macros: null,
    priceCents: 950_000,
  },
  {
    sku: "COM-002",
    name: "Vegetales preparados",
    category: "COMPLEMENTO",
    netWeightG: 600,
    macros: null,
    priceCents: 780_000,
  },
];

/** Precios de ejemplo por categoría y tamaño, en centavos. */
export const SAMPLE_TIERS: readonly { category: PackCategory; size: number; priceCents: number }[] =
  [
    { category: "ESENCIAL", size: 5, priceCents: 2_150_000 },
    { category: "ESENCIAL", size: 10, priceCents: 4_000_000 },
    { category: "ESENCIAL", size: 20, priceCents: 7_600_000 },
    { category: "PROTEICO", size: 5, priceCents: 2_500_000 },
    { category: "PROTEICO", size: 10, priceCents: 4_700_000 },
    { category: "PROTEICO", size: 20, priceCents: 9_000_000 },
    { category: "BURRITO", size: 6, priceCents: 1_800_000 },
    { category: "BURRITO", size: 12, priceCents: 3_400_000 },
  ];

/** Tramos de envío de ejemplo (hasta X metros → centavos) y radio máximo. */
export const SAMPLE_SHIPPING = {
  maxDistanceM: 10_000,
  tiers: [
    { upToM: 3_000, feeCents: 150_000 },
    { upToM: 6_000, feeCents: 250_000 },
    { upToM: 10_000, feeCents: 400_000 },
  ],
} as const;

/** Catálogo en memoria con el id igual al SKU (para tests y vistas previas sin base). */
export function sampleCatalog(): Catalog {
  return new Map(
    SAMPLE_PRODUCTS.map((p) => [
      p.sku,
      {
        id: p.sku,
        name: p.name,
        category: p.category,
        isActive: true,
        priceCents: p.priceCents,
      },
    ]),
  );
}

export function samplePrices(): PriceTable {
  return new Map(SAMPLE_TIERS.map((t) => [tierKey(t.category, t.size), t.priceCents]));
}
