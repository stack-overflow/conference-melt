import { useEffect, useMemo } from "react";
import styles from "./App.module.css";
import { useData } from "./data/index";
import { usePlanSet, useStore } from "./state/store";
import { clock } from "./state/clock";
import { buildColumns, daySets, listGroups, resolveTimeMode } from "./state/derive";
import { useTier } from "./state/useMediaQuery";
import { Grain } from "./components/shell/Grain";
import { TopBar } from "./components/shell/TopBar";
import { DayTabs } from "./components/shell/DayTabs";
import { ShareBanner } from "./components/shell/ShareBanner";
import { FilterChips } from "./components/shell/FilterChips";
import { BottomBar } from "./components/shell/BottomBar";
import { Toasts } from "./components/shell/Toasts";
import { ScheduleGrid } from "./components/grid/ScheduleGrid";
import { ScheduleList } from "./components/list/ScheduleList";
import { PlanView } from "./components/plan/PlanView";
import { PrintPlan } from "./components/plan/PrintPlan";
import { DetailSheet } from "./components/detail/DetailSheet";
import { FiltersPanel } from "./components/filters/FiltersPanel";
import { Sheet } from "./components/ui/Sheet";
import { CopySheet } from "./components/ui/CopySheet";

/** The store's `now` advances this often; the shared clock honours a ?now= override. */
const CLOCK_INTERVAL_MS = 30_000;

export default function App() {
  const { data, index, search } = useData();
  const day = useStore((s) => s.day);
  const view = useStore((s) => s.view);
  const filters = useStore((s) => s.filters);
  const settings = useStore((s) => s.settings);
  const openSheet = useStore((s) => s.openSheet);
  const setSheet = useStore((s) => s.setSheet);
  const setNow = useStore((s) => s.setNow);
  const planSet = usePlanSet();
  const tier = useTier();

  // Clock: main.tsx sets the boot `now`; from then on this effect advances it every 30 s.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(clock.now()), CLOCK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [setNow]);

  const sets = useMemo(
    () => daySets({ data, index, search, dayId: day, filters, settings, planSet, planView: false }),
    [data, index, search, day, filters, settings, planSet],
  );
  const columns = useMemo(() => buildColumns(sets, settings.columnAxis, data, index), [sets, settings.columnAxis, data, index]);
  const resolved = useMemo(() => resolveTimeMode(settings, sets.layout), [settings, sets.layout]);
  const groups = useMemo(() => listGroups(sets, resolved, settings), [sets, resolved, settings]);

  const closeSheet = (): void => setSheet(null);

  return (
    <div className={styles.app} data-view={view} data-tier={tier}>
      <Grain />
      <TopBar />
      {tier === "mobile" && <DayTabs />}
      <ShareBanner />
      <FilterChips />
      <div className={styles.body}>
        {tier === "wide" && (
          <div className={styles.sidebar}>
            <FiltersPanel variant="sidebar" />
          </div>
        )}
        <main className={styles.main} id="main">
          <div key={`${view}:${day}:${resolved.mode}`} className={styles.fade}>
            {view === "grid" && <ScheduleGrid sets={sets} columns={columns} resolved={resolved} dayId={day} />}
            {view === "list" && <ScheduleList groups={groups} />}
            {view === "plan" && <PlanView />}
          </div>
        </main>
      </div>
      {tier !== "wide" && (
        <Sheet open={openSheet === "filters"} side={tier === "mobile" ? "bottom" : "left"} title="Filtry" onClose={closeSheet}>
          <FiltersPanel variant="sheet" />
        </Sheet>
      )}
      <DetailSheet />
      <CopySheet />
      <Toasts />
      {tier === "mobile" && <BottomBar />}
      <PrintPlan />
    </div>
  );
}
