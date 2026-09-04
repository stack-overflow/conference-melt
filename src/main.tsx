import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/print.css";
import App from "./App";
import { DataProvider, data, index, search } from "./data/index";
import { STORAGE_KEY, useStore, type SharedPlan, type View } from "./state/store";
import { resolveBoot } from "./state/boot";
import { clock } from "./state/clock";
import { plural } from "./domain/plural";
import { parseHash, writeHash, type HashState } from "./state/hash";
import { applyTheme, watchSystemTheme } from "./state/theme";

const STORAGE_TOAST = "Nie mogę zapisać ulubionych w tej przeglądarce";

function isView(v: string | undefined): v is View {
  return v === "grid" || v === "list" || v === "plan";
}

/** The view persisted by Zustand's persist middleware, or null when nothing usable is stored. */
function readPersistedView(): View | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const state = (parsed as { state?: { view?: unknown } }).state;
    const view = state?.view;
    return typeof view === "string" && isView(view) ? view : null;
  } catch {
    return null;
  }
}

function boot(): void {
  const now = clock.now();
  const planParam = parseHash(window.location.hash).plan;
  const initial = useStore.getState();

  // resolveBoot keeps only the persisted favourites that exist in this snapshot and counts the rest.
  const resolved = resolveBoot({
    hash: window.location.hash,
    persistedView: readPersistedView(),
    persistedFavourites: initial.favourites,
    viewportWidth: window.innerWidth,
    data,
    index,
    now,
  });

  useStore.setState({
    day: resolved.day,
    view: resolved.view,
    sharedPlan: resolved.sharedPlan,
    favourites: resolved.favourites,
    now,
  });
  if (resolved.droppedFavourites > 0) {
    const n = resolved.droppedFavourites;
    const noun = plural(
      n,
      "zapisane wydarzenie, którego nie ma",
      "zapisane wydarzenia, których nie ma",
      "zapisanych wydarzeń, których nie ma",
    );
    initial.pushToast(`Pominięto ${n} ${noun} w tej wersji harmonogramu`);
  }
  if (initial.storageFailed) initial.pushToast(STORAGE_TOAST);
  useStore.subscribe((state, previous) => {
    if (state.storageFailed && !previous.storageFailed) state.pushToast(STORAGE_TOAST);
  });

  // URL hash: written on every day / view / sharedPlan change; `plan` survives until the banner is answered.
  const hashFor = (state: { day: string; view: View; sharedPlan: SharedPlan | null }): HashState => ({
    d: state.day,
    v: state.view,
    plan: state.sharedPlan !== null && planParam !== undefined ? planParam : undefined,
  });
  writeHash(hashFor(useStore.getState()));
  useStore.subscribe((state, previous) => {
    if (state.day !== previous.day || state.view !== previous.view || state.sharedPlan !== previous.sharedPlan) {
      writeHash(hashFor(state));
    }
  });
  window.addEventListener("hashchange", () => {
    const hash = parseHash(window.location.hash);
    const state = useStore.getState();
    if (hash.d !== undefined && index.dayById.has(hash.d) && hash.d !== state.day) state.setDay(hash.d);
    if (isView(hash.v) && hash.v !== state.view) state.setView(hash.v);
  });

  // Theme: apply at boot, follow the system while "system" is selected, re-apply on every change.
  applyTheme(useStore.getState().settings.theme);
  watchSystemTheme(() => useStore.getState().settings.theme);
  useStore.subscribe((state, previous) => {
    if (state.settings.theme !== previous.settings.theme) applyTheme(state.settings.theme);
  });

  // Clock: `now` was set once above from the shared clock; App's effect advances it every 30 s.

  const root = document.getElementById("root");
  if (!root) throw new Error("Brak elementu #root w index.html");
  createRoot(root).render(
    <StrictMode>
      <DataProvider value={{ data, index, search }}>
        <App />
      </DataProvider>
    </StrictMode>,
  );
}

boot();
