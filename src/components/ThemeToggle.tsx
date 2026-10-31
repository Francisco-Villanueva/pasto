"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, nextTheme, resolveTheme, type Theme } from "@/lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function currentTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  return resolveTheme(attr, window.matchMedia(DARK_QUERY).matches);
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

export function ThemeToggle({ iconOnly = false }: { iconOnly?: boolean }) {
  const theme = useSyncExternalStore<Theme | null>(subscribe, currentTheme, () => null);

  function toggle() {
    const next = nextTheme(currentTheme());
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Sin almacenamiento: el tema vale solo para esta visita.
    }
  }

  const label = theme === "carbon" ? "Tema Arena" : "Tema Carbón";
  if (iconOnly) {
    const Glyph = theme === "carbon" ? Sun : Moon;
    return (
      <button type="button" className="pasto-iconbtn" onClick={toggle} title={label}>
        <Glyph size={18} strokeWidth={2} aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </button>
    );
  }
  return (
    <button type="button" className="theme-btn" onClick={toggle}>
      {label}
    </button>
  );
}
