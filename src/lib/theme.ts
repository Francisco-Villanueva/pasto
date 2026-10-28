export const THEMES = ["arena", "carbon"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = "pasto-theme";

export function parseTheme(value: unknown): Theme | null {
  return THEMES.find((theme) => theme === value) ?? null;
}

/** Tema efectivo: el elegido a mano o, si no hay, el del sistema. */
export function resolveTheme(stored: unknown, systemPrefersDark: boolean): Theme {
  return parseTheme(stored) ?? (systemPrefersDark ? "carbon" : "arena");
}

export function nextTheme(current: Theme): Theme {
  return current === "arena" ? "carbon" : "arena";
}

/** Script que corre antes de pintar para evitar el destello de tema. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="arena"||t==="carbon")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
