import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./Sheet.module.css";
import { useDialogFocus } from "./focus";

export interface SheetProps {
  open: boolean;
  side: "left" | "right" | "bottom";
  title: string;
  onClose(): void;
  children: ReactNode;
  labelledBy?: string;
}

export function Sheet({ open, side, title, onClose, children, labelledBy }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFocus(open, panelRef, onClose, true);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className={styles.root} data-side={side}>
      <div className={styles.backdrop} data-sheet-backdrop="" onClick={onClose} />
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? titleId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} aria-label="Zamknij" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
