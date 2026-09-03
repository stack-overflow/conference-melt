import { useMemo, type ReactNode } from "react";
import styles from "./ScheduleGrid.module.css";
import { useData } from "../../data/index";
import type { ScheduleData } from "../../data/types";
import { activeFilterCount, signupLabel, type Filters } from "../../domain/filters";
import type { DataIndex } from "../../domain/lookup";
import { nowFor } from "../../domain/now";
import type { Column, DaySets, ResolvedTime } from "../../state/derive";
import { useStore } from "../../state/store";
import { Chip } from "../ui/Chip";
import { EmptyState } from "../ui/EmptyState";
import { cx } from "../ui/cx";
import { coarsePointer, densityFor } from "./gridLayout";
import { TimelineBody } from "./TimelineBody";

export interface ScheduleGridProps {
  sets: DaySets;
  columns: Column[];
  resolved: ResolvedTime;
  dayId: string;
}

const FILTERED_EMPTY = "Brak wydarzeń dla tych filtrów";
const STRIP_ONLY_EMPTY = "Wszystkie pasujące wydarzenia są całodniowe lub bez godziny. Znajdziesz je powyżej";

/** Labels of every active filter, in FilterChips order, for the empty states (PlanView may reuse it). */
export function filterLabels(filters: Filters, data: ScheduleData, index: DataIndex): string[] {
  const labels = [
    ...filters.types.map((id) => index.typeById.get(id)?.name ?? String(id)),
    ...filters.locations.map((id) => index.locationById.get(id)?.short ?? String(id)),
    ...filters.themes.map((id) => index.themeById.get(id)?.name ?? String(id)),
    ...filters.brands.map((id) => index.brandById.get(id)?.name ?? String(id)),
    ...filters.signup.map((status) => signupLabel(status, data)),
  ];
  if (filters.query.trim().length > 0) labels.push(`Szukaj: „${filters.query}”`);
  if (filters.onlyFavourites) labels.push("Tylko ulubione");
  if (filters.hideAllDay) labels.push("Ukryj strefy całodniowe");
  return labels;
}

export interface FilteredEmptyProps {
  /** Title line; defaults to the spec §9 "Brak wydarzeń dla tych filtrów". */
  text?: string;
  /** Extra buttons, rendered between the filter chips and "Wyczyść filtry". */
  extraActions?: ReactNode;
}

/**
 * Spec §9: the filter empty state — the title, one chip per active filter and "Wyczyść filtry"
 * only while a filter is on. Both grid empty states render through it; PlanView (Task 33) reuses it.
 */
export function FilteredEmpty({ text = FILTERED_EMPTY, extraActions }: FilteredEmptyProps) {
  const { data, index } = useData();
  const filters = useStore((s) => s.filters);
  const clearFilters = useStore((s) => s.clearFilters);
  const labels = filterLabels(filters, data, index);

  return (
    <EmptyState
      title={text}
      actions={
        <>
          {labels.length > 0 && (
            <span className={styles.chips}>
              {labels.map((label, i) => (
                <Chip key={`${i}-${label}`} tone="accent">
                  {label}
                </Chip>
              ))}
            </span>
          )}
          {extraActions}
          {activeFilterCount(filters) > 0 && (
            <button type="button" className={cx(styles.button, styles.secondary)} onClick={clearFilters}>
              Wyczyść filtry
            </button>
          )}
        </>
      }
    />
  );
}

/** Spec §9: replaces the scroll container whenever the rendered set is empty. */
function GridEmpty({ sets }: { sets: DaySets }) {
  const setSettings = useStore((s) => s.setSettings);
  const stripOnly = sets.visible.length > 0;

  return (
    <FilteredEmpty
      text={stripOnly ? STRIP_ONLY_EMPTY : FILTERED_EMPTY}
      extraActions={
        stripOnly && sets.stripAllDay.length > 0 ? (
          <button type="button" className={styles.button} onClick={() => setSettings({ allDayStrip: false })}>
            Pokaż w siatce
          </button>
        ) : undefined
      }
    />
  );
}

export function ScheduleGrid({ sets, columns, resolved, dayId }: ScheduleGridProps) {
  const { index } = useData();
  const densitySetting = useStore((s) => s.settings.density);
  const now = useStore((s) => s.now);
  const density = useMemo(() => densityFor(densitySetting, coarsePointer()), [densitySetting]);
  const day = index.dayById.get(dayId);
  const nowMinutes = day ? nowFor(day, now) : null;

  return (
    <section className={styles.grid} aria-label="Siatka harmonogramu">
      {sets.rendered.length === 0 ? (
        <GridEmpty sets={sets} />
      ) : (
        <div key={`${resolved.mode}:${dayId}`} className={styles.fade}>
          <TimelineBody sets={sets} columns={columns} density={density} nowMinutes={nowMinutes} dayId={dayId} />
        </div>
      )}
    </section>
  );
}
