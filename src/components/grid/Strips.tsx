import styles from "./Strips.module.css";
import type { Session } from "../../data/types";
import type { DaySets } from "../../state/derive";
import { SessionCard } from "./SessionCard";

export interface StripsProps {
  sets: DaySets;
}

function Strip({ label, sessions }: { label: string; sessions: Session[] }) {
  return (
    <div className={styles.strip} role="group" aria-label={label}>
      <span className={styles.label}>{label}</span>
      <div className={styles.row}>
        {sessions.map((s) => (
          <SessionCard key={s.id} session={s} variant="chip" showLocation={false} />
        ))}
      </div>
    </div>
  );
}

/**
 * Spec §7.2 strips, outside and above the scroll container. `daySets` already empties
 * `stripAllDay` while `settings.allDayStrip` is off, so the sets alone decide what renders.
 */
export function Strips({ sets }: StripsProps) {
  if (sets.stripAllDay.length === 0 && sets.stripNoTime.length === 0) return null;
  return (
    <div className={styles.strips} data-strips="">
      {sets.stripAllDay.length > 0 && <Strip label={`Całodniowe (${sets.stripAllDay.length})`} sessions={sets.stripAllDay} />}
      {sets.stripNoTime.length > 0 && <Strip label={`Bez godziny (${sets.stripNoTime.length})`} sessions={sets.stripNoTime} />}
    </div>
  );
}
