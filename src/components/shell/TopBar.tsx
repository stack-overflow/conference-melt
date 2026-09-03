import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Search as SearchIcon, Settings2, SlidersHorizontal, Sun, X } from "lucide-react";
import styles from "./TopBar.module.css";
import { useStore, type Settings } from "../../state/store";
import { useTier } from "../../state/useMediaQuery";
import { activeFilterCount } from "../../domain/filters";
import { Burst } from "../ui/Burst";
import { cx } from "../ui/cx";
import { SettingsPanel } from "../settings/SettingsPanel";
import { DayTabs } from "./DayTabs";
import { ViewSwitcher } from "./ViewSwitcher";
import { LiveChip } from "./LiveChip";

type Theme = Settings["theme"];

const THEME_ORDER: Theme[] = ["system", "dark", "light"];
const THEME_LABEL: Record<Theme, string> = { system: "Systemowy", dark: "Ciemny", light: "Jasny" };

function nextTheme(theme: Theme): Theme {
  const i = THEME_ORDER.indexOf(theme);
  return THEME_ORDER[(i + 1) % THEME_ORDER.length] ?? "system";
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "dark") return <Moon size={18} aria-hidden="true" />;
  if (theme === "light") return <Sun size={18} aria-hidden="true" />;
  return <Monitor size={18} aria-hidden="true" />;
}

export function TopBar() {
  const tier = useTier();
  const mobile = tier === "mobile";
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const theme = useStore((s) => s.settings.theme);
  const setSettings = useStore((s) => s.setSettings);
  const openSheet = useStore((s) => s.openSheet);
  const setSheet = useStore((s) => s.setSheet);
  const [searchOpen, setSearchOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const activeCount = activeFilterCount(filters);
  const searchExpanded = mobile && searchOpen;
  const showInput = !mobile || searchOpen;

  useEffect(() => {
    if (searchExpanded) searchInput.current?.focus();
  }, [searchExpanded]);

  return (
    <header className={styles.bar} data-search-open={searchExpanded ? "true" : undefined}>
      <div className={styles.mark}>
        <Burst size={28} />
        <span className={styles.wordmark}>ŚwiatłoSiła 2026</span>
      </div>
      {!mobile && <DayTabs />}
      {!mobile && <ViewSwitcher />}
      <div className={styles.spacer} />
      {showInput && (
        <div className={styles.search} role="search">
          <SearchIcon size={16} aria-hidden="true" />
          <input
            ref={searchInput}
            type="search"
            className={styles.input}
            placeholder="Szukaj…"
            aria-label="Szukaj w harmonogramie"
            value={filters.query}
            onChange={(e) => setFilters({ query: e.currentTarget.value })}
          />
          {searchExpanded && (
            <button type="button" className={styles.inputClose} aria-label="Zamknij wyszukiwanie" onClick={() => setSearchOpen(false)}>
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      {mobile && !searchOpen && (
        <button type="button" className={cx(styles.button, styles.icon)} aria-label="Szukaj" onClick={() => setSearchOpen(true)}>
          <SearchIcon size={18} aria-hidden="true" />
        </button>
      )}
      {tier === "medium" && (
        <button type="button" className={styles.button} aria-expanded={openSheet === "filters"} onClick={() => setSheet("filters")}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filtry
          {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
        </button>
      )}
      <button
        ref={settingsButton}
        type="button"
        className={cx(styles.button, styles.widok)}
        aria-haspopup="dialog"
        aria-expanded={openSheet === "settings"}
        onClick={() => setSheet(openSheet === "settings" ? null : "settings")}
      >
        <Settings2 size={16} aria-hidden="true" />
        Widok
      </button>
      {!mobile && (
        <button
          type="button"
          className={cx(styles.button, styles.icon)}
          aria-label={`Motyw: ${THEME_LABEL[theme]}`}
          title={`Motyw: ${THEME_LABEL[theme]}`}
          onClick={() => setSettings({ theme: nextTheme(theme) })}
        >
          <ThemeIcon theme={theme} />
        </button>
      )}
      <div className={styles.live}>
        <LiveChip />
      </div>
      <SettingsPanel
        variant={mobile ? "sheet" : "popover"}
        anchorRef={settingsButton}
        open={openSheet === "settings"}
        onClose={() => setSheet(null)}
      />
    </header>
  );
}
