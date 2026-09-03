import type { Level, Location, ScheduleData, Session, Term, TimedSession } from "../data/types";
import { hasStart } from "../data/types";
import { applyFilters, type Filters, type SearchIndex } from "../domain/filters";
import { locationsOf, primaryType, typeRank, type DataIndex } from "../domain/lookup";
import { maxConcurrency } from "../domain/overlaps";
import { detectSlots, slotIndexOf, slotRegularity, type Regularity, type Slot } from "../domain/slots";
import { formatRange, formatTime } from "../domain/time";
import type { ColumnAxis, Settings } from "./store";

const collator = new Intl.Collator("pl");

export interface DaySets {
  /** The day's sessions (plan-restricted in the plan view). */
  all: Session[];
  /** Spec §7.2 layout set: facets + all-day rule, query and favourites ignored, no-start and strip all-day removed. */
  layout: TimedSession[];
  /** Spec §7.2 visible set: every filter applied. */
  visible: Session[];
  /** layout ∩ visible. */
  rendered: TimedSession[];
  renderedIds: Set<string>;
  /** Visible all-day sessions, only while the strip is on. */
  stripAllDay: Session[];
  /** Visible sessions without a start. */
  stripNoTime: Session[];
}

export function daySets(args: {
  data: ScheduleData;
  index: DataIndex;
  search: SearchIndex;
  dayId: string;
  filters: Filters;
  settings: Settings;
  planSet: ReadonlySet<string>;
  planView: boolean;
}): DaySets {
  const { index, search, dayId, filters, settings, planSet, planView } = args;
  const daySessions = index.sessionsByDay.get(dayId) ?? [];
  const all = planView ? daySessions.filter((s) => planSet.has(s.id)) : daySessions;

  const layoutBase = applyFilters(all, filters, planSet, search, { ignoreQuery: true, ignoreFavourites: true });
  const layout = layoutBase.filter(hasStart).filter((s) => !(settings.allDayStrip && s.allDay));

  const visible = applyFilters(all, filters, planSet, search);
  const visibleIds = new Set(visible.map((s) => s.id));
  const rendered = layout.filter((s) => visibleIds.has(s.id));
  const renderedIds = new Set(rendered.map((s) => s.id));

  const stripAllDay = settings.allDayStrip ? visible.filter((s) => s.allDay) : [];
  const stripNoTime = visible.filter((s) => s.start === null);

  return { all, layout, visible, rendered, renderedIds, stripAllDay, stripNoTime };
}

export interface Column {
  key: string;
  label: string;
  sublabel: string | null;
  /** Layout-set members of this column, in layout order. */
  sessions: TimedSession[];
  renderedIds: Set<string>;
  count: number;
}

interface ColumnDef {
  key: string;
  label: string;
  sublabel: string | null;
}

const LEVEL_SEQUENCE: Level[] = ["0", "I", "I+II", "II", "III", null];

function levelKey(level: Level): string {
  return level === null ? "level:none" : `level:${level}`;
}

function levelLabel(level: Level): string {
  switch (level) {
    case "0":
      return "Poziom 0";
    case "I":
      return "Poziom I";
    case "I+II":
      return "Poziom I i II";
    case "II":
      return "Poziom II";
    case "III":
      return "Poziom III";
    case null:
      return "Inne";
  }
}

function locationDef(l: Location): ColumnDef {
  return { key: `loc:${l.id}`, label: l.short, sublabel: l.venue === l.short ? null : l.venue };
}

function compareTypes(a: Term, b: Term): number {
  return typeRank(a.name) - typeRank(b.name) || collator.compare(a.name, b.name) || a.id - b.id;
}

/** Column definitions in display order plus the column keys each layout session belongs to. */
function columnPlan(
  layout: TimedSession[],
  axis: ColumnAxis,
  data: ScheduleData,
  index: DataIndex,
): { defs: ColumnDef[]; keysOf: (s: TimedSession) => string[] } {
  switch (axis) {
    case "location": {
      const defs = [...data.locations].sort((a, b) => a.order - b.order).map(locationDef);
      return {
        defs,
        keysOf: (s) => s.locationIds.filter((id) => index.locationById.has(id)).map((id) => `loc:${id}`),
      };
    }
    case "type": {
      const present = new Map<number, Term>();
      let untyped = false;
      for (const s of layout) {
        const t = primaryType(s, index);
        if (t) present.set(t.id, t);
        else untyped = true;
      }
      const defs: ColumnDef[] = [...present.values()]
        .sort(compareTypes)
        .map((t) => ({ key: `type:${t.id}`, label: t.name, sublabel: null }));
      if (untyped) defs.push({ key: "type:none", label: "Bez typu", sublabel: null });
      return {
        defs,
        keysOf: (s) => {
          const t = primaryType(s, index);
          return [t ? `type:${t.id}` : "type:none"];
        },
      };
    }
    case "brand": {
      const defs: ColumnDef[] = data.brands.map((b) => ({ key: `brand:${b.id}`, label: b.name, sublabel: null }));
      defs.push({ key: "brand:none", label: "Bez marki", sublabel: null });
      return {
        defs,
        keysOf: (s) => {
          const first = s.brandIds[0];
          return [first !== undefined && index.brandById.has(first) ? `brand:${first}` : "brand:none"];
        },
      };
    }
    case "level": {
      const defs = LEVEL_SEQUENCE.map((level) => ({ key: levelKey(level), label: levelLabel(level), sublabel: null }));
      return {
        defs,
        keysOf: (s) => {
          const locations = locationsOf(s, index);
          if (locations.length === 0) return [levelKey(null)];
          return [...new Set(locations.map((l) => levelKey(l.level)))];
        },
      };
    }
    case "none":
      return { defs: [{ key: "all", label: "Wszystkie", sublabel: null }], keysOf: () => ["all"] };
  }
}

