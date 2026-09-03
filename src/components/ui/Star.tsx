import { useEffect, useState } from "react";
import { Star as StarIcon } from "lucide-react";
import styles from "./Star.module.css";
import { cx } from "./cx";

export interface StarProps {
  pressed: boolean;
  onToggle(): void;
  size?: number;
}

const POP_MS = 250;

export function Star({ pressed, onToggle, size = 18 }: StarProps) {
  const [popping, setPopping] = useState(false);

  useEffect(() => {
    if (!popping) return;
    const timer = window.setTimeout(() => setPopping(false), POP_MS);
    return () => window.clearTimeout(timer);
  }, [popping]);

  return (
    <button
      type="button"
      className={cx(styles.star, popping && styles.pop)}
      aria-pressed={pressed}
      aria-label="Do planu"
      onClick={() => {
        setPopping(true);
        onToggle();
      }}
    >
      <StarIcon size={size} fill={pressed ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}
