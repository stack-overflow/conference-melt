import { useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import styles from "./SlotBody.module.css";
import type { TimedSession } from "../../data/types";
import type { Slot } from "../../domain/slots";
import { formatRange, formatTime } from "../../domain/time";
import type { Column } from "../../state/derive";
import { useStore } from "../../state/store";
import { prefersReducedMotion } from "../../state/useMediaQuery";
import { ColumnHeader } from "./ColumnHeader";
import { ContinuationStub } from "./ContinuationStub";
import { NowChip, NowLine } from "./NowLine";
import { SessionCard } from "./SessionCard";
import {
  gridArea,
  nowScrollTop,
  slotCells,
  slotPlacements,
  type Density,
  type SlotCell,
  type SlotPlacement,
} from "./gridLayout";

export interface SlotBodyProps {
  columns: Column[];
  slots: Slot[];
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

/** Spec §7.2: the row r with slots[r].start <= now < slots[r].end, or -1. */
function nowRowOf(slots: Slot[], nowMinutes: number | null): number {
  if (nowMinutes === null) return -1;
  return slots.findIndex((slot) => slot.start <= nowMinutes && nowMinutes < slot.end);
}

/** One grid item: a cell wrapper (stubs, overflow, cards) or a spanning card; both are placed by (column, row). */
type GridItem =
  | { kind: "cell"; column: number; row: number; cell: SlotCell }
  | { kind: "span"; column: number; row: number; placement: SlotPlacement };

export function SlotBody({ columns, slots, density, nowMinutes, dayId }: SlotBodyProps) {
  const axis = useStore((s) => s.settings.columnAxis);
  const tolerance = useStore((s) => s.settings.slotTolerance);
  const compact = useStore((s) => s.settings.density === "compact");
  const showLocation = axis !== "location";
  const animate = !prefersReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);

  const { items, sessionById } = useMemo(() => {
    const placements = columns.flatMap((column, i) => slotPlacements(column, i, slots, tolerance, column.renderedIds));
    const sessionById = new Map<string, TimedSession>();
    for (const column of columns) {
      for (const s of column.sessions) sessionById.set(s.id, s);
    }
    const items: GridItem[] = [
      ...slotCells(placements).map((cell): GridItem => ({ kind: "cell", column: cell.column, row: cell.row, cell })),
      ...placements
        .filter((p) => p.kind === "span")
        .map((placement): GridItem => ({ kind: "span", column: placement.column, row: placement.row, placement })),
    ];
    // Spec §7.3: DOM order inside a column follows start time, so wrappers and spanning cards interleave by row.
    items.sort((a, b) => a.column - b.column || a.row - b.row);
    return { items, sessionById };
  }, [columns, slots, tolerance]);

  const nowRow = nowRowOf(slots, nowMinutes);

  // First render for a day: put the now line a third of the way down the viewport (spec §7.2).
  useLayoutEffect(() => {
    if (nowRow < 0 || scrolledFor.current === dayId) return;
    scrolledFor.current = dayId;
    const el = scroller.current;
    const line = el?.querySelector<HTMLElement>("[data-now-line]");
    if (!el || !line || typeof el.scrollTo !== "function") return;
    el.scrollTo({ top: nowScrollTop(line.offsetTop, el.clientHeight), behavior: "auto" });
  }, [dayId, nowRow]);

  const track = axis === "none" ? "minmax(calc(100% - var(--rail-width)), auto)" : `${density.minColumnWidth}px`;
  // Spec §7.2: a fixed row minimum only grows in the "maximize tracks" step, which a scroller with no
  // free space never reaches, so the floor lives on the cells as `--row-min` and the tracks size to content.
  const style = {
    gridTemplateColumns: `var(--rail-width) ${columns.map(() => track).join(" ")}`,
    gridTemplateRows: "auto",
    gridAutoRows: "minmax(min-content, auto)",
    "--row-min": `${density.rowMin}px`,
  } as CSSProperties;

  // Cards are numbered in DOM order, which is (column, row) order, for the entrance stagger.
  let order = 0;
  const renderCard = (p: SlotPlacement): ReactNode => {
    const s = sessionById.get(p.sessionId);
    if (!s) return null;
    const delay = animate ? enterDelay(order++) : undefined;
    return (
      <SessionCard
        key={s.id}
        session={s}
        variant="grid"
        compact={compact}
        showLocation={showLocation}
        style={delay === undefined ? undefined : { animationDelay: delay }}
      />
    );
  };

  return (
    <div ref={scroller} className={styles.scroller} style={style} data-scroll-container="slots">
      <div className={styles.corner} style={{ gridColumn: "1", gridRow: "1" }} aria-hidden="true" />
      {columns.map((column, i) => (
        <ColumnHeader key={column.key} column={column} className={styles.header} style={{ gridColumn: String(i + 2), gridRow: "1" }} />
      ))}
      {slots.map((slot) => (
        <div
          key={slot.index}
          className={styles.railCell}
          style={{ gridColumn: "1", gridRow: String(slot.index + 2) }}
          data-slot-row={slot.index}
        >
          <span className={styles.railStart}>{formatTime(slot.start)}</span>
          {slot.lastStart !== slot.start && <span className={styles.railRange}>{formatRange(slot.start, slot.lastStart)}</span>}
          {slot.index === nowRow && nowMinutes !== null && <NowChip label={formatTime(nowMinutes)} />}
        </div>
      ))}
      {items.map((item) => {
        if (item.kind === "span") {
          const p = item.placement;
          return (
            <div key={`span:${p.column}:${p.sessionId}`} className={styles.span} style={gridArea(p)} data-span={p.sessionId}>
              {renderCard(p)}
            </div>
          );
        }
        const { cell } = item;
        const anchor = cell.stubs[0] ?? cell.cards[0];
        if (!anchor) return null;
        const key = `${cell.column}:${cell.row}`;
        return (
          <div key={`cell:${key}`} className={styles.cell} style={gridArea(anchor)} data-cell={key}>
            {cell.stubs.map((p) => {
              const s = sessionById.get(p.sessionId);
              return s ? <ContinuationStub key={s.id} session={s} /> : null;
            })}
            {cell.overflow > 0 && <span className={styles.more}>{`+${cell.overflow} w trakcie`}</span>}
            {cell.cards.map(renderCard)}
          </div>
        );
      })}
      {nowRow >= 0 && <NowLine style={{ gridColumn: "1 / -1", gridRow: String(nowRow + 2) }} />}
    </div>
  );
}
