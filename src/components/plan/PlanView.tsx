import { useMemo } from "react";
import { useData } from "../../data/index";
import { nextUp, planSessions, planSummary } from "../../domain/plan";
import { buildColumns, daySets, listGroups, resolveTimeMode } from "../../state/derive";
import { usePlanSet, useStore, type Settings } from "../../state/store";
import { FilteredEmpty, ScheduleGrid } from "../grid/ScheduleGrid";
import { ScheduleList } from "../list/ScheduleList";
import { EmptyState } from "../ui/EmptyState";
import { Segmented } from "../ui/Segmented";
import { ConflictsPanel } from "./ConflictsPanel";
import { PlanActions } from "./PlanActions";
import { PlanSummary } from "./PlanSummary";
import styles from "./PlanView.module.css";

type PlanLayout = Settings["planLayout"];

const LAYOUT_OPTIONS: { value: PlanLayout; label: string }[] = [
  { value: "grid", label: "Siatka" },
  { value: "list", label: "Lista" },
];

/** Spec §7.5: the grid or list restricted to the plan set, plus summary, conflicts and actions. */
export function PlanView() {
  const { data, index, search } = useData();
  const day = useStore((s) => s.day);
  const filters = useStore((s) => s.filters);
  const settings = useStore((s) => s.settings);
  const now = useStore((s) => s.now);
  const preview = useStore((s) => s.previewPlan !== null);
  const setSettings = useStore((s) => s.setSettings);
  const setView = useStore((s) => s.setView);
  const savePreview = useStore((s) => s.savePreview);
  const closePreview = useStore((s) => s.closePreview);
  const planSet = usePlanSet();

  const plan = useMemo(() => planSessions(planSet, data.sessions), [planSet, data]);
  const summary = useMemo(() => planSummary(plan, data.days), [plan, data]);
  const next = useMemo(() => nextUp(plan, data.days, now), [plan, data, now]);

  const sets = useMemo(
    () => daySets({ data, index, search, dayId: day, filters, settings, planSet, planView: true }),
    [data, index, search, day, filters, settings, planSet],
  );
  const columns = useMemo(() => buildColumns(sets, settings.columnAxis, data, index), [sets, settings.columnAxis, data, index]);
  const resolved = useMemo(() => resolveTimeMode(settings, sets.layout), [settings, sets.layout]);
  const groups = useMemo(() => listGroups(sets, resolved, settings), [sets, resolved, settings]);

  const layout = settings.planLayout;

  return (
    <div className={styles.view} data-preview={preview ? "true" : undefined}>
      {preview && (
        <div className={styles.previewBar} role="status">
          <span className={styles.previewText}>Podgląd udostępnionego planu · nie zapisano</span>
          <div className={styles.previewActions}>
            <button type="button" className={styles.primary} onClick={savePreview}>
              Zapisz jako mój plan
            </button>
            <button type="button" className={styles.secondary} onClick={closePreview}>
              Zamknij podgląd
            </button>
          </div>
        </div>
      )}

      {plan.length === 0 ? (
        <EmptyState
          title="Twój plan jest pusty"
          text="Oznacz gwiazdką wydarzenia w siatce lub na liście, a pojawią się tutaj."
          illustration
          actions={
            <button type="button" className={styles.primary} onClick={() => setView("grid")}>
              Przeglądaj harmonogram
            </button>
          }
        />
      ) : (
        <>
          <div className={styles.toolbar}>
            <PlanSummary summary={summary} next={next} now={now} />
            <Segmented
              value={layout}
              options={LAYOUT_OPTIONS}
              onChange={(v) => setSettings({ planLayout: v })}
              ariaLabel="Układ planu"
            />
          </div>
          <PlanActions plan={plan} preview={preview} />
          <ConflictsPanel conflicts={summary.conflicts} preview={preview} />
          <div key={`${day}:${layout}:${resolved.mode}`} className={styles.schedule}>
            {sets.visible.length === 0 ? (
              // Spec §9: the shared empty state with the active-filter chips and "Wyczyść filtry" (both only while a filter is active).
              <FilteredEmpty />
            ) : layout === "grid" ? (
              <ScheduleGrid sets={sets} columns={columns} resolved={resolved} dayId={day} />
            ) : (
              <ScheduleList groups={groups} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