/** Spec §7.2 columns: a column exists only when it holds at least one rendered-set session. */
export function buildColumns(sets: DaySets, axis: ColumnAxis, data: ScheduleData, index: DataIndex): Column[] {
  const { defs, keysOf } = columnPlan(sets.layout, axis, data, index);
  const members = new Map<string, TimedSession[]>();
  for (const s of sets.layout) {
    for (const key of keysOf(s)) {
      const list = members.get(key);
      if (list) list.push(s);
      else members.set(key, [s]);
    }
  }
  const columns: Column[] = [];
  for (const def of defs) {
    const sessions = members.get(def.key) ?? [];
    const renderedIds = new Set(sessions.filter((s) => sets.renderedIds.has(s.id)).map((s) => s.id));
    if (renderedIds.size === 0) continue;
    columns.push({ key: def.key, label: def.label, sublabel: def.sublabel, sessions, renderedIds, count: renderedIds.size });
  }
  return columns;
}

export interface ResolvedTime {
  mode: "slots" | "timeline";
  slots: Slot[];
  regularity: Regularity;
  auto: boolean;
}

/** Spec §7.2 time modes: `auto` picks slots when the layout set is distinguishable; forced modes win. */
export function resolveTimeMode(settings: Settings, layout: TimedSession[]): ResolvedTime {
  const tolerance = settings.slotTolerance;
  const slots = detectSlots(layout, { tolerance });
  const regularity = slotRegularity(slots, layout, tolerance);
  const mode = settings.timeMode === "auto" ? (regularity.distinguishable ? "slots" : "timeline") : settings.timeMode;
  return { mode, slots, regularity, auto: settings.timeMode === "auto" };
}

export interface ListGroup {
  key: string;
  label: string;
  sessions: Session[];
  total: number;
  /** maxConcurrency of the timed members; 0 when none has a start. */
  parallel: number;
}

function byStartThenTitle(a: Session, b: Session): number {
  return (a.start ?? 0) - (b.start ?? 0) || collator.compare(a.title, b.title);
}

function makeGroup(key: string, label: string, sessions: Session[]): ListGroup {
  const timed = sessions.filter(hasStart);
  return { key, label, sessions, total: sessions.length, parallel: timed.length === 0 ? 0 : maxConcurrency(timed) };
}

function pushTo<K>(map: Map<K, Session[]>, key: K, s: Session): void {
  const list = map.get(key);
  if (list) list.push(s);
  else map.set(key, [s]);
}

/** Spec §7.4: groups follow the resolved mode, "Całodniowe" leads while the strip is on, "Bez godziny" closes. */
export function listGroups(sets: DaySets, resolved: ResolvedTime, settings: Settings): ListGroup[] {
  const groups: ListGroup[] = [];
  if (settings.allDayStrip && sets.stripAllDay.length > 0) {
    groups.push(makeGroup("allday", "Całodniowe", [...sets.stripAllDay].sort(byStartThenTitle)));
  }

  const rows = [...sets.rendered].sort(byStartThenTitle);
  if (resolved.mode === "slots") {
    const bySlot = new Map<number, Session[]>();
    for (const s of rows) {
      const slotIndex = slotIndexOf(s, resolved.slots);
      if (slotIndex >= 0) pushTo(bySlot, slotIndex, s);
    }
    for (const slot of resolved.slots) {
      const members = bySlot.get(slot.index);
      if (!members) continue;
      const label = slot.lastStart !== slot.start ? formatRange(slot.start, slot.lastStart) : formatTime(slot.start);
      groups.push(makeGroup(`slot:${slot.index}`, label, members));
    }
  } else {
    const byHour = new Map<number, Session[]>();
    for (const s of rows) pushTo(byHour, Math.floor(s.start / 60), s);
    for (const hour of [...byHour.keys()].sort((a, b) => a - b)) {
      groups.push(makeGroup(`hour:${hour}`, formatRange(hour * 60, hour * 60 + 60), byHour.get(hour) ?? []));
    }
  }

  if (sets.stripNoTime.length > 0) groups.push(makeGroup("notime", "Bez godziny", sets.stripNoTime));
  return groups;
}
