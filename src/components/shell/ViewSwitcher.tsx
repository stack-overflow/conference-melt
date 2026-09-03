import styles from "./ViewSwitcher.module.css";
import { useStore, type View } from "../../state/store";

/** Internal, used only by ViewSwitcher and BottomBar. */
export const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "grid", label: "Siatka" },
  { value: "list", label: "Lista" },
  { value: "plan", label: "Mój plan" },
];

export function ViewSwitcher() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const count = useStore((s) => s.favourites.length);

  return (
    <nav className={styles.switcher} aria-label="Widok">
      {VIEW_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.item}
          aria-current={view === option.value ? "page" : undefined}
          onClick={() => setView(option.value)}
        >
          {option.label}
          {option.value === "plan" && count > 0 && <span className={styles.badge}>{count}</span>}
        </button>
      ))}
    </nav>
  );
}
