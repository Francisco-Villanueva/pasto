"use client";

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

export function ThemeToggle() {
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

  return (
    <button type="button" className="theme-btn" onClick={toggle}>
      {theme === "carbon" ? "Tema Arena" : "Tema Carbón"}
    </button>
  );
}
