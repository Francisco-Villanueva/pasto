"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Tag } from "@design/react";
import { AdminShell } from "@/components/layout/AdminShell";
import { PageHead, Plate, Segmented, Status, Table } from "@/components/ui";
import type { ProductCategory } from "@/domain/catalog";
import { formatMoney } from "@/domain/money";
import { SAMPLE_PRODUCTS } from "@/domain/sample-catalog";

type Filter = "TODOS" | ProductCategory;

const LABEL: Record<ProductCategory, string> = {
  ESENCIAL: "Esencial",
  PROTEICO: "Proteico",
  BURRITO: "Burritos",
  COMPLEMENTO: "Complemento",
};

export default function CatalogoPage() {
  const [filter, setFilter] = useState<Filter>("TODOS");
  const rows = SAMPLE_PRODUCTS.filter((p) => filter === "TODOS" || p.category === filter);

  return (
    <AdminShell role="ADMIN" current="/admin/catalogo">
      <div className="row-between">
        <PageHead label="Catálogo" title="Platos" />
        <Button href="/sistema/pantallas/plato">Nuevo plato</Button>
      </div>
      <Segmented
        label="Filtrar por categoría"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "TODOS", label: "Todos" },
          { value: "ESENCIAL", label: "Esencial" },
          { value: "PROTEICO", label: "Proteico" },
          { value: "BURRITO", label: "Burritos" },
          { value: "COMPLEMENTO", label: "Complementos" },
        ]}
      />
      <Table label="Catálogo de platos y complementos">
        <thead>
          <tr>
            <th scope="col">Plato</th>
            <th scope="col">Categoría</th>
            <th scope="col">Receta</th>
            <th scope="col">Estado</th>
            <th scope="col" className="is-num">
              Precio
            </th>
            <th scope="col">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((product) => (
            <tr key={product.sku}>
              <td>
                <span className="row" style={{ flexWrap: "nowrap", gap: "var(--space-3)" }}>
                  <Plate name={product.name} small />
                  <span>
                    <b>{product.name}</b>
                    <br />
                    <span className="caption muted">{product.sku}</span>
                  </span>
                </span>
              </td>
              <td>
                <Tag tone="neutral">{LABEL[product.category]}</Tag>
              </td>
              <td className="num">v1.0</td>
              <td>
                <Status tone="verde" tag="brand">
                  Activo
                </Status>
              </td>
              <td className="is-num">
                {product.priceCents === undefined ? "Según pack" : formatMoney(product.priceCents)}
              </td>
              <td className="is-num">
                <Link href="/sistema/pantallas/plato" className="body-sm">
                  Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="caption muted">
        Un plato desactivado deja de verse en la tienda, pero se conserva en los pedidos y las
        encuestas anteriores.
      </p>
    </AdminShell>
  );
}
