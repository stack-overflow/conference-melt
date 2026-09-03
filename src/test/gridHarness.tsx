import type { MockInstance } from "vitest";
import { render } from "@testing-library/react";
import type { ScheduleData } from "../data/types";
import { DataProvider, buildAppData, useData } from "../data/index";
import { buildColumns, daySets, resolveTimeMode } from "../state/derive";
import { usePlanSet, useStore } from "../state/store";
import { ScheduleGrid } from "../components/grid/ScheduleGrid";

/** Reads the store the way App does, so tests drive the grid through useStore.setState. */
export function GridHarness() {
  const { data, index, search } = useData();
  const dayId = useStore((s) => s.day);
  const filters = useStore((s) => s.filters);
  const settings = useStore((s) => s.settings);
  const planSet = usePlanSet();
  const sets = daySets({ data, index, search, dayId, filters, settings, planSet, planView: false });
  const columns = buildColumns(sets, settings.columnAxis, data, index);
  const resolved = resolveTimeMode(settings, sets.layout);
  return <ScheduleGrid sets={sets} columns={columns} resolved={resolved} dayId={dayId} />;
}

export function renderGrid(data: ScheduleData) {
  return render(
    <DataProvider value={buildAppData(data)}>
      <GridHarness />
    </DataProvider>,
  );
}

/**
 * Spec §10: no DOM-nesting warning may be logged. React 18 words it
 * "validateDOMNesting(...): <x> cannot appear as a descendant of <y>", React 19
 * "In HTML, <x> cannot be a descendant of <y>"; both are matched.
 */
export function nestingWarnings(spy: MockInstance): string[] {
  return spy.mock.calls
    .map((call) => call.map(String).join(" "))
    .filter((message) => /validateDOMNesting|cannot (be|appear as) a (child|descendant) of/.test(message));
}
