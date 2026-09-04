import { useId, useState } from "react";
import type { SignupStatus } from "../../data/types";
import { normalizeText } from "../../domain/normalize";
import styles from "./Facet.module.css";

export type FacetValue = number | SignupStatus;

export interface FacetOption {
  value: FacetValue;
  label: string;
  count: number;
  /** Sub-header the option sits under (level label for Miejsce), null for flat facets. */
  group: string | null;
}

export interface FacetProps {
  title: string;
  options: FacetOption[];
  selected: readonly FacetValue[];
  defaultOpen: boolean;
  searchable: boolean;
  onToggle(value: FacetValue): void;
  onClear(): void;
}

interface OptionGroup {
  group: string | null;
  options: FacetOption[];
}

/** Consecutive options with the same group label form one block; options arrive already ordered. */
function groupOptions(options: FacetOption[]): OptionGroup[] {
  const groups: OptionGroup[] = [];
  for (const option of options) {
    const last = groups[groups.length - 1];
    if (last && last.group === option.group) last.options.push(option);
    else groups.push({ group: option.group, options: [option] });
  }
  return groups;
}

export function Facet({ title, options, selected, defaultOpen, searchable, onToggle, onClear }: FacetProps) {
  const [query, setQuery] = useState("");
  const baseId = useId();
  const needle = normalizeText(query.trim());
  const shown = needle === "" ? options : options.filter((o) => normalizeText(o.label).includes(needle));
  const selectedSet = new Set<FacetValue>(selected);
  const groups = groupOptions(shown);
  const hasTools = searchable || selected.length > 0;

  return (
    <details className={styles.facet} open={defaultOpen}>
      <summary className={styles.summary}>
        <span className={styles.title}>{title}</span>
        {selected.length > 0 ? <span className={styles.badge}>{selected.length}</span> : null}
      </summary>
      <div className={styles.body}>
        {hasTools ? (
          <div className={styles.tools}>
            {searchable ? (
              <input
                type="search"
                className={styles.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj"
                aria-label={`Szukaj: ${title}`}
              />
            ) : null}
            {selected.length > 0 ? (
              <button type="button" className={styles.clear} onClick={onClear} aria-label={`Wyczyść: ${title}`}>
                Wyczyść
              </button>
            ) : null}
          </div>
        ) : null}
        {groups.map((grp, gi) => (
          <div key={`${grp.group ?? ""}#${gi}`} className={styles.group}>
            {grp.group !== null ? <div className={styles.groupLabel}>{grp.group}</div> : null}
            <ul className={styles.options}>
              {grp.options.map((o) => {
                const countId = `${baseId}-${String(o.value)}`;
                return (
                  <li key={String(o.value)}>
                    <label className={styles.option} data-dimmed={o.count === 0 ? "true" : undefined}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={selectedSet.has(o.value)}
                        onChange={() => onToggle(o.value)}
                        aria-label={o.label}
                        aria-describedby={countId}
                      />
                      <span className={styles.name}>{o.label}</span>
                      <span className={styles.count} id={countId}>
                        {o.count}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {shown.length === 0 ? <p className={styles.empty}>Brak pasujących opcji</p> : null}
      </div>
    </details>
  );
}
