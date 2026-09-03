/** Same union as `Settings["theme"]` in `src/state/store.ts`; duplicated here so this module has no store dependency. */
type ThemeSetting = "system" | "dark" | "light";

const LIGHT_QUERY = "(prefers-color-scheme: light)";

function lightQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(LIGHT_QUERY);
}

function systemTheme(): "dark" | "light" {
  return lightQuery()?.matches ? "light" : "dark";
}

/** Sets `data-theme` on `<html>`; `tokens.css` keeps dark values on `:root` and light ones under `[data-theme="light"]`. */
export function applyTheme(theme: ThemeSetting): void {
  const resolved = theme === "system" ? systemTheme() : theme;
  document.documentElement.dataset.theme = resolved;
}

/** Re-applies the system theme on OS changes while `get()` is `"system"`. Returns the unsubscribe function. */
export function watchSystemTheme(get: () => ThemeSetting): () => void {
  const mql = lightQuery();
  if (!mql) return () => {};
  const onChange = () => {
    if (get() === "system") applyTheme("system");
  };
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}
