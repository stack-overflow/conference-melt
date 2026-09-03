import { useRef, type KeyboardEvent } from "react";
import styles from "./DayTabs.module.css";
import { useData } from "../../data/index";
import type { Day } from "../../data/types";
import { useStore } from "../../state/store";

function dateOf(day: Day): string {
  const prefix = `${day.label}, `;
  return day.labelLong.startsWith(prefix) ? day.labelLong.slice(prefix.length) : day.labelLong;
}

export function DayTabs() {
  const { data } = useData();
  const current = useStore((s) => s.day);
  const setDay = useStore((s) => s.setDay);
  const buttons = useRef<Map<string, HTMLButtonElement>>(new Map());
  const days = data.days;

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number): void => {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % days.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + days.length) % days.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = days.length - 1;
    if (next === null) return;
    e.preventDefault();
    const target = days[next];
    if (!target) return;
    setDay(target.id);
    buttons.current.get(target.id)?.focus();
  };

  return (
    <div className={styles.tabs} role="tablist" aria-label="Dzień festiwalu">
      {days.map((day, i) => {
        const selected = day.id === current;
        return (
          <button
            key={day.id}
            ref={(el) => {
              if (el) buttons.current.set(day.id, el);
              else buttons.current.delete(day.id);
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            data-day={day.id}
            onClick={() => setDay(day.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <span className={styles.label}>{day.label}</span>
            <span className={styles.short}>{day.short}</span>
            <span className={styles.date}>{dateOf(day)}</span>
          </button>
        );
      })}
    </div>
  );
}
