import { useId } from "react";
import styles from "./Slider.module.css";

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(v: number): void;
  label: string;
  format?(v: number): string;
}

export function Slider({ value, min, max, step, onChange, label, format }: SliderProps) {
  const id = useId();
  const shown = format ? format(value) : String(value);
  return (
    <div className={styles.field}>
      <div className={styles.row}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <output htmlFor={id} className={styles.value}>
          {shown}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className={styles.input}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={shown}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
    </div>
  );
}
