"use client";

import { useState } from "react";
import { Button } from "@design/react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  Notice,
  PageHead,
  Panel,
  SelectField,
  Switch,
  TextareaField,
  TextField,
  useToast,
} from "@/components/ui";

export default function PlatoPage() {
  const { toast } = useToast();
  const [category, setCategory] = useState("ESENCIAL");
  const [active, setActive] = useState(true);
  const isComplement = category === "COMPLEMENTO";

  return (
    <AdminShell role="ADMIN" current="/admin/catalogo">
      <PageHead label="Catálogo" title="Editar plato" />
      <form
        className="stack-lg"
        onSubmit={(event) => {
          event.preventDefault();
          toast("Plato guardado");
        }}
      >
        <Panel label="Datos">
          <div className="pasto-fields-2">
            <TextField label="Nombre" defaultValue="Milanesa de pollo napolitana" required />
            <TextField
              label="SKU"
              defaultValue="ESE-001"
              required
              hint="Código único, no se repite."
            />
            <SelectField
              label="Categoría"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="ESENCIAL">Esencial</option>
              <option value="PROTEICO">Proteico</option>
              <option value="BURRITO">Burritos</option>
              <option value="COMPLEMENTO">Complemento</option>
            </SelectField>
            <TextField label="Peso neto (g)" type="number" inputMode="numeric" defaultValue="350" />
          </div>
          <TextareaField
            label="Descripción"
            defaultValue="Milanesa de pollo con salsa y queso, con guarnición."
          />
        </Panel>

        <Panel label="Información para el cliente">
          <TextareaField
            label="Ingredientes"
            defaultValue="A completar"
            hint="Se muestra en el detalle del plato."
          />
          <TextareaField
            label="Alérgenos"
            defaultValue="A completar"
            hint="Se muestran de forma visible en el constructor de packs y en el detalle."
          />
        </Panel>

        <Panel label="Macros por unidad">
          <div className="pasto-fields-2">
            <TextField
              label="Calorías (kcal)"
              type="number"
              inputMode="numeric"
              defaultValue="520"
            />
            <TextField label="Proteínas (g)" type="number" inputMode="numeric" defaultValue="38" />
            <TextField
              label="Carbohidratos (g)"
              type="number"
              inputMode="numeric"
              defaultValue="42"
            />
            <TextField label="Grasas (g)" type="number" inputMode="numeric" defaultValue="20" />
          </div>
        </Panel>

        {isComplement && (
          <Panel label="Precio">
            <TextField
              label="Precio del pack ($)"
              type="number"
              inputMode="decimal"
              defaultValue=""
              required
              hint="Los complementos se venden como pack fijo. Los platos se cobran por el precio del pack que los incluye."
            />
          </Panel>
        )}

        <Panel label="Receta e imagen">
          <TextField
            label="Versión de receta"
            defaultValue="v1.0"
            hint="Subila cuando cambie la receta: las encuestas se separan por versión."
          />
          <TextField
            label="Imagen"
            type="file"
            accept="image/*"
            hint="Opcional. Sin imagen se muestra un bloque de color."
          />
          <Switch
            label="Activo en la tienda"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
        </Panel>

        {!active && (
          <Notice>
            Desactivado: no se puede elegir en packs nuevos. Los carritos que ya lo tienen avisan
            que dejó de estar disponible.
          </Notice>
        )}

        <div className="row">
          <Button type="submit">Guardar plato</Button>
          <Button variant="secondary" href="/sistema/pantallas/catalogo">
            Volver al catálogo
          </Button>
        </div>
      </form>
    </AdminShell>
  );
}
