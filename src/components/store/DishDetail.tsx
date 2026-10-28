import { hasProductInfo, type StoreProduct } from "@/domain/store-catalog";

const MISSING =
  "Todavía no cargamos esta información. Consultanos por WhatsApp antes de pedir si tenés alguna alergia o restricción.";

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="stack" style={{ gap: "var(--space-1)" }}>
      <span className="label">{label}</span>
      <p className="body-sm">{children}</p>
    </div>
  );
}

/** Ingredientes, alérgenos y macros de un plato. Lo no cargado se dice, no se inventa. */
export function DishDetail({ product }: { product: StoreProduct }) {
  const { macros } = product;
  return (
    <div className="stack">
      {hasProductInfo(product.description) && <p className="muted">{product.description}</p>}
      <Block label="Ingredientes">
        {hasProductInfo(product.ingredients) ? product.ingredients : MISSING}
      </Block>
      <Block label="Alérgenos">
        {hasProductInfo(product.allergens) ? product.allergens : MISSING}
      </Block>
      {product.netWeightG !== null && <Block label="Peso neto">{product.netWeightG} g</Block>}
      {macros && (
        <div className="stack" style={{ gap: "var(--space-1)" }}>
          <span className="label">Por unidad</span>
          <div className="pasto-macros">
            <span>
              <b>{macros.calories}</b> kcal
            </span>
            <span>
              <b>{macros.protein}</b> g prot.
            </span>
            <span>
              <b>{macros.carbs}</b> g carb.
            </span>
            <span>
              <b>{macros.fats}</b> g grasa
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
