import { Share2, X } from "lucide-react";
import styles from "./ShareBanner.module.css";
import { useStore } from "../../state/store";
import { events } from "../../domain/plural";

export function ShareBanner() {
  const shared = useStore((s) => s.sharedPlan);
  const load = useStore((s) => s.loadSharedPlan);
  const preview = useStore((s) => s.previewSharedPlan);
  const dismiss = useStore((s) => s.dismissSharedPlan);

  if (!shared) return null;
  const count = shared.ids.length;

  return (
    <section className={styles.banner} aria-label="Udostępniony plan">
      <Share2 size={18} aria-hidden="true" className={styles.icon} />
      <p className={styles.text}>
        {count === 0 ? (
          <span>Ten link wskazuje na wersję harmonogramu, która już nie pasuje do tej. Nie udało się wczytać żadnego wydarzenia.</span>
        ) : (
          <>
            <strong>{`Ktoś udostępnił Ci plan: ${events(count)}`}</strong>
            {shared.unknown > 0 && (
              <span className={styles.muted}>{` · ${shared.unknown} nie pasuje do tej wersji harmonogramu`}</span>
            )}
          </>
        )}
      </p>
      {count > 0 && (
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={load}>
            Wczytaj
          </button>
          <button type="button" className={styles.secondary} onClick={preview}>
            Tylko podgląd
          </button>
        </div>
      )}
      <button type="button" className={styles.close} aria-label="Zamknij" onClick={dismiss}>
        <X size={18} aria-hidden="true" />
      </button>
    </section>
  );
}
