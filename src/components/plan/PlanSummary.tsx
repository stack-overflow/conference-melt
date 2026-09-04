import type { Session } from "../../data/types";
import { useData } from "../../data/index";
import { minutesUntil, nowFor } from "../../domain/now";
import type { PlanSummary as PlanSummaryData } from "../../domain/plan";
import { plural } from "../../domain/plural";
import styles from "./PlanSummary.module.css";

export interface PlanSummaryProps {
  summary: PlanSummaryData;
  next: Session | null;
  now: Date;
}

/** Polish plural for "konflikt": 1 konflikt, 2–4 konflikty, 5+ konfliktów (22–24 → konflikty, 12–14 → konfliktów). */
function conflictLabel(n: number): string {
  return `${n} ${plural(n, "konflikt", "konflikty", "konfliktów")}`;
}

export function PlanSummary({ summary, next, now }: PlanSummaryProps) {
  const { index } = useData();
  const perDay = summary.perDay
    .filter((p) => p.count > 0)
    .map((p) => `${p.day.short} ${p.count}`)
    .join(" · ");

  let nextText: string | null = null;
  if (next !== null && next.start !== null) {
    const day = index.dayById.get(next.day);
    const nowMinutes = day ? nowFor(day, now) : null;
    if (nowMinutes !== null) {
      const minutes = minutesUntil(next.start, nowMinutes);
      nextText = minutes === 0 ? `Następne: ${next.title} teraz` : `Następne: ${next.title} za ${minutes} min`;
    }
  }

  return (
    <div className={styles.bar}>
      <span className={styles.days}>{perDay}</span>
      {summary.conflictCount > 0 && <span className={styles.conflicts}>{conflictLabel(summary.conflictCount)}</span>}
      {nextText !== null && <span className={styles.next}>{nextText}</span>}
    </div>
  );
}
