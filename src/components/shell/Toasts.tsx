import { useEffect } from "react";
import { X } from "lucide-react";
import styles from "./Toasts.module.css";
import { useStore } from "../../state/store";

const PLAIN_MS = 3000;
const WITH_ACTION_MS = 6000;

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismissToast = useStore((s) => s.dismissToast);
  const current = toasts[0];
  const currentId = current?.id;
  const hasAction = current?.action !== undefined;

  useEffect(() => {
    if (currentId === undefined) return;
    const timer = window.setTimeout(() => dismissToast(currentId), hasAction ? WITH_ACTION_MS : PLAIN_MS);
    return () => window.clearTimeout(timer);
  }, [currentId, hasAction, dismissToast]);

  return (
    <div className={styles.region} role="status" aria-live="polite">
      {current && (
        <div className={styles.toast} key={current.id}>
          <span className={styles.text}>{current.text}</span>
          {current.action && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                current.action?.run();
                dismissToast(current.id);
              }}
            >
              {current.action.label}
            </button>
          )}
          <button type="button" className={styles.close} aria-label="Zamknij powiadomienie" onClick={() => dismissToast(current.id)}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
