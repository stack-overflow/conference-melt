import { useMemo } from "react";
import { createPortal } from "react-dom";
import { useData } from "../../data/index";
import { planSessions } from "../../domain/plan";
import { planLines } from "../../domain/text";
import { usePlanSet } from "../../state/store";
import styles from "./PrintPlan.module.css";

const NO_TIME_HEADING = "Bez godziny";

/**
 * Print-only rendering of the plan set (spec §7.5). App renders it once in every view.
 * Portalled to <body> so print.css can hide every other body child with `body > *`.
 * The global class `print-plan` is what print.css targets; the module class only adds screen-safe resets.
 */
export function PrintPlan() {
  const { data, index } = useData();
  const planSet = usePlanSet();
  const entries = useMemo(() => planLines(planSessions(planSet, data.sessions), data, index), [planSet, data, index]);

  return createPortal(
    <section className={`print-plan ${styles.section}`} aria-hidden="true">
      <h1>Mój plan · ŚwiatłoSiła 2026</h1>
      {entries.length === 0 && <p>Twój plan jest pusty</p>}
      {entries.map((entry) => (
        <div key={entry.day ? entry.day.id : "no-time"}>
          <h2>{entry.day ? entry.day.labelLong : NO_TIME_HEADING}</h2>
          <ul>
            {entry.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>,
    document.body,
  );
}
