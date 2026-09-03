import type { CSSProperties } from "react";
import styles from "./NowLine.module.css";
import { cx } from "../ui/cx";

export interface NowLineProps {
  style?: CSSProperties;
}

/** The line itself: decorative (spec §7.9); `id` and `data-now-line` are what LiveChip scrolls to. */
export function NowLine({ style }: NowLineProps) {
  return <div id="now-line" data-now-line="" className={styles.line} style={style} aria-hidden="true" />;
}

export interface NowChipProps {
  label: string;
  /** Pixel offset inside a timeline rail; omit inside a slot rail cell (chip sits at the cell's top). */
  top?: number;
}

/** The time chip, rendered inside the sticky rail so it survives horizontal scroll. */
export function NowChip({ label, top }: NowChipProps) {
  return (
    <span
      className={cx(styles.chip, top !== undefined && styles.centered)}
      style={top === undefined ? undefined : { top: `${top}px` }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}
