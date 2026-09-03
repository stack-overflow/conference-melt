import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { SignupStatus } from "../data/types";
import type { ColorBy } from "../domain/colors";
import { EMPTY_FILTERS, type Facet, type Filters } from "../domain/filters";
import { parseHash, writeHash } from "./hash";

export type View = "grid" | "list" | "plan";
export type ColumnAxis = "location" | "type" | "brand" | "level" | "none";
export type TimeMode = "auto" | "slots" | "timeline";

export interface Settings {
  columnAxis: ColumnAxis;
  timeMode: TimeMode;
  slotTolerance: number;
  zoom: number;
  density: "compact" | "comfortable";
  colorBy: ColorBy;
  showAvatars: boolean;
  allDayStrip: boolean;
  planLayout: "grid" | "list";
  theme: "system" | "dark" | "light";
}

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

export type SheetKind = "filters" | "settings" | "detail" | "copy" | null;

export interface SharedPlan {
  ids: string[];
  unknown: number;
}

export interface State {
  day: string;
  view: View;
  filters: Filters;
  settings: Settings;
  favourites: string[];
  selectedSessionId: string | null;
  openSheet: SheetKind;
  sharedPlan: SharedPlan | null;
  previewPlan: string[] | null;
  now: Date;
  toasts: Toast[];
  copyText: string | null;
  storageFailed: boolean;
}

export interface Actions {
  setDay(day: string): void;
  setView(view: View): void;
  setFilters(patch: Partial<Filters>): void;
  clearFilters(): void;
  clearFacet(facet: Facet): void;
  toggleFacetValue(facet: Facet, value: number | SignupStatus): void;
  setSettings(patch: Partial<Settings>): void;
  resetSettings(): void;
  toggleFavourite(id: string): void;
  addFavourites(ids: string[]): void;
  removeFavourite(id: string): void;
  selectSession(id: string | null): void;
  setSheet(kind: SheetKind): void;
  setSharedPlan(plan: SharedPlan | null): void;
  loadSharedPlan(): void;
  previewSharedPlan(): void;
  dismissSharedPlan(): void;
  savePreview(): void;
  closePreview(): void;
  pushToast(text: string, action?: Toast["action"]): void;
  dismissToast(id: number): void;
  setNow(now: Date): void;
  setCopyText(text: string | null): void;
}

export type Store = State & Actions;

export const STORAGE_KEY = "swiatlosila-2026:v1";
export const MOBILE_BREAKPOINT = 700;

export function defaultSettings(viewportWidth: number): Settings {
  const mobile = viewportWidth < MOBILE_BREAKPOINT;
  return {
    columnAxis: mobile ? "none" : "location",
    timeMode: "auto",
    slotTolerance: 15,
    zoom: mobile ? 1.6 : 2,
    density: "comfortable",
    colorBy: "type",
    showAvatars: true,
    allDayStrip: true,
    planLayout: "list",
    theme: "system",
  };
}

export function defaultView(viewportWidth: number): View {
  return viewportWidth < MOBILE_BREAKPOINT ? "list" : "grid";
}

function viewportWidth(): number {
  return typeof window === "undefined" ? 1024 : window.innerWidth;
}

/** Appends the ids of `extra` that are not already in `base`, keeping order. */
function union(base: string[], extra: string[]): string[] {
  const seen = new Set(base);
  const out = [...base];
  for (const id of extra) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Replaces one facet's values; numbers go to the id facets, statuses to `signup`. */
function setFacet(f: Filters, facet: Facet, values: (number | SignupStatus)[]): Filters {
  const numbers = values.filter((v): v is number => typeof v === "number");
  const statuses = values.filter((v): v is SignupStatus => typeof v === "string");
  switch (facet) {
    case "types":
      return { ...f, types: numbers };
    case "themes":
      return { ...f, themes: numbers };
    case "brands":
      return { ...f, brands: numbers };
    case "locations":
      return { ...f, locations: numbers };
    case "signup":
      return { ...f, signup: statuses };
  }
}

/** Writes `#d=&v=`; the `plan` parameter is kept verbatim only while a shared plan awaits the banner. */
function syncHash(state: State): void {
  const plan =
    state.sharedPlan !== null && typeof window !== "undefined" ? parseHash(window.location.hash).plan : undefined;
  writeHash({ d: state.day, v: state.view, plan });
}

// Storage adapter: every localStorage call is guarded so private mode or a full quota
// degrades to memory. Failures before the store exists are replayed right after creation.
let storageFailedEarly = false;
let reportStorageFailure: () => void = () => {
  storageFailedEarly = true;
};

const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return globalThis.localStorage.getItem(name);
    } catch {
      reportStorageFailure();
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.localStorage.setItem(name, value);
    } catch {
      reportStorageFailure();
    }
  },
  removeItem: (name) => {
    try {
      globalThis.localStorage.removeItem(name);
    } catch {
      reportStorageFailure();
    }
  },
};

