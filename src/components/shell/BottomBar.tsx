import { LayoutGrid, List, SlidersHorizontal, Star as StarIcon, type LucideIcon } from "lucide-react";
import styles from "./BottomBar.module.css";
import { useStore, type View } from "../../state/store";
import { activeFilterCount } from "../../domain/filters";
import { VIEW_OPTIONS } from "./ViewSwitcher";

const ICONS: Record<View, LucideIcon> = { grid: LayoutGrid, list: List, plan: StarIcon };

export function BottomBar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const count = useStore((s) => s.favourites.length);
  const filters = useStore((s) => s.filters);
  const openSheet = useStore((s) => s.openSheet);
  const setSheet = useStore((s) => s.setSheet);
  const active = activeFilterCount(filters);

  return (
    <nav className={styles.bar} aria-label="Nawigacja">
      {VIEW_OPTIONS.map((option) => {
        const Icon = ICONS[option.value];
        return (
          <button
            key={option.value}
            type="button"
            className={styles.item}
            aria-current={view === option.value ? "page" : undefined}
            onClick={() => setView(option.value)}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{option.label}</span>
            {option.value === "plan" && count > 0 && <span className={styles.badge}>{count}</span>}
          </button>
        );
      })}
      <button
        type="button"
        className={styles.item}
        aria-expanded={openSheet === "filters"}
        onClick={() => setSheet("filters")}
      >
        <SlidersHorizontal size={20} aria-hidden="true" />
        <span>Filtry</span>
        {active > 0 && <span className={styles.badge}>{active}</span>}
      </button>
    </nav>
  );
}
