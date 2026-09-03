import type { ScheduleData } from "../../src/data/types";
import type { RawData } from "./api";
import { parseDay } from "./parse";

const MIN_DAYS = 3;
const MIN_EVENTS = 50;
const LONG_SESSION_MINUTES = 300;

export function validate(data: ScheduleData, raw: RawData): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.days.length < MIN_DAYS) errors.push(`Too few days: ${data.days.length} (minimum ${MIN_DAYS})`);
  if (raw.events.length < MIN_EVENTS) errors.push(`Too few events: ${raw.events.length} (minimum ${MIN_EVENTS})`);

  for (const term of raw.terms["cyfrowe-event-day"]) {
    if (term.count > 0 && parseDay(term.name, data.meta.year) === null) {
      errors.push(`Day term ${term.id} "${term.name}" has no parseable date`);
    }
  }

  const dayTermIds = new Set(raw.terms["cyfrowe-event-day"].map((term) => term.id));
  for (const event of raw.events) {
    for (const id of event["cyfrowe-event-day"]) {
      if (!dayTermIds.has(id)) errors.push(`Event ${event.id} references unknown day term ${id}`);
    }
  }

  const dayIds = new Set(data.days.map((day) => day.id));
  const typeIds = new Set(raw.terms["cyfrowe-event-type"].map((term) => term.id));
  const locationIds = new Set(raw.terms["cyfrowe-event-location"].map((term) => term.id));
  for (const session of data.sessions) {
    if (!dayIds.has(session.day)) errors.push(`Session ${session.id} references unknown day "${session.day}"`);
    for (const id of session.typeIds) {
      if (!typeIds.has(id)) errors.push(`Session ${session.id} references unknown type ${id}`);
    }
    for (const id of session.locationIds) {
      if (!locationIds.has(id)) errors.push(`Session ${session.id} references unknown location ${id}`);
    }
    if (session.start === null) {
      warnings.push(`Session ${session.id} "${session.title}" has no parseable time`);
    } else if (session.end !== null && session.end - session.start >= LONG_SESSION_MINUTES && !session.allDay) {
      warnings.push(
        `Session ${session.id} "${session.title}" runs ${session.end - session.start} minutes but is not allDay`,
      );
    }
  }

  for (const speaker of data.speakers) {
    if (speaker.photo === null) warnings.push(`Speaker ${speaker.id} ${speaker.name} has no photo`);
  }

  return { errors, warnings };
}
