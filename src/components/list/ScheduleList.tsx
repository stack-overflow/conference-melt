import type { ListGroup } from "../../state/derive";
import { useStore } from "../../state/store";
import { useData } from "../../data/index";
import { liveState, nowFor } from "../../domain/now";
import { SessionCard } from "../grid/SessionCard";
import styles from "./ScheduleList.module.css";

/** DOM id of the first group with a live or soon session; that section also carries `data-live-group`, which the LiveChip queries in list view. */
export const LIVE_GROUP_ID = "list-live";

interface Props {
  groups: ListGroup[];
}

/** Group keys come from listGroups and may hold any text; ids must not contain spaces. */
function domId(key: string): string {
  return `list-group-${key.replace(/[^\p{L}\p{N}_-]/gu, "_")}`;
}

export function ScheduleList({ groups }: Props) {
  const dayId = useStore((s) => s.day);
  const now = useStore((s) => s.now);
  const { index } = useData();
  const day = index.dayById.get(dayId);
  const nowMinutes = day ? nowFor(day, now) : null;

  const liveKey =
    nowMinutes === null
      ? null
      : (groups.find((g) =>
          g.sessions.some((s) => {
            const state = liveState(s, nowMinutes);
            return state === "live" || state === "soon";
          }),
        )?.key ?? null);

  if (groups.length === 0) return null;

  return (
    <div className={styles.list}>
      {groups.map((g) => {
        const headingId = domId(g.key);
        const showParallel = g.parallel >= 2 && g.parallel !== g.total;
        return (
          <section
            key={g.key}
            id={g.key === liveKey ? LIVE_GROUP_ID : undefined}
            data-live-group={g.key === liveKey ? "" : undefined}
            className={styles.group}
            aria-labelledby={headingId}
          >
            <header className={styles.header}>
              <h2 id={headingId} className={styles.label}>
                {g.label}
              </h2>
              <span className={styles.meta}>{g.total} wydarzeń</span>
              {showParallel ? <span className={styles.parallel}>{g.parallel} równolegle</span> : null}
            </header>
            <ul className={styles.rows}>
              {g.sessions.map((s) => (
                <li key={s.id} className={styles.row}>
                  <SessionCard session={s} showLocation variant="row" />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
