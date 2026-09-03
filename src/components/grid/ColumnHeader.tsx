import type { CSSProperties } from "react";
import styles from "./ColumnHeader.module.css";
import type { Column } from "../../state/derive";
import { cx } from "../ui/cx";

export interface ColumnHeaderProps {
  column: Column;
  className?: string;
  style?: CSSProperties;
}

/** Spec §7.2: label, rendered-set count and, for locations, the venue as a second line. */
export function ColumnHeader({ column, className, style }: ColumnHeaderProps) {
  return (
    <div className={cx(styles.header, className)} style={style} data-column-header={column.key}>
      <span className={styles.row}>
        <span className={styles.label}>{column.label}</span>
        <span className={styles.count}>{column.count}</span>
      </span>
      {column.sublabel !== null && <span className={styles.sub}>{column.sublabel}</span>}
    </div>
  );
}
