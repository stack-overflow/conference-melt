import styles from "./FilterChips.module.css";
import { useData } from "../../data/index";
import { useStore } from "../../state/store";
import { activeFilterCount, signupLabel } from "../../domain/filters";
import { Chip } from "../ui/Chip";

interface ActiveChip {
  key: string;
  label: string;
  remove(): void;
}

export function FilterChips() {
  const { data, index } = useData();
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const clearFilters = useStore((s) => s.clearFilters);
  const toggleFacetValue = useStore((s) => s.toggleFacetValue);

  if (activeFilterCount(filters) === 0) return null;

  const chips: ActiveChip[] = [];
  for (const id of filters.types) {
    chips.push({ key: `types-${id}`, label: index.typeById.get(id)?.name ?? String(id), remove: () => toggleFacetValue("types", id) });
  }
  for (const id of filters.locations) {
    chips.push({ key: `locations-${id}`, label: index.locationById.get(id)?.short ?? String(id), remove: () => toggleFacetValue("locations", id) });
  }
  for (const id of filters.themes) {
    chips.push({ key: `themes-${id}`, label: index.themeById.get(id)?.name ?? String(id), remove: () => toggleFacetValue("themes", id) });
  }
  for (const id of filters.brands) {
    chips.push({ key: `brands-${id}`, label: index.brandById.get(id)?.name ?? String(id), remove: () => toggleFacetValue("brands", id) });
  }
  for (const status of filters.signup) {
    chips.push({ key: `signup-${status}`, label: signupLabel(status, data), remove: () => toggleFacetValue("signup", status) });
  }
  if (filters.query.trim().length > 0) {
    chips.push({ key: "query", label: `Szukaj: „${filters.query}”`, remove: () => setFilters({ query: "" }) });
  }
  if (filters.onlyFavourites) {
    chips.push({ key: "onlyFavourites", label: "Tylko ulubione", remove: () => setFilters({ onlyFavourites: false }) });
  }
  if (filters.hideAllDay) {
    chips.push({ key: "hideAllDay", label: "Ukryj strefy całodniowe", remove: () => setFilters({ hideAllDay: false }) });
  }

  return (
    <div className={styles.row} role="group" aria-label="Aktywne filtry">
      {chips.map((chip) => (
        <Chip key={chip.key} tone="accent" onRemove={chip.remove}>
          {chip.label}
        </Chip>
      ))}
      <button type="button" className={styles.clear} onClick={clearFilters}>
        Wyczyść wszystko
      </button>
    </div>
  );
}
