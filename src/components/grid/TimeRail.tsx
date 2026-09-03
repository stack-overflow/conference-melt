import type { CSSProperties } from "react";
import styles from "./TimeRail.module.css";
import { formatTime } from "../../domain/time";
import { cx } from "../ui/cx";
import { NowChip } from "./NowLine";
import type { TimelineRange } from "./gridLayout";

export interface TimeRailProps {
  range: TimelineRange;
  zoom: number;
  now: { top: number; label: string } | null;
  className?: string;
  style?: CSSProperties;
}

const HALF_HOUR = 30;
const HOUR = 60;

/** Spec §7.2: hour labels and half-hour ticks over the timeline range; decorative (spec §7.9). */
export function TimeRail({ range, zoom, now, className, style }: TimeRailProps) {
  const marks: number[] = [];
  for (let m = Math.ceil(range.start / HALF_HOUR) * HALF_HOUR; m <= range.end; m += HALF_HOUR) marks.push(m);

  return (
    <div
      className={cx(styles.rail, className)}
      style={{ ...style, height: `${(range.end - range.start) * zoom}px` }}
      data-time-rail=""
      aria-hidden="true"
    >
      {marks.map((minute) =>
        minute % HOUR === 0 ? (
          <span key={minute} className={styles.hour} style={{ top: `${(minute - range.start) * zoom}px` }}>
            {formatTime(minute)}
          </span>
        ) : (
          <span key={minute} className={styles.tick} style={{ top: `${(minute - range.start) * zoom}px` }} />
        ),
      )}
      {now && <NowChip label={now.label} top={now.top} />}
    </div>
  );
}
