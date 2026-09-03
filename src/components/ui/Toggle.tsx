import { useId } from "react";
import styles from "./Toggle.module.css";

export interface ToggleProps {
  checked: boolean;
  onChange(v: boolean): void;
  label: string;
  hint?: string;
}

export function Toggle({ checked, onChange, label, hint }: ToggleProps) {
  const labelId = useId();
  const hintId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={hint ? hintId : undefined}
      className={styles.row}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.text}>
        <span id={labelId} className={styles.label}>
          {label}
        </span>
        {hint && (
          <span id={hintId} className={styles.hint}>
            {hint}
          </span>
        )}
      </span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </button>
  );
}
