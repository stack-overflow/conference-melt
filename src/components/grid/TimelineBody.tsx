import { useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import styles from "./TimelineBody.module.css";
import { formatTime } from "../../domain/time";
import type { Column, DaySets } from "../../state/derive";
import { useStore } from "../../state/store";
import { prefersReducedMotion } from "../../state/useMediaQuery";
import { ColumnHeader } from "./ColumnHeader";
import { NowLine } from "./NowLine";
import { SessionCard } from "./SessionCard";
import { TimeRail } from "./TimeRail";
import {
  cardStyle,
  nowScrollTop,
  sortByStartTitle,
  timelineGeometry,
  timelineRange,
  type Density,
} from "./gridLayout";

export interface TimelineBodyProps {
  sets: DaySets;
  columns: Column[];
  density: Density;
  nowMinutes: number | null;
  dayId: string;
}

/** Spec §8: entrance stagger of 12 ms per card, capped at 240 ms. */
const STAGGER_MS = 12;
const STAGGER_MAX_MS = 240;

function enterDelay(order: number): string {
  return `${Math.min(order * STAGGER_MS, STAGGER_MAX_MS)}ms`;
}

export function TimelineBody({ sets, columns, density, nowMinutes, dayId }: TimelineBodyProps) {
  const zoom = useStore((s) => s.settings.zoom);
  const axis = useStore((s) => s.settings.columnAxis);
  const compact = useStore((s) => s.settings.density === "compact");
  const showLocation = axis !== "location";
  const animate = !prefersReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);

  const range = useMemo(() => timelineRange(sets.layout), [sets.layout]);
  const placed = useMemo(
    () =>
      columns.map((column) => ({
        column,
        geometry: timelineGeometry(column, range, zoom, density),
        // DOM order follows start time so Tab order matches reading order (spec §7.3)
        cards: [...column.sessions].sort(sortByStartTitle).filter((s) => column.renderedIds.has(s.id)),
      })),
    [columns, range, zoom, density],
  );
  const bodyHeight = (range.end - range.start) * zoom;
  const lineTop =
    nowMinutes !== null && nowMinutes >= range.start && nowMinutes <= range.end
      ? (nowMinutes - range.start) * zoom
      : null;

  // First render for a day: put the now line a third of the way down the viewport (spec §7.2).
  useLayoutEffect(() => {
    if (lineTop === null || scrolledFor.current === dayId) return;
    scrolledFor.current = dayId;
    const el = scroller.current;
    if (!el || typeof el.scrollTo !== "function") return;
    el.scrollTo({ top: nowScrollTop(lineTop, el.clientHeight), behavior: "auto" });
  }, [dayId, lineTop]);

  const track = axis === "none" ? "minmax(calc(100% - var(--rail-width)), auto)" : "auto";
  const style = {
    gridTemplateColumns: `var(--rail-width) ${columns.map(() => track).join(" ")}`,
    "--half-hour": `${30 * zoom}px`,
  } as CSSProperties;

  let order = 0;

  return (
    <div ref={scroller} className={styles.scroller} style={style} data-scroll-container="timeline">
      <div className={styles.corner} style={{ gridColumn: "1", gridRow: "1" }} aria-hidden="true" />
      {placed.map(({ column, geometry }, i) => (
        <ColumnHeader
          key={column.key}
          column={column}
          className={styles.header}
          style={{ gridColumn: String(i + 2), gridRow: "1", minWidth: `${geometry.columnWidth}px` }}
        />
      ))}
      <TimeRail
        range={range}
        zoom={zoom}
        className={styles.rail}
        style={{ gridColumn: "1", gridRow: "2" }}
        now={lineTop === null || nowMinutes === null ? null : { top: lineTop, label: formatTime(nowMinutes) }}
      />
      {placed.map(({ column, geometry, cards }, i) => (
        <div
          key={column.key}
          className={styles.body}
          style={{ gridColumn: String(i + 2), gridRow: "2", height: `${bodyHeight}px`, minWidth: `${geometry.columnWidth}px` }}
          data-column={column.key}
        >
          {cards.map((s) => {
            const g = geometry.cards.get(s.id);
            if (!g) return null;
            const delay = animate ? enterDelay(order++) : undefined;
            return (
              <SessionCard
                key={s.id}
                session={s}
                variant="grid"
                compact={compact}
                showLocation={showLocation}
                style={{ ...cardStyle(g), animationDelay: delay }}
              />
            );
          })}
        </div>
      ))}
      {lineTop !== null && <NowLine style={{ gridColumn: "2 / -1", gridRow: "2", top: `${lineTop}px` }} />}
    </div>
  );
}
