import type { ScheduleData } from "../data/types";
import type { DataIndex } from "../domain/lookup";
import { defaultDay } from "../domain/now";
import { decodePlan } from "../domain/share";
import { parseHash } from "./hash";
import { defaultView, type SharedPlan, type View } from "./store";

export interface BootResult {
  day: string;
  view: View;
  sharedPlan: SharedPlan | null;
  favourites: string[];
  droppedFavourites: number;
}

const VIEWS: readonly View[] = ["grid", "list", "plan"];

function isView(value: string | null | undefined): value is View {
  return value !== null && value !== undefined && (VIEWS as readonly string[]).includes(value);
}

/**
 * Spec §6 boot precedence. `view`: valid hash `v`, else the persisted view, else the viewport default.
 * `day`: valid hash `d`, else `defaultDay`. A `plan` parameter is decoded into `sharedPlan`.
 * `favourites` is `persistedFavourites` without the ids this snapshot does not know, in stored order;
 * `droppedFavourites` counts the removed ones so the caller can report them.
 * Pure: writes neither the hash nor the store.
 */
export function resolveBoot(args: {
  hash: string;
  persistedView: View | null;
  persistedFavourites: string[];
  viewportWidth: number;
  data: ScheduleData;
  index: DataIndex;
  now: Date;
}): BootResult {
  const { hash, persistedView, persistedFavourites, viewportWidth, data, index, now } = args;
  const h = parseHash(hash);

  const view: View = isView(h.v) ? h.v : isView(persistedView) ? persistedView : defaultView(viewportWidth);

  const sessionsPerDay = new Map<string, number>();
  for (const day of data.days) sessionsPerDay.set(day.id, index.sessionsByDay.get(day.id)?.length ?? 0);
  const day = h.d !== undefined && index.dayById.has(h.d) ? h.d : defaultDay(data.days, now, sessionsPerDay).id;

  const sharedPlan = h.plan !== undefined ? decodePlan(h.plan, index.sessionIds) : null;

  const favourites = persistedFavourites.filter((id) => index.sessionIds.has(id));
  const droppedFavourites = persistedFavourites.length - favourites.length;

  return { day, view, sharedPlan, favourites, droppedFavourites };
}
