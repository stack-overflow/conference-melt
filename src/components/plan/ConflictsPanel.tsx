import { useId } from "react";
import type { Session } from "../../data/types";
import { useData } from "../../data/index";
import { locationLabel } from "../../domain/lookup";
import type { PlanSummary } from "../../domain/plan";
import { formatRange } from "../../domain/time";
import { useStore } from "../../state/store";
import styles from "./ConflictsPanel.module.css";

export interface ConflictsPanelProps {
  conflicts: PlanSummary["conflicts"];
  preview: boolean;
}

function Side({ session, preview }: { session: Session; preview: boolean }) {
  const { index } = useData();
  const removeFavourite = useStore((s) => s.removeFavourite);
  const addFavourites = useStore((s) => s.addFavourites);
  const pushToast = useStore((s) => s.pushToast);
  const time = session.start === null ? "Bez godziny" : formatRange(session.start, session.end);
  const location = locationLabel(session, index);

  const remove = (): void => {
    removeFavourite(session.id);
    pushToast(`Usunięto z planu: ${session.title}`, { label: "Cofnij", run: () => addFavourites([session.id]) });
  };

  return (
    <div className={styles.side}>
      <span className={styles.time}>{time}</span>
      <span className={styles.title}>{session.title}</span>
      {location !== "" && <span className={styles.location}>{location}</span>}
      {!preview && (
        <button type="button" className={styles.remove} aria-label={`Usuń z planu: ${session.title}`} onClick={remove}>
          Usuń z planu
        </button>
      )}
    </div>
  );
}

/** Spec §7.5: every overlapping pair across all days, grouped by day; removal is undoable through the toast. */
export function ConflictsPanel({ conflicts, preview }: ConflictsPanelProps) {
  const headingId = useId();
  if (conflicts.length === 0) return null;

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Konflikty w planie
      </h2>
      {conflicts.map((group) => (
        <div key={group.day.id} className={styles.day}>
          <h3 className={styles.dayLabel}>{group.day.labelLong}</h3>
          <ul className={styles.pairs}>
            {group.pairs.map((pair) => (
              <li key={`${pair.a.id}|${pair.b.id}`} className={styles.pair}>
                <Side session={pair.a} preview={preview} />
                <Side session={pair.b} preview={preview} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