type PersistedSlice = Pick<State, "favourites" | "settings" | "view">;

function initialState(): State {
  const width = viewportWidth();
  return {
    day: "",
    view: defaultView(width),
    filters: { ...EMPTY_FILTERS },
    settings: defaultSettings(width),
    favourites: [],
    selectedSessionId: null,
    openSheet: null,
    sharedPlan: null,
    previewPlan: null,
    now: new Date(),
    toasts: [],
    copyText: null,
    storageFailed: false,
  };
}

let toastSeq = 0;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState(),

      setDay: (day) => {
        set({ day });
        syncHash(get());
      },
      setView: (view) => {
        set((s) => ({ view, previewPlan: view === "plan" ? s.previewPlan : null }));
        syncHash(get());
      },

      setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
      clearFilters: () => set({ filters: { ...EMPTY_FILTERS } }),
      clearFacet: (facet) => set((s) => ({ filters: setFacet(s.filters, facet, []) })),
      toggleFacetValue: (facet, value) =>
        set((s) => {
          const current: (number | SignupStatus)[] = s.filters[facet];
          return { filters: setFacet(s.filters, facet, toggleIn(current, value)) };
        }),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetSettings: () =>
        set((s) => ({
          settings: { ...defaultSettings(viewportWidth()), theme: s.settings.theme, planLayout: s.settings.planLayout },
        })),

      toggleFavourite: (id) => set((s) => ({ favourites: toggleIn(s.favourites, id) })),
      addFavourites: (ids) => set((s) => ({ favourites: union(s.favourites, ids) })),
      removeFavourite: (id) => set((s) => ({ favourites: s.favourites.filter((f) => f !== id) })),

      selectSession: (id) =>
        set((s) => ({
          selectedSessionId: id,
          openSheet: id !== null ? "detail" : s.openSheet === "detail" ? null : s.openSheet,
        })),
      setSheet: (kind) => set({ openSheet: kind }),

      setSharedPlan: (plan) => set({ sharedPlan: plan }),
      loadSharedPlan: () => {
        const shared = get().sharedPlan;
        if (shared === null) return;
        set((s) => ({ favourites: union(s.favourites, shared.ids), sharedPlan: null }));
        syncHash(get());
      },
      previewSharedPlan: () => {
        const shared = get().sharedPlan;
        if (shared === null) return;
        set({ previewPlan: shared.ids, view: "plan", sharedPlan: null });
        syncHash(get());
      },
      dismissSharedPlan: () => {
        set({ sharedPlan: null });
        syncHash(get());
      },

      savePreview: () => {
        const preview = get().previewPlan;
        if (preview === null) return;
        set((s) => ({ favourites: union(s.favourites, preview), previewPlan: null }));
      },
      closePreview: () => set({ previewPlan: null }),

      // The Toasts component owns the display timer; the store only queues and removes.
      pushToast: (text, action) => {
        const id = ++toastSeq;
        const toast: Toast = action ? { id, text, action } : { id, text };
        set((s) => ({ toasts: [...s.toasts, toast] }));
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      setNow: (now) => set({ now }),
      setCopyText: (text) => set({ copyText: text }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s): PersistedSlice => ({ favourites: s.favourites, settings: s.settings, view: s.view }),
      // Reserved for future shape changes; version 1 is returned unchanged.
      migrate: (persisted) => persisted as PersistedSlice,
      // Runs on every hydration: a Settings field missing from storage gets its default
      // without a version bump and without wiping the other stored choices.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersistedSlice>;
        return { ...current, ...p, settings: { ...defaultSettings(viewportWidth()), ...p.settings } };
      },
    },
  ),
);

reportStorageFailure = () => {
  if (!useStore.getState().storageFailed) useStore.setState({ storageFailed: true });
};
if (storageFailedEarly) reportStorageFailure();

// The plan set is memoized on the identity of `previewPlan ?? favourites`, so selectors
// built on it return a stable Set until membership actually changes.
let cachedSource: string[] | null = null;
let cachedSet: ReadonlySet<string> = new Set<string>();

export function planSetOf(state: State): ReadonlySet<string> {
  const source = state.previewPlan ?? state.favourites;
  if (source !== cachedSource) {
    cachedSource = source;
    cachedSet = new Set(source);
  }
  return cachedSet;
}

export function usePlanSet(): ReadonlySet<string> {
  return useStore(planSetOf);
}
