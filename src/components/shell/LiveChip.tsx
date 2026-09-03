import { useState } from "react";
import styles from "./LiveChip.module.css";
import { useData } from "../../data/index";
import { useStore } from "../../state/store";
import { prefersReducedMotion, useTier } from "../../state/useMediaQuery";
import { isToday, isTomorrow, liveState, nowFor } from "../../domain/now";
import { formatTime } from "../../domain/time";

/**
 * Grid view: the grid's now line carries `data-now-line`.
 * List view: a group holding a live or soon session carries `data-live-group`.
 */
function scrollToNow(layout: "grid" | "list"): void {
  const selector = layout === "grid" ? "[data-now-line]" : "[data-live-group]";
  const target = document.querySelector<HTMLElement>(selector);
  if (!target || typeof target.scrollIntoView !== "function") return;
  target.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

export function LiveChip() {
  const { data, index } = useData();
  const dayId = useStore((s) => s.day);
  const now = useStore((s) => s.now);
  const view = useStore((s) => s.view);
  const planLayout = useStore((s) => s.settings.planLayout);
  const mobile = useTier() === "mobile";
  const [expanded, setExpanded] = useState(false);

  const day = index.dayById.get(dayId) ?? data.days.find((d) => d.id === dayId);
  if (!day) return null;
  const sessions = index.sessionsByDay.get(day.id) ?? [];

  if (isToday(day, now)) {
    const nowMinutes = nowFor(day, now);
    if (nowMinutes === null) return null;
    const live = sessions.filter((s) => liveState(s, nowMinutes) === "live").length;
    const text = `Teraz ${formatTime(nowMinutes)} · trwa ${live}`;
    const collapsed = mobile && !expanded;
    const layout = view === "plan" ? planLayout : view;
    const onClick = (): void => {
      if (collapsed) {
        setExpanded(true);
        return;
      }
      scrollToNow(layout);
    };
    return (
      <button
        type="button"
        className={styles.chip}
        data-live="true"
        aria-label={collapsed ? text : undefined}
        title={collapsed ? text : undefined}
        onClick={onClick}
      >
        <span className={styles.dot} aria-hidden="true" />
        {collapsed ? `· ${live}` : text}
      </button>
    );
  }

  if (isTomorrow(day, now)) {
    const starts = sessions.map((s) => s.start).filter((start): start is number => start !== null);
    if (starts.length === 0) return null;
    return <span className={styles.chip}>{`Jutro od ${formatTime(Math.min(...starts))}`}</span>;
  }

  return null;
}
