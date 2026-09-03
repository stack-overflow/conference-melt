import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";
import { Burst } from "./Burst";

export interface EmptyStateProps {
  title: string;
  text?: string;
  actions?: ReactNode;
  illustration?: boolean;
}

export function EmptyState({ title, text, actions, illustration = false }: EmptyStateProps) {
  return (
    <div className={styles.empty} role="status">
      {illustration && <Burst size={96} className={styles.burst} />}
      <h2 className={styles.title}>{title}</h2>
      {text && <p className={styles.text}>{text}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
