import { useMemo } from "react";
import type { Location, SignupStatus, Term } from "../../data/types";
import { useData } from "../../data/index";
import { usePlanSet, useStore } from "../../state/store";
import { FACETS, SIGNUP_ORDER, activeFilterCount, facetCounts, signupLabel, type Facet as FacetKey } from "../../domain/filters";
import { Toggle } from "../ui/Toggle";
import { Facet, type FacetOption } from "./Facet";
import styles from "./FiltersPanel.module.css";

interface Props {
  variant: "sidebar" | "sheet";
}

const LEVEL_LABELS: Record<string, string> = {
  "0": "Poziom 0",
  I: "Poziom I",
  "I+II": "Poziom I i II",
  II: "Poziom II",
  III: "Poziom III",
};

function levelLabel(level: Location["level"]): string {
  return level === null ? "Inne" : LEVEL_LABELS[level];
}

function locationOptionLabel(l: Location): string {
  return l.room === null ? l.venue : `${l.venue} · ${l.room}`;
}

type Counts = Record<FacetKey, Map<number | SignupStatus, number>>;

function termOptions(terms: Term[], counts: Map<number | SignupStatus, number>): FacetOption[] {
  return terms.map((t) => ({ value: t.id, label: t.name, count: counts.get(t.id) ?? 0, group: null }));
}

export function FiltersPanel({ variant }: Props) {
  const { data, index, search } = useData();
  const filters = useStore((s) => s.filters);
  const day = useStore((s) => s.day);
  const view = useStore((s) => s.view);
  const toggleFacetValue = useStore((s) => s.toggleFacetValue);
  const clearFacet = useStore((s) => s.clearFacet);
  const clearFilters = useStore((s) => s.clearFilters);
  const setFilters = useStore((s) => s.setFilters);
  const planSet = usePlanSet();

  const base = useMemo(() => {
    const daySessions = index.sessionsByDay.get(day) ?? [];
    return view === "plan" ? daySessions.filter((s) => planSet.has(s.id)) : daySessions;
  }, [index, day, view, planSet]);

  const counts = useMemo(() => {
    const out: Partial<Counts> = {};
    for (const facet of FACETS) out[facet] = facetCounts(base, filters, facet, planSet, search);
    return out as Counts;
  }, [base, filters, planSet, search]);

  const locationOptions = useMemo<FacetOption[]>(
    () =>
      [...data.locations]
        .sort((a, b) => a.order - b.order)
        .map((l) => ({
          value: l.id,
          label: locationOptionLabel(l),
          count: counts.locations.get(l.id) ?? 0,
          group: levelLabel(l.level),
        })),
    [data.locations, counts.locations],
  );

  const signupOptions: FacetOption[] = SIGNUP_ORDER.map((status) => ({
    value: status,
    label: signupLabel(status, data),
    count: counts.signup.get(status) ?? 0,
    group: null,
  }));

  const active = activeFilterCount(filters);
  const Wrapper = variant === "sidebar" ? "aside" : "div";

  return (
    <Wrapper className={variant === "sidebar" ? styles.sidebar : styles.sheet} aria-label={variant === "sidebar" ? "Filtry" : undefined}>
      <div className={styles.head}>
        {variant === "sidebar" ? <h2 className={styles.heading}>Filtry</h2> : null}
        <button
          type="button"
          className={styles.clearAll}
          onClick={clearFilters}
          disabled={active === 0}
          aria-label="Wyczyść wszystkie filtry"
        >
          Wyczyść
        </button>
      </div>
      <Facet
        title="Typ"
        options={termOptions(data.types, counts.types)}
        selected={filters.types}
        defaultOpen
        searchable={false}
        onToggle={(v) => toggleFacetValue("types", v)}
        onClear={() => clearFacet("types")}
      />
      <Facet
        title="Miejsce"
        options={locationOptions}
        selected={filters.locations}
        defaultOpen
        searchable={false}
        onToggle={(v) => toggleFacetValue("locations", v)}
        onClear={() => clearFacet("locations")}
      />
      <Facet
        title="Tematyka"
        options={termOptions(data.themes, counts.themes)}
        selected={filters.themes}
        defaultOpen={false}
        searchable
        onToggle={(v) => toggleFacetValue("themes", v)}
        onClear={() => clearFacet("themes")}
      />
      <Facet
        title="Marka"
        options={termOptions(data.brands, counts.brands)}
        selected={filters.brands}
        defaultOpen={false}
        searchable
        onToggle={(v) => toggleFacetValue("brands", v)}
        onClear={() => clearFacet("brands")}
      />
      <Facet
        title="Zapisy"
        options={signupOptions}
        selected={filters.signup}
        defaultOpen
        searchable={false}
        onToggle={(v) => toggleFacetValue("signup", v)}
        onClear={() => clearFacet("signup")}
      />
      <div className={styles.toggles}>
        <Toggle checked={filters.hideAllDay} onChange={(v) => setFilters({ hideAllDay: v })} label="Ukryj strefy całodniowe" />
        <Toggle checked={filters.onlyFavourites} onChange={(v) => setFilters({ onlyFavourites: v })} label="Tylko ulubione" />
      </div>
    </Wrapper>
  );
}
