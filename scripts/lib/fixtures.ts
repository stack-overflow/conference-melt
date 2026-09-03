import type { ScheduleData } from "../../src/data/types";
import { SLOT_SETS, slotSetMembers } from "./slot-sets";

const FRI_LECTURES_ID = "fri-lectures";

export function buildSlotSetsFixture(
  data: ScheduleData,
): Record<string, { id: string; start: number; end: number | null }[]> {
  const fixture: Record<string, { id: string; start: number; end: number | null }[]> = {};
  for (const def of SLOT_SETS) {
    fixture[def.id] = slotSetMembers(def, data).flatMap((session) =>
      session.start === null ? [] : [{ id: session.id, start: session.start, end: session.end }],
    );
  }
  return fixture;
}

export function buildFriLecturesFixture(data: ScheduleData): ScheduleData {
  const def = SLOT_SETS.find((candidate) => candidate.id === FRI_LECTURES_ID);
  if (def === undefined) throw new Error(`slot set ${FRI_LECTURES_ID} is not defined`);
  const sessions = slotSetMembers(def, data);
  const dayIds = new Set(sessions.map((session) => session.day));
  const typeIds = new Set(sessions.flatMap((session) => session.typeIds));
  const locationIds = new Set(sessions.flatMap((session) => session.locationIds));
  return {
    meta: {
      ...data.meta,
      eventCount: new Set(sessions.map((session) => session.eventId)).size,
      sessionCount: sessions.length,
      speakerCount: 0,
    },
    days: data.days.filter((day) => dayIds.has(day.id)),
    locations: data.locations.filter((location) => locationIds.has(location.id)),
    types: data.types.filter((type) => typeIds.has(type.id)),
    themes: [],
    brands: [],
    signupStatuses: [],
    speakers: [],
    sessions,
  };
}
