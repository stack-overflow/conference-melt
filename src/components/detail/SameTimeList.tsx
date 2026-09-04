import { useMemo } from "react";
import type { Session } from "../../data/types";
import { useData } from "../../data/index";
import { usePlanSet, useStore } from "../../state/store";
import { overlaps } from "../../domain/overlaps";
import { formatRange } from "../../domain/time";
import { locationLabel } from "../../domain/lookup";
import { Star } from "../ui/Star";
import styles from "./SameTimeList.module.css";

interface Props {
  session: Session;
}

const HEADING_ID = "same-time-heading";

export function SameTimeList({ session }: Props) {
  const { index } = useData();
  const planSet = usePlanSet();
  const preview = useStore((s) => s.previewPlan !== null);
  const selectSession = useStore((s) => s.selectSession);
  const toggleFavourite = useStore((s) => s.toggleFavourite);

  const others = useMemo(
    () =>
      (index.sessionsByDay.get(session.day) ?? [])
        .filter((o) => o.id !== session.id && overlaps(session, o))
        .sort((a, b) => (a.start ?? 0) - (b.start ?? 0) || a.title.localeCompare(b.title, "pl")),
    [index, session],
  );

  if (others.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby={HEADING_ID}>
      <h3 id={HEADING_ID} className={styles.heading}>
        W tym samym czasie
      </h3>
      <ul className={styles.rows} aria-labelledby={HEADING_ID}>
        {others.map((o) => {
          const time = o.start === null ? "" : formatRange(o.start, o.end);
          const location = locationLabel(o, index);
          return (
            <li key={o.id} className={styles.row}>
              <button
                type="button"
                className={styles.main}
                aria-label={`${o.title}, ${time}, ${location}`}
                onClick={() => selectSession(o.id)}
              >
                <span className={styles.time}>{time}</span>
                <span className={styles.title}>{o.title}</span>
                <span className={styles.location}>{location}</span>
              </button>
              {preview ? null : <Star pressed={planSet.has(o.id)} onToggle={() => toggleFavourite(o.id)} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
