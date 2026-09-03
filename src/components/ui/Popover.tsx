import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./Popover.module.css";
import { useDialogFocus } from "./focus";

export interface PopoverProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose(): void;
  children: ReactNode;
  title: string;
}

interface Position {
  top: number;
  right: number;
}

const GAP = 8;
const EDGE = 8;

export function Popover({ open, anchorRef, onClose, children, title }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [position, setPosition] = useState<Position | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useDialogFocus(open, panelRef, onClose, false);

  useLayoutEffect(() => {
    if (!open) return;
    const place = (): void => {
      const anchor = anchorRef.current;
      if (!anchor) {
        setPosition({ top: 64, right: EDGE });
        return;
      }
      const rect = anchor.getBoundingClientRect();
      setPosition({ top: rect.bottom + GAP, right: Math.max(EDGE, window.innerWidth - rect.right) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent): void => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onCloseRef.current();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, anchorRef]);

  const onBlur = (e: FocusEvent<HTMLDivElement>): void => {
    const next = e.relatedTarget;
    if (!(next instanceof Node)) return;
    if (panelRef.current?.contains(next) || anchorRef.current?.contains(next)) return;
    onCloseRef.current();
  };

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      style={position ? { top: position.top, right: position.right } : undefined}
      onBlur={onBlur}
    >
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <button type="button" className={styles.close} aria-label="Zamknij" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className={styles.content}>{children}</div>
    </div>,
    document.body,
  );
}
