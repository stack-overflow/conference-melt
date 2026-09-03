import type { ScheduleData, Session } from "../../src/data/types";

export interface SlotSetDef {
  id: string;
  day: string;
  typeIds?: number[];
  locationIds?: number[];
}

/** The eight calibration sets of spec §5.2, keyed by WordPress term ids. */
export const SLOT_SETS: SlotSetDef[] = [
  { id: "sat-lectures", day: "sob", typeIds: [184, 278] },
  { id: "sat-prelekcja-only", day: "sob", typeIds: [184] },
  { id: "fri-lectures", day: "pt", typeIds: [184, 278] },
  { id: "fri-prelekcja-only", day: "pt", typeIds: [184] },
  { id: "fri-lecture-rooms", day: "pt", locationIds: [282, 279, 233, 281, 280] },
  { id: "fri-all", day: "pt" },
  { id: "sat-all", day: "sob" },
  { id: "fri-equipment", day: "pt", typeIds: [214, 215] },
];

function matchesAny(ids: number[], wanted: number[] | undefined): boolean {
  return wanted === undefined || ids.some((id) => wanted.includes(id));
}

/** Sessions of the set: on the day, not allDay, with a start, in `data.sessions` order. */
export function slotSetMembers(def: SlotSetDef, data: ScheduleData): Session[] {
  return data.sessions.filter(
    (session) =>
      session.day === def.day &&
      !session.allDay &&
      session.start !== null &&
      matchesAny(session.typeIds, def.typeIds) &&
      matchesAny(session.locationIds, def.locationIds),
  );
}
