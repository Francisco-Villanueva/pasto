"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TextField } from "@/components/ui";

export type Suggestion = { placeId: string; main: string; secondary: string };

type Props = {
  onSelect: (suggestion: Suggestion) => void;
  /** Se llama cuando la persona vuelve a escribir: la dirección elegida ya no vale. */
  onEdit: () => void;
};

/**
 * Buscador de direcciones con sugerencias. Consulta a nuestro servidor (la clave de Google no sale de ahí)
 * y funciona con el teclado: flechas para moverse, Enter para elegir y Esc para cerrar.
 */
export function AddressSearch({ onSelect, onEdit }: Props) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState(false);
  const picked = useRef(false);
  // Con menos de 3 letras no se muestran resultados viejos.
  const visible = query.trim().length >= 3 ? items : [];

  useEffect(() => {
    if (picked.current) {
      picked.current = false;
      return;
    }
    const text = query.trim();
    if (text.length < 3) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/address/suggest?q=${encodeURIComponent(text)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { suggestions?: Suggestion[] };
        setItems(response.ok ? (data.suggestions ?? []) : []);
        setActive(-1);
        setOpen(true);
        setSearched(true);
      } catch {
        // Cortado por una búsqueda nueva o sin conexión: el formulario manual sigue disponible.
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function choose(suggestion: Suggestion) {
    picked.current = true;
    setQuery(`${suggestion.main}${suggestion.secondary ? `, ${suggestion.secondary}` : ""}`);
    setOpen(false);
    setItems([]);
    onSelect(suggestion);
  }

  return (
    <div style={{ position: "relative" }}>
      <TextField
        label="Buscá tu dirección"
        hint="Elegí una sugerencia para calcular el envío. Si no la encontrás, completá los datos de abajo."
        value={query}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && visible.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(event) => {
          setQuery(event.target.value);
          onEdit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          else if (event.key === "ArrowDown" && visible.length > 0) {
            event.preventDefault();
            setOpen(true);
            setActive((current) => (current + 1) % visible.length);
          } else if (event.key === "ArrowUp" && visible.length > 0) {
            event.preventDefault();
            setActive((current) => (current <= 0 ? visible.length - 1 : current - 1));
          } else if (event.key === "Enter" && open && active >= 0 && visible[active]) {
            event.preventDefault();
            choose(visible[active]);
          }
        }}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Direcciones sugeridas"
        className="pasto-suggest"
        hidden={!open || visible.length === 0}
      >
        {visible.map((item, index) => (
          <li
            key={item.placeId}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            className="pasto-suggest__item"
            onMouseDown={(event) => {
              event.preventDefault(); // no pierde el foco antes de elegir
              choose(item);
            }}
          >
            <span className="title">{item.main}</span>
            <span className="caption muted">{item.secondary}</span>
          </li>
        ))}
      </ul>
      {open && searched && query.trim().length >= 3 && visible.length === 0 && (
        <p className="caption muted" role="status">
          No encontramos esa dirección. Completá los datos de abajo.
        </p>
      )}
    </div>
  );
}
