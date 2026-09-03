import { isValidElement, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./Chip.module.css";
import { cx } from "./cx";

export interface ChipProps {
  children: ReactNode;
  onRemove?(): void;
  tone?: "default" | "accent";
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

export function Chip({ children, onRemove, tone = "default" }: ChipProps) {
  const label = textOf(children);
  return (
    <span className={cx(styles.chip, tone === "accent" && styles.accent, onRemove !== undefined && styles.hasRemove)}>
      <span className={styles.text}>{children}</span>
      {onRemove && (
        <button type="button" className={styles.remove} aria-label={`Usuń filtr: ${label}`} onClick={onRemove}>
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
