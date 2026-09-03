# ŚwiatłoSiła 2026 Schedule Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static data snapshot of the ŚwiatłoSiła 2026 festival schedule and a single-file, browser-renderable React app that shows it as a configurable grid, list and personal plan with simultaneous-event tracking and automatic time-slot detection.

**Architecture:** A `tsx` fetch script pulls the WordPress REST API and writes `src/data/schedule.json`. Pure domain modules (time, slots, overlaps, filters, plan, share, ics, text, now) are unit-tested and framework-free. A Zustand store holds UI state and persists favourites and settings; pure "derive" functions turn state plus data into the layout, visible and rendered session sets that one grid engine renders in timeline or slot mode. React components are thin and read from the store.

**Tech Stack:** Vite 6, React 19, TypeScript 5, Zustand 5, lucide-react, Vitest 3 with jsdom and Testing Library, vite-plugin-singlefile, tsx. Node 20+.

**Spec:** `docs/superpowers/specs/2026-09-03-schedule-viewer-design.md` (referred to below as "the spec"; section numbers such as §7.2 point into it).

## Global Constraints

- Node 20 or newer; native `fetch` in the script; no runtime dependencies beyond `react`, `react-dom`, `zustand`, `lucide-react` (spec §11). Dev dependencies additionally include `@testing-library/dom` (peer of Testing Library React 16).
- CSS custom property names are fixed by `src/styles/tokens.css` as written in Task 22 (`--bg`, `--surface-1`, `--surface-2`, `--surface-glass`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-hover`, `--on-accent`, `--success`, `--danger`, `--warning`, `--hue-l`, `--hue-c`, `--chroma-neutral`, `--hue-<type>`, `--radius-*`, `--shadow-*`, `--font-*`, `--text-base/card/min`, `--rail-width`, `--topbar-height`, `--bottombar-height`, `--sidebar-width`, `--glow-opacity`, `--grain-opacity`). Cards set `--card-h` and `--card-c` inline from `hueFor()`.
- All UI text is Polish (decided in brainstorming). Content data stays as fetched.
- The build must produce one self-contained `dist/index.html` under 1.5 MB that works from `file://` (spec §10, §12).
- No interactive element is ever nested inside another interactive element (spec §7.3).
- Every animation is wrapped in `@media (prefers-reduced-motion: no-preference)` (spec §8).
- All date logic uses the browser's local time; tests build dates with `new Date(2026, 8, 4, 10, 30)`, never ISO strings with `Z` (spec §5.6).
- `src/data/schedule.json` is generated only by `npm run fetch`; never hand-edit it. Test fixtures `src/test/fixtures/slot-sets.json` and `fri-lectures.json` are generated once by `npm run fetch -- --fixtures` and committed (spec §5.2).
- Commit after every task with a conventional-commit message. Commits end with the trailer lines
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2`.
- Run tests with `npx vitest run <path>`; the whole suite with `npm test`; types with `npm run typecheck`.

---

## File structure

```
conference-melt/
  package.json, tsconfig.json, tsconfig.node.json, vite.config.ts, vitest.config.ts, index.html
  scripts/
    fetch-schedule.ts          CLI: fetch, normalize, validate, write JSON (+ --fixtures)
    lib/
      api.ts                   fetchAllPages(), fetchJson(), types of raw WP responses
      sanitize.ts              sanitizeHtml(), stripTags(), decodeEntities(), isBlankHtml()
      parse.ts                 firstParagraph(), parseTime(), extractAnchors(), parseByline(), signupFromTerm(), parseDay()
      locations.ts             parseLocation(), SHORT_LABELS, LEVEL_ORDER, compareLocations()
      speakers.ts              resolveSpeaker() with the slug / name / data-id tiers
      normalize.ts             normalizeAll(raw) -> ScheduleData (assembles sessions, terms, speakers in on-disk order)
      validate.ts              validate(data, raw) -> { errors, warnings }
      slot-sets.ts             SLOT_SETS predicates for the calibration fixture
      fixtures.ts              buildSlotSetsFixture(), buildFriLecturesFixture()
    __tests__/                 one test file per lib module + locations.fixture.json
  src/
    main.tsx                   mounts <App/>, applies theme, starts clock
    App.tsx                    shell layout, view routing, sheets, print section
    data/
      types.ts                 ScheduleData and friends (spec §4.5)
      schedule.json            generated
      index.tsx                loads schedule.json, builds DataIndex/SearchIndex once, exports DataProvider/useData
    domain/
      normalize.ts             normalizeText(), nameTokens()
      lookup.ts                DataIndex, buildIndex(), primaryType(), TYPE_PRIORITY, locationsOf(), speakersOf()
      time.ts
      slots.ts
      overlaps.ts
      filters.ts
      now.ts
      plan.ts
      share.ts
      text.ts
      ics.ts
      colors.ts                hueFor()
    state/
      store.ts                 Zustand store, actions, persist config, defaultSettings()
      hash.ts                  parseHash(), writeHash()
      boot.ts                  resolveBoot(): day/view/sharedPlan/favourites from hash + storage + defaults
      derive.ts                daySets(), buildColumns(), resolveTimeMode(), layout/visible/rendered sets
      theme.ts                 applyTheme()
      clipboard.ts             copyText() with fallback signal
      useMediaQuery.ts         useMediaQuery(), useTier(), matchesMedia(), prefersReducedMotion(), MOBILE_QUERY/WIDE_QUERY/COARSE_QUERY
    components/
      shell/  TopBar, DayTabs, ViewSwitcher, BottomBar, LiveChip, ShareBanner, FilterChips, Toasts
      grid/   ScheduleGrid, TimelineBody, SlotBody, TimeRail, ColumnHeader, SessionCard, ContinuationStub, NowLine, Strips, gridLayout.ts (pure geometry)
      list/   ScheduleList
      plan/   PlanView, PlanSummary, ConflictsPanel, PlanActions, PrintPlan
      detail/ DetailSheet, SpeakerBlock, SameTimeList
      filters/ FiltersPanel, Facet
      settings/ SettingsPanel
      ui/     Sheet, Popover, Chip, Avatar, Segmented, Slider, Toggle, EmptyState, CopySheet, Star, Burst (logo glyph), cx() class helper
    styles/
      tokens.css, base.css, print.css
    test/
      setup.ts                 jsdom matchMedia stub, testing-library cleanup
      fixtures/build.ts        makeSession(), makeData(), makeSpeaker(), makeLocation()
      fixtures/slot-sets.json, fri-lectures.json (generated)
      *.test.tsx               component tests
  docs/superpowers/specs/..., docs/superpowers/plans/...
```

Every component has a sibling `Name.module.css` (CSS Modules via Vite). Global tokens live in `styles/tokens.css`.

## Interfaces (the contract every task follows)

Types below are authoritative. A task that needs a name not listed here defines it locally and does not export it.

### `src/data/types.ts`

```ts
export type SignupStatus = "open" | "full" | "included" | "free" | "soon" | "unknown";
export type Level = "0" | "I" | "II" | "III" | "I+II" | null;

export interface Term { id: number; slug: string; name: string; count: number }
export interface Day { id: string; termId: number; date: string; label: string; short: string; labelLong: string }
export interface Location extends Term { venue: string; level: Level; room: string | null; short: string; order: number }
export interface Speaker { id: number; slug: string; name: string; photo: string | null; photoThumb: string | null; bioHtml: string; url: string; brands: string[] }
export interface Signup { status: SignupStatus; url: string | null; label: string }
export interface Session {
  id: string; eventId: number; day: string; title: string;
  start: number | null; end: number | null; allDay: boolean; timeText: string;
  speakerIds: number[]; byline: string | null;
  typeIds: number[]; themeIds: number[]; brandIds: number[]; locationIds: number[];
  signup: Signup; descriptionHtml: string; url: string;
}
export interface ScheduleMeta { source: string; fetchedAt: string; year: number; version: 1; eventCount: number; sessionCount: number; speakerCount: number }
export interface ScheduleData {
  meta: ScheduleMeta; days: Day[]; locations: Location[]; types: Term[]; themes: Term[]; brands: Term[];
  signupStatuses: Term[]; speakers: Speaker[]; sessions: Session[];
}
/** A session whose start is known. Layout code only ever handles these. */
export type TimedSession = Session & { start: number };
export function hasStart(s: Session): s is TimedSession { return s.start !== null; }
```

### `src/data/index.tsx`

```ts
export interface AppData { data: ScheduleData; index: DataIndex; search: SearchIndex }
export function buildAppData(data: ScheduleData): AppData;                 // buildIndex + buildSearchIndex
export const data: ScheduleData;                                           // the real snapshot (schedule.json)
export const index: DataIndex; export const search: SearchIndex;          // built once from `data`
export function DataProvider(props: { value: AppData; children: ReactNode }): ReactNode;
export function useData(): AppData;                                        // context; defaults to the real snapshot when no provider is mounted
```

Rule: React components read the schedule ONLY through `useData()`. Non-component code (`main.tsx`, `boot.ts`) may import `data`, `index`, `search` directly. Component tests wrap the tree in `<DataProvider value={buildAppData(makeData(...))}>`; they never `vi.mock` the data module.

### `src/domain/normalize.ts`

```ts
export function normalizeText(s: string): string;          // ł→l, NFD, strip marks, lowercase
export function nameTokens(s: string): Set<string>;        // normalizeText then /\p{L}+|\p{N}+/gu
```

### `src/domain/lookup.ts`

```ts
export interface DataIndex {
  sessionById: Map<string, Session>; sessionIds: Set<string>;
  speakerById: Map<number, Speaker>; locationById: Map<number, Location>;
  typeById: Map<number, Term>; themeById: Map<number, Term>; brandById: Map<number, Term>;
  dayById: Map<string, Day>; sessionsByDay: Map<string, Session[]>;
}
export function buildIndex(data: ScheduleData): DataIndex;
export const TYPE_PRIORITY: string[]; // ["Prelekcja","Prelekcja z sesją","Warsztaty","Fotospacer","Fotogra","PLAYGROUND","DZIAŁANIA W STREFIE SPRZĘTU","STREFA TELEOBIEKTYWÓW","Ogólne"]
export function typeRank(name: string): number;             // index in TYPE_PRIORITY, else TYPE_PRIORITY.length
export function primaryType(s: Session, index: DataIndex): Term | null;
export function locationsOf(s: Session, index: DataIndex): Location[];   // in locationIds order
export function speakersOf(s: Session, index: DataIndex): Speaker[];
export function locationLabel(s: Session, index: DataIndex): string;      // shorts joined by " / ", "" when none
```

### `src/domain/time.ts`

```ts
export function formatTime(m: number): string;                       // "09:05"
export function formatRange(start: number, end: number | null): string; // "09:05–10:15" (en dash) or "09:05"
export function durationLabel(start: number, end: number | null): string | null; // "1 h 10 min" | "2 h" | "45 min" | null
export function isAllDay(s: Session): boolean;                       // s.allDay
export function isPoint(s: Session): boolean;                        // start != null && end == null
export const POINT_MINUTES = 20;
export function visualEnd(s: TimedSession): number;                  // end ?? start + POINT_MINUTES
export function roundDown(m: number, step: number): number;
export function roundUp(m: number, step: number): number;
```

### `src/domain/slots.ts`

```ts
export interface Slot { index: number; start: number; lastStart: number; end: number; sessionIds: string[] }
export const DEFAULT_TOLERANCE = 15;
export function detectSlots(sessions: TimedSession[], opts?: { tolerance?: number }): Slot[];
export function slotIndexOf(s: TimedSession, slots: Slot[]): number;             // -1 when none
export function rowSpan(s: TimedSession, slots: Slot[], tolerance: number): number; // >= 1
export function rowInterval(s: TimedSession, slots: Slot[], tolerance: number): [number, number]; // [startRow, endRowExclusive]
export function spanAllowed(s: TimedSession, columnSessions: TimedSession[], slots: Slot[], tolerance: number): boolean;
export interface Regularity { medianGap: number; sharedRatio: number; distinguishable: boolean }
export function slotRegularity(slots: Slot[], sessions: TimedSession[], tolerance: number): Regularity;
```

### `src/domain/overlaps.ts`

```ts
export type EndOf = (s: TimedSession) => number;
export function overlaps(a: Session, b: Session): boolean;             // spec §5.3 rules
export function overlapGroups(sessions: TimedSession[], endOf?: EndOf): TimedSession[][];
export interface LaneInfo { lane: number; lanes: number }
export function packingEnd(s: TimedSession, minMinutes: number): number; // max(visualEnd, start + minMinutes)
export function packLanes(sessions: TimedSession[], minMinutes: number): Map<string, LaneInfo>;
export function maxConcurrency(sessions: TimedSession[]): number;
export interface ConflictPair { a: Session; b: Session }
export function planConflicts(planSessions: Session[]): ConflictPair[];
export function conflictCount(s: Session, planSessions: Session[]): number; // number of plan sessions overlapping s (excluding itself)
```

### `src/domain/filters.ts`

```ts
export interface Filters {
  types: number[]; themes: number[]; brands: number[]; locations: number[];
  signup: SignupStatus[]; query: string; onlyFavourites: boolean; hideAllDay: boolean;
}
export const EMPTY_FILTERS: Filters;
export type Facet = "types" | "themes" | "brands" | "locations" | "signup";
export const FACETS: Facet[];
export const SIGNUP_ORDER: SignupStatus[]; // ["open","full","included","free","soon","unknown"]
export type SearchIndex = Map<string, string>;                           // session id -> normalized searchable text
export function buildSearchIndex(data: ScheduleData, index: DataIndex): SearchIndex;
export interface FilterOptions { ignoreQuery?: boolean; ignoreFavourites?: boolean }
export function applyFilters(sessions: Session[], filters: Filters, planSet: ReadonlySet<string>, search: SearchIndex, opts?: FilterOptions): Session[];
export function facetCounts(sessions: Session[], filters: Filters, facet: Facet, planSet: ReadonlySet<string>, search: SearchIndex): Map<number | SignupStatus, number>;
export function activeFilterCount(f: Filters): number;                    // facets values + query + toggles
export function signupLabel(status: SignupStatus, data: ScheduleData): string;
```

### `src/domain/now.ts`

```ts
export const SOON_MINUTES = 15;
export function localDateString(d: Date): string;                          // "YYYY-MM-DD" local
export function resolveNow(search: string, realNow?: () => Date): Date;
export interface Clock { now(): Date }
export function createClock(search: string, realNow?: () => number): Clock; // base + (realNow() - bootedAt)
export function nowFor(day: Day, now: Date): number | null;
export type LiveState = "past" | "live" | "soon" | "upcoming";
export function liveState(s: Session, nowMinutes: number | null): LiveState;
export function defaultDay(days: Day[], now: Date, sessionsPerDay: Map<string, number>): Day;
export function isToday(day: Day, now: Date): boolean;
export function isTomorrow(day: Day, now: Date): boolean;
export function minutesUntil(start: number, nowMinutes: number): number;
```

### `src/domain/plan.ts`, `share.ts`, `text.ts`, `ics.ts`

```ts
// plan.ts
export function planSessions(planSet: ReadonlySet<string>, sessions: Session[]): Session[];
export function planForDay(planSessions: Session[], dayId: string): Session[];
export interface PlanSummary { perDay: { day: Day; count: number }[]; conflicts: { day: Day; pairs: ConflictPair[] }[]; conflictCount: number }
export function planSummary(planSessions: Session[], days: Day[]): PlanSummary;
export function nextUp(planSessions: Session[], days: Day[], now: Date): Session | null;
// share.ts
export const SHARE_VERSION = "1~";
export const DAY_CODES: Record<string, string>;     // czw→c, pt→p, sob→s, nd→n, pon→m, wt→t, sr→r
export function encodePlan(ids: string[]): string;
export function decodePlan(str: string, sessionIds: ReadonlySet<string>): { ids: string[]; unknown: number };
export function buildShareUrl(href: string, dayId: string, ids: string[]): string;
// text.ts
export interface PlanLinesEntry { day: Day | null; lines: string[] }
export function sessionLine(s: Session, data: ScheduleData, index: DataIndex): string;
export function planLines(sessions: Session[], data: ScheduleData, index: DataIndex): PlanLinesEntry[];
export function planAsText(sessions: Session[], data: ScheduleData, index: DataIndex): string;
// ics.ts
export function escapeIcsText(s: string): string;
export function foldIcsLine(line: string): string;   // 75-octet folding, UTF-8 safe, CRLF between pieces
export function buildIcs(sessions: Session[], data: ScheduleData, index: DataIndex): string;
```

### `src/domain/colors.ts`

```ts
export type ColorBy = "type" | "location" | "brand";
export interface Hue { hue: number; chroma: number }   // chroma 0 = neutral
export const TYPE_HUES: Record<string, number>;         // by type name, spec §8; fallback 300
export function hueFor(s: Session, colorBy: ColorBy, index: DataIndex): Hue;
export function hashHue(id: number): number;            // 12 evenly spaced hues
```

### `src/state/store.ts`

```ts
export type View = "grid" | "list" | "plan";
export type ColumnAxis = "location" | "type" | "brand" | "level" | "none";
export type TimeMode = "auto" | "slots" | "timeline";
export interface Settings {
  columnAxis: ColumnAxis; timeMode: TimeMode; slotTolerance: number; zoom: number;
  density: "compact" | "comfortable"; colorBy: ColorBy; showAvatars: boolean; allDayStrip: boolean;
  planLayout: "grid" | "list"; theme: "system" | "dark" | "light";
}
export interface Toast { id: number; text: string; action?: { label: string; run: () => void } }
export type SheetKind = "filters" | "settings" | "detail" | "copy" | null;
export interface SharedPlan { ids: string[]; unknown: number }
export interface State {
  day: string; view: View; filters: Filters; settings: Settings; favourites: string[];
  selectedSessionId: string | null; openSheet: SheetKind; sharedPlan: SharedPlan | null;
  previewPlan: string[] | null; now: Date; toasts: Toast[]; copyText: string | null; storageFailed: boolean;
}
export interface Actions {
  setDay(day: string): void; setView(view: View): void;
  setFilters(patch: Partial<Filters>): void; clearFilters(): void; clearFacet(facet: Facet): void; toggleFacetValue(facet: Facet, value: number | SignupStatus): void;
  setSettings(patch: Partial<Settings>): void; resetSettings(): void;
  toggleFavourite(id: string): void; addFavourites(ids: string[]): void; removeFavourite(id: string): void;
  selectSession(id: string | null): void; setSheet(kind: SheetKind): void;
  setSharedPlan(plan: SharedPlan | null): void; loadSharedPlan(): void; previewSharedPlan(): void; dismissSharedPlan(): void;
  savePreview(): void; closePreview(): void;
  pushToast(text: string, action?: Toast["action"]): void; dismissToast(id: number): void;
  setNow(now: Date): void; setCopyText(text: string | null): void;
}
export type Store = State & Actions;
export const STORAGE_KEY = "swiatlosila-2026:v1";
export const MOBILE_BREAKPOINT = 700;
export function defaultSettings(viewportWidth: number): Settings;
export function defaultView(viewportWidth: number): View;
export const useStore: UseBoundStore<StoreApi<Store>>;   // created with create<Store>()(persist(...))
export function usePlanSet(): ReadonlySet<string>;         // memoized Set of previewPlan ?? favourites
export function planSetOf(state: State): ReadonlySet<string>;
```

Persisted slice: `{ favourites, settings, view }` under `STORAGE_KEY`, `version: 1`, `merge` per spec §6. `storageFailed` is set true when the storage adapter throws; `main.tsx` pushes the one toast.

### `src/state/hash.ts`, `boot.ts`, `theme.ts`, `clipboard.ts`

```ts
// hash.ts
export interface HashState { d?: string; v?: string; plan?: string }
export function parseHash(hash: string): HashState;                  // "#d=pt&v=grid&plan=1~..." (leading # optional)
export function buildHash(h: HashState): string;                     // "#d=pt&v=grid" (+ "&plan=..." when present), always in d,v,plan order
export function writeHash(h: HashState): void;                       // history.replaceState(null, "", buildHash(h))
// boot.ts
export interface BootResult { day: string; view: View; sharedPlan: SharedPlan | null; favourites: string[]; droppedFavourites: number }
export function resolveBoot(args: { hash: string; persistedView: View | null; persistedFavourites: string[]; viewportWidth: number; data: ScheduleData; index: DataIndex; now: Date }): BootResult;
// theme.ts
export function applyTheme(theme: Settings["theme"]): void;         // sets document.documentElement.dataset.theme to "dark"|"light"
export function watchSystemTheme(get: () => Settings["theme"]): () => void; // re-applies on prefers-color-scheme change, returns unsubscribe
// clipboard.ts
export async function copyText(text: string): Promise<boolean>;      // false when clipboard missing or rejects
```

`favourites` is `persistedFavourites` filtered to ids present in `index.sessionIds`; `droppedFavourites` is how many were removed (spec §6).

### `src/state/derive.ts`

```ts
export interface DaySets {
  all: Session[];                 // the day's sessions (plan-restricted in plan view)
  layout: TimedSession[];         // spec §7.2 layout set
  visible: Session[];             // spec §7.2 visible set
  rendered: TimedSession[];       // layout ∩ visible
  renderedIds: Set<string>;
  stripAllDay: Session[];         // visible & allDay, when settings.allDayStrip
  stripNoTime: Session[];         // visible & start == null
}
export function daySets(args: { data: ScheduleData; index: DataIndex; search: SearchIndex; dayId: string; filters: Filters; settings: Settings; planSet: ReadonlySet<string>; planView: boolean }): DaySets;
export interface Column { key: string; label: string; sublabel: string | null; sessions: TimedSession[] /* layout-set members of this column */; renderedIds: Set<string>; count: number }
export function buildColumns(sets: DaySets, axis: ColumnAxis, data: ScheduleData, index: DataIndex): Column[]; // only columns with count > 0
export interface ResolvedTime { mode: "slots" | "timeline"; slots: Slot[]; regularity: Regularity; auto: boolean }
export function resolveTimeMode(settings: Settings, layout: TimedSession[]): ResolvedTime;
export interface ListGroup { key: string; label: string; sessions: Session[]; total: number; parallel: number } // parallel = maxConcurrency of timed visible members
export function listGroups(sets: DaySets, resolved: ResolvedTime, settings: Settings): ListGroup[]; // spec §7.4 incl. "Całodniowe" first and "Bez godziny" last
```

### `src/components/grid/gridLayout.ts` (pure geometry, tested)

```ts
export const RAIL_WIDTH = 56;
export interface Density { minColumnWidth: number; laneMin: number; rowMin: number; minCardHeight: number }
export function densityFor(density: Settings["density"], coarsePointer: boolean): Density; // 200/180/88/44 comfortable; 160/150/64/28 compact; minCardHeight 44 on coarse
export interface TimelineRange { start: number; end: number }             // minutes, spec §7.2 rounding + 15 padding
export function timelineRange(layout: TimedSession[]): TimelineRange;    // layout non-empty
export interface CardGeometry { top: number; height: number; lane: number; lanes: number }
export function timelineGeometry(column: Column, range: TimelineRange, zoom: number, density: Density): { columnWidth: number; columnLanes: number; cards: Map<string, CardGeometry> };
export function cardStyle(g: CardGeometry): { top: string; height: string; left: string; width: string }; // px / calc(...) strings per spec §7.2
export interface SlotPlacement { kind: "card" | "span" | "stub"; sessionId: string; column: number; row: number; span: number } // row/column are 0-based slot/column indices
export function slotPlacements(column: Column, columnIndex: number, slots: Slot[], tolerance: number, renderedIds: Set<string>): SlotPlacement[];
export function gridArea(p: SlotPlacement): { gridColumn: string; gridRow: string }; // column+2, row+2, "r / span k" for spans
```

### Component props (all in `src/components/...`)

```ts
// ui/
Sheet: { open: boolean; side: "right" | "bottom"; title: string; onClose(): void; children; labelledBy?: string }
Popover: { open: boolean; anchorRef: RefObject<HTMLElement | null>; onClose(): void; children; title: string }
Chip: { children; onRemove?(): void; tone?: "default" | "accent" }
Avatar: { name: string; src: string | null; size?: number; hue?: number }
Segmented<T extends string>: { value: T; options: { value: T; label: string; hint?: string }[]; onChange(v: T): void; ariaLabel: string }
Slider: { value: number; min: number; max: number; step: number; onChange(v: number): void; label: string; format?(v: number): string }
Toggle: { checked: boolean; onChange(v: boolean): void; label: string; hint?: string }
EmptyState: { title: string; text?: string; actions?: ReactNode; illustration?: boolean }
CopySheet: reads store.copyText; Sheet with a read-only pre-selected textarea
Star: { pressed: boolean; onToggle(): void; size?: number } // <button aria-pressed aria-label="Do planu">
// shell/
TopBar, DayTabs, ViewSwitcher, BottomBar, LiveChip, ShareBanner, FilterChips, Toasts: no props, read the store + data
// grid/
ScheduleGrid: { sets: DaySets; columns: Column[]; resolved: ResolvedTime; dayId: string } (reads settings/plan/now from the store)
SessionCard: { session: Session; compact?: boolean; showLocation: boolean; style?: CSSProperties; variant: "grid" | "row" | "chip" }
ContinuationStub: { session: TimedSession }
// list/
ScheduleList: { groups: ListGroup[] }
// plan/
PlanView: no props (computes its own sets with planView: true)
PrintPlan: no props (renders planLines of the plan set)
// detail/
DetailSheet: no props (reads selectedSessionId)
// filters/
FiltersPanel: { variant: "sidebar" | "sheet" }
// settings/
SettingsPanel: { variant: "popover" | "sheet"; anchorRef?: RefObject<HTMLElement | null>; open: boolean; onClose(): void }
```

### `src/test/fixtures/build.ts`

```ts
export function makeSession(overrides?: Partial<Session>): Session;     // defaults: id "1:pt", eventId 1, day "pt", title "Sesja", start 570, end 630, allDay false, typeIds [184], locationIds [233], signup included
export function makeLocation(overrides?: Partial<Location>): Location;
export function makeSpeaker(overrides?: Partial<Speaker>): Speaker;
export function makeDay(overrides?: Partial<Day>): Day;                 // default pt / 2026-09-04
export function makeData(sessions: Session[], overrides?: Partial<ScheduleData>): ScheduleData; // includes default days (czw, pt, sob), types (184 Prelekcja, 278 Prelekcja z sesją, 5 Warsztaty, 242 Ogólne), locations (233 Sala wykł. 1, 281 Sala wykł. 2, 308 Stoiska · Plenum, 318 Rejestracja)
```

### Fetch script types (`scripts/lib/api.ts`)

```ts
export interface WpRendered { rendered: string }
export interface WpEvent { id: number; slug: string; link: string; title: WpRendered; content: WpRendered; "cyfrowe-event-type": number[]; "cyfrowe-event-theme": number[]; "cyfrowe-event-brand": number[]; "cyfrowe-event-location": number[]; "cyfrowe-event-day": number[]; "cyfrowe-event-zapisy": number[] }
export interface WpTerm { id: number; slug: string; name: string; count: number; taxonomy: string }
export interface WpMedia { source_url: string; media_details?: { sizes?: Record<string, { source_url: string; width: number; height: number }> } }
export interface WpSpeaker { id: number; slug: string; link: string; title: WpRendered; content: WpRendered; featured_media: number; "cyfrowe-prelegent-type": number[]; _embedded?: { "wp:featuredmedia"?: WpMedia[] } }
export interface RawData { events: WpEvent[]; speakers: WpSpeaker[]; terms: Record<TaxonomyName, WpTerm[]> }
export type TaxonomyName = "cyfrowe-event-type" | "cyfrowe-event-theme" | "cyfrowe-event-brand" | "cyfrowe-event-location" | "cyfrowe-event-day" | "cyfrowe-event-zapisy" | "cyfrowe-prelegent-type";
export const BASE = "https://swiatlosila.pl/wp-json/wp/v2";
export async function fetchJson<T>(url: string): Promise<T>;                  // throws on non-2xx
export async function fetchAllPages<T>(path: string): Promise<T[]>;           // per_page=100, stops on rest_post_invalid_page_number
export async function fetchRaw(): Promise<RawData>;
```

### Fetch script lib signatures

```ts
// sanitize.ts
export function decodeEntities(s: string): string;
export function stripTags(html: string): string;                      // tags -> " ", decode, collapse whitespace, trim
export function isBlankHtml(html: string): boolean;
export function sanitizeHtml(html: string): string;                   // spec §4.3
export function bioHtml(html: string): string;                        // sanitizeHtml + dash paragraphs -> <hr>
// parse.ts
export function paragraphs(html: string): string[];                   // inner HTML of each <p>, wp comments removed
export function firstParagraph(html: string): string;                 // first non-blank, "" when none
export interface ParsedTime { start: number | null; end: number | null; timeText: string; endDiscarded: boolean }
export function parseTime(text: string): ParsedTime;
export interface Anchor { href: string; text: string; dataType: string | null; dataId: string | null; host: string }
export function extractAnchors(html: string): Anchor[];
export function isSiteHost(host: string): boolean;                    // swiatlosila.pl or www.
export function parseByline(text: string, timeText: string, removeTexts: string[]): string | null;
export function signupStatusFromTerm(name: string | undefined): SignupStatus;
export interface ParsedDay { id: string; label: string; short: string; labelLong: string; date: string }
export function parseDay(termName: string, year: number): ParsedDay | null;
export function isAllDayEvent(start: number | null, end: number | null, typeSlugs: string[]): boolean;
// locations.ts
export interface ParsedLocation { venue: string; level: Level; room: string | null; rule: 1 | 2 | 3 | 4 | 5 | 6 }
export function parseLocation(name: string): ParsedLocation;
export const SHORT_LABELS: Record<number, string>;
export function shortLabel(id: number, parsed: ParsedLocation): { short: string; fromMap: boolean };
export const LEVEL_ORDER: Level[];  // ["0","I","I+II","II","III",null]
export function compareLocations(a: { level: Level; name: string }, b: { level: Level; name: string }): number;
// speakers.ts
export interface SpeakerLookup { bySlug: Map<string, Speaker>; byId: Map<number, Speaker>; byTokens: { tokens: Set<string>; speaker: Speaker }[] }
export function buildSpeakerLookup(speakers: Speaker[]): SpeakerLookup;
export type ResolveTier = "slug" | "name" | "data-id";
export function resolveSpeaker(anchor: Anchor, lookup: SpeakerLookup): { speaker: Speaker; tier: ResolveTier } | null;
// normalize.ts (scripts)
export interface NormalizeResult { data: ScheduleData; warnings: string[] }
export function normalizeAll(raw: RawData, opts: { year: number; fetchedAt: string; source: string }): NormalizeResult;
// validate.ts
export function validate(data: ScheduleData, raw: RawData): { errors: string[]; warnings: string[] };
// slot-sets.ts
export interface SlotSetDef { id: string; day: string; typeIds?: number[]; locationIds?: number[] }
export const SLOT_SETS: SlotSetDef[];
export function slotSetMembers(def: SlotSetDef, data: ScheduleData): Session[];  // allDay false, start != null
// fixtures.ts
export function buildSlotSetsFixture(data: ScheduleData): Record<string, { id: string; start: number; end: number | null }[]>;
export function buildFriLecturesFixture(data: ScheduleData): ScheduleData;
```

### npm scripts (`package.json`)

```json
"dev": "vite", "build": "vite build", "preview": "vite preview",
"test": "vitest run", "test:watch": "vitest", "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json",
"fetch": "tsx scripts/fetch-schedule.ts", "size": "node scripts/check-size.mjs", "tokens": "node scripts/check-tokens.mjs",
"check": "npm run typecheck && npm run tokens && npm test && npm run build && npm run size"
```

---

## Task index

**Foundation**

- Task 1: Project scaffold
- Task 2: Domain basics: `normalize`, `lookup`, `time`

**Data pipeline**

- Task 3: HTML sanitizer and entity helpers (`scripts/lib/sanitize.ts`)
- Task 4: Event content and taxonomy parsing (`scripts/lib/parse.ts`)
- Task 5: Location parsing, short labels and ordering (`scripts/lib/locations.ts`)
- Task 6: Speaker resolution (`scripts/lib/speakers.ts`)
- Task 7: API client, normalizer, validator, slot sets, fixtures and the fetch CLI
- Task 8: Generate the real snapshot and fixtures

**Domain**

- Task 9: Slot detection and row spans (`src/domain/slots.ts`)
- Task 10: Overlaps, lane packing and plan conflicts (`src/domain/overlaps.ts`)
- Task 11: Filters, search index and facet counts (`src/domain/filters.ts`)
- Task 12: Clock, live state and default day (`src/domain/now.ts`)
- Task 13: Colour hues (`src/domain/colors.ts`)
- Task 14: Plan selectors and summary (`src/domain/plan.ts`)
- Task 15: Share-link encoding (`src/domain/share.ts`)
- Task 16: Plan as text (`src/domain/text.ts`)
- Task 17: iCalendar export (`src/domain/ics.ts`)

**State**

- Task 18: URL hash, theme and clipboard helpers
- Task 19: Zustand store with persistence
- Task 20: Boot resolution
- Task 21: Derived session sets, columns, time mode and list groups

**UI primitives and shell**

- Task 22: UI primitives (`src/components/ui/*`)
- Task 23: Shell components, `App.tsx` and `main.tsx`

**Grid engine**

- Task 24: Pure grid geometry (`gridLayout.ts`)
- Task 25: SessionCard and ContinuationStub
- Task 26: ScheduleGrid, TimelineBody, TimeRail, ColumnHeader, NowLine (timeline mode)
- Task 27: SlotBody (slot mode)
- Task 28: Strips and wiring

**List, filters, settings, detail**

- Task 29: ScheduleList
- Task 30: FiltersPanel and Facet
- Task 31: SettingsPanel
- Task 32: DetailSheet, SpeakerBlock and SameTimeList

**Plan, polish, verification**

- Task 33: Plan view
- Task 34: Motion and eye-candy
- Task 35: Build and verification

Tasks within a phase depend on the previous task; phases depend on all earlier phases. Task 8 needs network access to swiatlosila.pl. Task 23 creates placeholder modules for the components that Tasks 26–33 replace, so typecheck, tests and build stay green at every task boundary.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx` (placeholder; replaced by the shell task)
- Create: `src/styles/tokens.css`
- Create: `src/styles/base.css`
- Create: `src/data/types.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/fixtures/build.ts`
- Create: `scripts/check-size.mjs`
- Test: `src/test/App.test.tsx`

`.gitignore` already exists in the repo (`node_modules/`, `dist/`, `.DS_Store`, `*.log`); do not touch it.

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `src/data/types.ts`: `SignupStatus`, `Level`, `Term`, `Day`, `Location`, `Speaker`, `Signup`, `Session`, `ScheduleMeta`, `ScheduleData`, `TimedSession`, `hasStart(s: Session): s is TimedSession` — exactly the contract.
  - `src/test/fixtures/build.ts`: `makeSession(overrides?: Partial<Session>): Session`, `makeLocation(overrides?: Partial<Location>): Location`, `makeSpeaker(overrides?: Partial<Speaker>): Speaker`, `makeDay(overrides?: Partial<Day>): Day`, `makeData(sessions: Session[], overrides?: Partial<ScheduleData>): ScheduleData`. `makeSession` defaults: id `"1:pt"`, eventId 1, day `"pt"`, title `"Sesja"`, start 570, end 630, allDay false, typeIds `[184]`, locationIds `[233]`, signup `included`; when `id` is not overridden it is derived as `"<eventId>:<day>"` from the (possibly overridden) `eventId` and `day`, and `timeText` is derived from `start`/`end`. `makeData` includes days `czw`/`pt`/`sob`, types 184/278/5/242 and locations 308/233/281/318 (in `order` order); `themes`, `brands`, `speakers` and `signupStatuses` are empty unless overridden.
  - npm scripts `dev`, `build`, `preview`, `test`, `test:watch`, `typecheck`, `fetch`, `size`, `check` (the `fetch` script points at `scripts/fetch-schedule.ts`, created by the fetch-script task).
  - CSS custom properties in `src/styles/tokens.css` (listed in Step 7) that every component stylesheet uses.
  - `window.matchMedia` stub (always `matches: false`) and automatic Testing Library cleanup for every test file.

All commands below run from the project root `/Users/tom/Projects/conference-melt`. Node 20 or newer is required.

- [ ] **Step 1: Create `package.json`**

`@testing-library/dom` is a required peer dependency of `@testing-library/react` 16 and is listed explicitly so `npm install` never depends on peer auto-install.

```json
{
  "name": "swiatlosila-2026-harmonogram",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json",
    "fetch": "tsx scripts/fetch-schedule.ts",
    "size": "node scripts/check-size.mjs",
    "check": "npm run typecheck && npm test && npm run build && npm run size"
  },
  "dependencies": {
    "lucide-react": "^0.511.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "zustand": "^5.0.5"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.4.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^22.15.0",
    "@types/react": "^19.1.6",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.5.0",
    "jsdom": "^26.1.0",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vite-plugin-singlefile": "^2.2.0",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `tsconfig.node.json`**

Covers the fetch script, its tests and the two Vite config files. Files under `src/` that the scripts import (`src/data/types.ts`, `src/domain/normalize.ts`) are pulled in transitively and must stay DOM-free.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["scripts", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});
```

- [ ] **Step 5: Create `vitest.config.ts`**

Vitest reads this file instead of `vite.config.ts`, so the React plugin is repeated here. `classNameStrategy: "non-scoped"` keeps CSS Module class names verbatim so tests can query `card__main` and friends.

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["src/test/setup.ts"],
    css: {
      modules: {
        classNameStrategy: "non-scoped",
      },
    },
  },
});
```

- [ ] **Step 6: Create `index.html`**

```html
<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>ŚwiatłoSiła 2026 · Harmonogram</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500..800&family=Inter:wght@400..600&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `src/styles/tokens.css`**

Dark values on `:root`, light values under `[data-theme="light"]` (spec §8). Cards paint their edge as `oklch(var(--hue-l) var(--card-c) var(--card-h))`, where the two `--card-*` values are set inline by the card from `hueFor()`.

```css
/* Design tokens (spec §8). Dark values on :root, light values under [data-theme="light"]. */
:root {
  color-scheme: dark;

  /* Surfaces and text */
  --bg: oklch(14% 0.01 60);
  --surface-1: oklch(19% 0.012 60);
  --surface-2: oklch(24% 0.014 60);
  --border: oklch(32% 0.02 60);
  --text: oklch(96% 0.01 80);
  --text-muted: oklch(72% 0.02 80);

  /* Accent and status */
  --accent: oklch(70% 0.2 45);
  --accent-hover: oklch(76% 0.2 45);
  --on-accent: oklch(14% 0.02 45);
  --success: oklch(75% 0.17 150);
  --danger: oklch(68% 0.2 25);
  --warning: oklch(80% 0.16 85);

  /* Type hues (spec §8): lightness 72% / chroma 0.16 in dark, lightness 55% in light. */
  --hue-l: 72%;
  --hue-c: 0.16;
  --hue-prelekcja: 45;
  --hue-prelekcja-z-sesja: 25;
  --hue-warsztaty: 340;
  --hue-fotospacer: 95;
  --hue-fotogra: 95;
  --hue-playground: 175;
  --hue-strefa-sprzetu: 240;
  --hue-teleobiektywy: 260;
  --hue-ogolne: 0;
  --hue-other: 300;
  --chroma-neutral: 0;

  /* Shape and depth */
  --radius-card: 8px;
  --radius-sheet: 12px;
  --radius-chip: 999px;
  --shadow-1: 0 1px 2px oklch(0% 0 0 / 0.35), 0 4px 12px oklch(0% 0 0 / 0.25);
  --shadow-2: 0 2px 4px oklch(0% 0 0 / 0.4), 0 12px 28px oklch(0% 0 0 / 0.35);

  /* Typography */
  --font-display: "Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-body: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --text-base: 15px;
  --text-card: 13px;
  --text-min: 12px;

  /* Layout */
  --rail-width: 56px;
  --sidebar-width: 280px;
  --glow-opacity: 0.3;
  --grain-opacity: 0.04;
}

[data-theme="light"] {
  color-scheme: light;

  --bg: oklch(98% 0.005 80);
  --surface-1: oklch(100% 0 0);
  --surface-2: oklch(95% 0.01 80);
  --border: oklch(86% 0.015 80);
  --text: oklch(20% 0.02 60);
  --text-muted: oklch(45% 0.02 60);

  --accent: oklch(60% 0.2 45);
  --accent-hover: oklch(54% 0.2 45);
  --on-accent: oklch(98% 0.01 45);
  --success: oklch(45% 0.17 150);
  --danger: oklch(45% 0.2 25);
  --warning: oklch(45% 0.16 85);

  --hue-l: 55%;

  --shadow-1: 0 1px 2px oklch(0% 0 0 / 0.08), 0 4px 12px oklch(0% 0 0 / 0.08);
  --shadow-2: 0 2px 4px oklch(0% 0 0 / 0.1), 0 12px 28px oklch(0% 0 0 / 0.14);

  --glow-opacity: 0.12;
}
```

- [ ] **Step 8: Create `src/styles/base.css`**

```css
/* Global reset and base styles. Component styles live in CSS Modules next to each component. */
*,
*::before,
*::after {
  box-sizing: border-box;
}

* {
  margin: 0;
}

html {
  height: 100%;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

body {
  min-height: 100%;
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: 1.4;
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}

#root {
  min-height: 100dvh;
}

h1,
h2,
h3,
h4 {
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1.15;
}

img,
svg {
  display: block;
  max-width: 100%;
}

button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
}

button {
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  touch-action: manipulation;
}

a {
  color: inherit;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

:focus:not(:focus-visible) {
  outline: none;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 9: Create `src/data/types.ts`** (verbatim from the contract)

```ts
export type SignupStatus = "open" | "full" | "included" | "free" | "soon" | "unknown";
export type Level = "0" | "I" | "II" | "III" | "I+II" | null;

export interface Term {
  id: number;
  slug: string;
  name: string;
  count: number;
}

export interface Day {
  id: string;
  termId: number;
  date: string;
  label: string;
  short: string;
  labelLong: string;
}

export interface Location extends Term {
  venue: string;
  level: Level;
  room: string | null;
  short: string;
  order: number;
}

export interface Speaker {
  id: number;
  slug: string;
  name: string;
  photo: string | null;
  photoThumb: string | null;
  bioHtml: string;
  url: string;
  brands: string[];
}

export interface Signup {
  status: SignupStatus;
  url: string | null;
  label: string;
}

export interface Session {
  id: string;
  eventId: number;
  day: string;
  title: string;
  start: number | null;
  end: number | null;
  allDay: boolean;
  timeText: string;
  speakerIds: number[];
  byline: string | null;
  typeIds: number[];
  themeIds: number[];
  brandIds: number[];
  locationIds: number[];
  signup: Signup;
  descriptionHtml: string;
  url: string;
}

export interface ScheduleMeta {
  source: string;
  fetchedAt: string;
  year: number;
  version: 1;
  eventCount: number;
  sessionCount: number;
  speakerCount: number;
}

export interface ScheduleData {
  meta: ScheduleMeta;
  days: Day[];
  locations: Location[];
  types: Term[];
  themes: Term[];
  brands: Term[];
  signupStatuses: Term[];
  speakers: Speaker[];
  sessions: Session[];
}

/** A session whose start is known. Layout code only ever handles these. */
export type TimedSession = Session & { start: number };

export function hasStart(s: Session): s is TimedSession {
  return s.start !== null;
}
```

- [ ] **Step 10: Create `src/test/setup.ts`**

jsdom has no `matchMedia`; the stub always reports `matches: false`, which is what spec §7.2 expects for the coarse-pointer check in tests. `globals` is off, so Testing Library's automatic cleanup is wired here.

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 11: Create `src/test/fixtures/build.ts`**

Term ids, slugs, names and counts are the real ones from the WordPress taxonomies (2026-09-03). Location records follow the parsing rules and `short` table of spec §4.2; `order` follows level order (`I` before `II` before `null`) then Polish collation (`"So Salsa - …"` sorts before `"SoSalsa - …"`).

```ts
import type { Day, Location, ScheduleData, Session, Speaker, Term } from "../../data/types";

const THURSDAY: Day = {
  id: "czw",
  termId: 276,
  date: "2026-09-03",
  label: "Czwartek",
  short: "Czw",
  labelLong: "Czwartek, 3 września",
};

const FRIDAY: Day = {
  id: "pt",
  termId: 53,
  date: "2026-09-04",
  label: "Piątek",
  short: "Pt",
  labelLong: "Piątek, 4 września",
};

const SATURDAY: Day = {
  id: "sob",
  termId: 18,
  date: "2026-09-05",
  label: "Sobota",
  short: "Sob",
  labelLong: "Sobota, 5 września",
};

const DAYS: Day[] = [THURSDAY, FRIDAY, SATURDAY];

const TYPES: Term[] = [
  { id: 184, slug: "prelekcja", name: "Prelekcja", count: 51 },
  { id: 278, slug: "prelekcja-z-sesja", name: "Prelekcja z sesją", count: 5 },
  { id: 5, slug: "warsztaty", name: "Warsztaty", count: 12 },
  { id: 242, slug: "ogolne", name: "Ogólne", count: 13 },
];

const LOCATIONS: Location[] = [
  {
    id: 308,
    slug: "stoiska-wystawcow-poziom-i-plenum",
    name: "Stoiska wystawców - poziom I (PLENUM)",
    count: 54,
    venue: "Stoiska wystawców",
    level: "I",
    room: "PLENUM",
    short: "Stoiska · Plenum",
    order: 0,
  },
  {
    id: 233,
    slug: "so-salsa-1",
    name: "So Salsa - poziom II - Sala wykładowa nr 1",
    count: 16,
    venue: "So Salsa",
    level: "II",
    room: "Sala wykładowa nr 1",
    short: "Sala wykł. 1",
    order: 1,
  },
  {
    id: 281,
    slug: "so-salsa-1-2",
    name: "SoSalsa - poziom II - Sala wykładowa nr 2",
    count: 16,
    venue: "SoSalsa",
    level: "II",
    room: "Sala wykładowa nr 2",
    short: "Sala wykł. 2",
    order: 2,
  },
  {
    id: 318,
    slug: "rejestracja",
    name: "Rejestracja",
    count: 1,
    venue: "Rejestracja",
    level: null,
    room: null,
    short: "Rejestracja",
    order: 3,
  },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function hhmm(minutes: number): string {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

function timeTextFor(start: number | null, end: number | null): string {
  if (start === null) return "";
  if (end === null) return hhmm(start);
  return `${hhmm(start)}-${hhmm(end)}`;
}

export function makeSession(overrides: Partial<Session> = {}): Session {
  const eventId = overrides.eventId ?? 1;
  const day = overrides.day ?? "pt";
  const start = overrides.start === undefined ? 570 : overrides.start;
  const end = overrides.end === undefined ? 630 : overrides.end;
  return {
    id: `${eventId}:${day}`,
    eventId,
    day,
    title: "Sesja",
    start,
    end,
    allDay: false,
    timeText: timeTextFor(start, end),
    speakerIds: [],
    byline: null,
    typeIds: [184],
    themeIds: [],
    brandIds: [],
    locationIds: [233],
    signup: { status: "included", url: null, label: "W ramach festiwalu" },
    descriptionHtml: "",
    url: `https://swiatlosila.pl/cyfrowe-event/sesja-${eventId}/`,
    ...overrides,
  };
}

export function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 999,
    slug: "sala-testowa",
    name: "Sala testowa",
    count: 0,
    venue: "Sala testowa",
    level: null,
    room: null,
    short: "Sala testowa",
    order: 99,
    ...overrides,
  };
}

export function makeSpeaker(overrides: Partial<Speaker> = {}): Speaker {
  return {
    id: 100,
    slug: "anna-kowalska",
    name: "Anna Kowalska",
    photo: null,
    photoThumb: null,
    bioHtml: "",
    url: "https://swiatlosila.pl/cyfrowe-prelegent/anna-kowalska/",
    brands: [],
    ...overrides,
  };
}

export function makeDay(overrides: Partial<Day> = {}): Day {
  return { ...FRIDAY, ...overrides };
}

export function makeData(sessions: Session[], overrides: Partial<ScheduleData> = {}): ScheduleData {
  const speakers = overrides.speakers ?? [];
  const eventIds = new Set(sessions.map((s) => s.eventId));
  return {
    meta: {
      source: "https://swiatlosila.pl/harmonogram-2026/",
      fetchedAt: "2026-09-03T10:00:00.000Z",
      year: 2026,
      version: 1,
      eventCount: eventIds.size,
      sessionCount: sessions.length,
      speakerCount: speakers.length,
    },
    days: DAYS.map((d) => ({ ...d })),
    locations: LOCATIONS.map((l) => ({ ...l })),
    types: TYPES.map((t) => ({ ...t })),
    themes: [],
    brands: [],
    signupStatuses: [],
    speakers,
    sessions,
    ...overrides,
  };
}
```

- [ ] **Step 12: Create `scripts/check-size.mjs`**

```js
import { statSync } from "node:fs";
import { resolve } from "node:path";

const LIMIT_BYTES = 1.5 * 1024 * 1024;
const file = resolve(process.cwd(), "dist/index.html");

let size;
try {
  size = statSync(file).size;
} catch {
  console.error(`check-size: ${file} not found. Run "npm run build" first.`);
  process.exit(1);
}

const kb = (size / 1024).toFixed(1);
if (size > LIMIT_BYTES) {
  console.error(`check-size: dist/index.html is ${kb} KB, over the 1.5 MB limit.`);
  process.exit(1);
}
console.log(`check-size: dist/index.html is ${kb} KB (limit 1536 KB). OK`);
```

- [ ] **Step 13: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` and `package-lock.json` appear, no `ERESOLVE` errors. The lock file is committed with this task.

- [ ] **Step 14: Write the failing test `src/test/App.test.tsx`**

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../App";

describe("App", () => {
  it("renders the festival heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "ŚwiatłoSiła 2026" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 15: Run the test to verify it fails**

```bash
cd /Users/tom/Projects/conference-melt && npx vitest run src/test/App.test.tsx
```

Expected: 1 failed test file with a module-resolution error, `Error: Failed to load url ../App (resolved id: ../App) in src/test/App.test.tsx. Does the file exist?` (wording varies slightly by Vite version; the point is that `src/App.tsx` does not exist yet).

- [ ] **Step 16: Create `src/App.tsx`** (placeholder; the shell task replaces it)

```tsx
export default function App() {
  return <h1>ŚwiatłoSiła 2026</h1>;
}
```

- [ ] **Step 17: Create `src/main.tsx`**

Later tasks add theme application and the 30-second clock here; for now it only mounts the app and loads the global styles.

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/base.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Brak elementu #root");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 18: Run the test to verify it passes**

```bash
cd /Users/tom/Projects/conference-melt && npx vitest run src/test/App.test.tsx
```

Expected: `Test Files 1 passed (1)`, `Tests 1 passed (1)`.

- [ ] **Step 19: Typecheck both projects**

```bash
cd /Users/tom/Projects/conference-melt && npm run typecheck
```

Expected: both `tsc` invocations exit 0 with no output.

- [ ] **Step 20: Run the whole suite, build and check the bundle size**

```bash
cd /Users/tom/Projects/conference-melt && npx vitest run && npm run build && npm run size
```

Expected: the suite passes; `vite build` writes `dist/index.html` (vite-plugin-singlefile reports the inlined script and stylesheet); `check-size` prints `check-size: dist/index.html is <n> KB (limit 1536 KB). OK`.

- [ ] **Step 21: Commit**

```bash
cd /Users/tom/Projects/conference-melt && git add -A && git commit -m "chore: scaffold Vite, React and Vitest project" -m "Adds package.json with pinned dependency ranges and the npm scripts, TypeScript configs for src and scripts, Vite and Vitest configs, index.html with the Google Fonts link, design tokens and base styles, the schedule data types, the Vitest setup file, synthetic test fixtures, a placeholder App and the dist size check.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```

---

### Task 2: Domain basics: `normalize`, `lookup`, `time`

**Files:**
- Create: `src/domain/normalize.ts`
- Create: `src/domain/lookup.ts`
- Create: `src/domain/time.ts`
- Test: `src/domain/normalize.test.ts`
- Test: `src/domain/lookup.test.ts`
- Test: `src/domain/time.test.ts`

**Interfaces:**
- Consumes (Task 1):
  - `src/data/types.ts`: `Session`, `TimedSession`, `hasStart(s: Session): s is TimedSession`, `ScheduleData`, `Term`, `Day`, `Location`, `Speaker`.
  - `src/test/fixtures/build.ts`: `makeSession(overrides?: Partial<Session>): Session`, `makeData(sessions: Session[], overrides?: Partial<ScheduleData>): ScheduleData`, `makeLocation(overrides?: Partial<Location>): Location`, `makeSpeaker(overrides?: Partial<Speaker>): Speaker`.
- Produces (exactly the contract; used by the fetch script, `filters.ts`, `slots.ts`, `overlaps.ts`, `derive.ts`, `colors.ts`, `text.ts`, `ics.ts` and every component):
  - `src/domain/normalize.ts`: `normalizeText(s: string): string`; `nameTokens(s: string): Set<string>`.
  - `src/domain/lookup.ts`: `interface DataIndex { sessionById: Map<string, Session>; sessionIds: Set<string>; speakerById: Map<number, Speaker>; locationById: Map<number, Location>; typeById: Map<number, Term>; themeById: Map<number, Term>; brandById: Map<number, Term>; dayById: Map<string, Day>; sessionsByDay: Map<string, Session[]> }`; `buildIndex(data: ScheduleData): DataIndex`; `TYPE_PRIORITY: string[]`; `typeRank(name: string): number`; `primaryType(s: Session, index: DataIndex): Term | null`; `locationsOf(s: Session, index: DataIndex): Location[]`; `speakersOf(s: Session, index: DataIndex): Speaker[]`; `locationLabel(s: Session, index: DataIndex): string`.
  - `src/domain/time.ts`: `formatTime(m: number): string`; `formatRange(start: number, end: number | null): string`; `durationLabel(start: number, end: number | null): string | null`; `isAllDay(s: Session): boolean`; `isPoint(s: Session): boolean`; `POINT_MINUTES = 20`; `visualEnd(s: TimedSession): number`; `roundDown(m: number, step: number): number`; `roundUp(m: number, step: number): number`.

- [ ] **Step 1: Write the failing test `src/domain/normalize.test.ts`**

Expected strings were verified against the real speaker and event titles (`Paweł Uchorczak`, `Emil Biliński`, event 39556 `Światło, które widzisz. …`).

```ts
import { describe, expect, it } from "vitest";
import { nameTokens, normalizeText } from "./normalize";

describe("normalizeText", () => {
  it("folds ł and Ł, which have no canonical decomposition", () => {
    expect(normalizeText("Paweł")).toBe("pawel");
    expect(normalizeText("ŁUKASZ")).toBe("lukasz");
  });

  it("strips every Polish diacritic and lowercases", () => {
    expect(normalizeText("Zażółć gęślą jaźń")).toBe("zazolc gesla jazn");
  });

  it("lets 'swiatlo' find 'Światło' as a substring of a real title", () => {
    const title = normalizeText("Światło, które widzisz. Oświetlenie LED w fotografii kreatywnej");
    expect(title).toBe("swiatlo, ktore widzisz. oswietlenie led w fotografii kreatywnej");
    expect(title.includes(normalizeText("swiatlo"))).toBe(true);
    expect(title.includes(normalizeText("Światło"))).toBe(true);
  });

  it("is idempotent", () => {
    const once = normalizeText("Radosław DŻODŻO Drozdowicz");
    expect(once).toBe("radoslaw dzodzo drozdowicz");
    expect(normalizeText(once)).toBe(once);
  });

  it("keeps punctuation and whitespace untouched", () => {
    expect(normalizeText("A - B  C")).toBe("a - b  c");
  });

  it("returns an empty string for an empty string", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("nameTokens", () => {
  it("returns the normalized word tokens as a set", () => {
    expect(nameTokens("Emil Biliński")).toEqual(new Set(["emil", "bilinski"]));
  });

  it("makes surname-first anchor text equal to the speaker name", () => {
    expect(nameTokens("Biliński Emil")).toEqual(nameTokens("Emil Biliński"));
  });

  it("splits on hyphens and keeps digit runs as tokens", () => {
    expect(nameTokens("Kutyła-Kupidura")).toEqual(new Set(["kutyla", "kupidura"]));
    expect(nameTokens("Sala wykładowa nr 1")).toEqual(new Set(["sala", "wykladowa", "nr", "1"]));
  });

  it("keeps every word of an anchor with a brand suffix", () => {
    expect(nameTokens("Wąs Mateusz MUSTACHE LENS")).toEqual(
      new Set(["was", "mateusz", "mustache", "lens"]),
    );
  });

  it("drops duplicate tokens because it is a set", () => {
    expect(nameTokens("Anna Anna")).toEqual(new Set(["anna"]));
  });

  it("returns an empty set for text without letters or digits", () => {
    expect(nameTokens(" - / ")).toEqual(new Set());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /Users/tom/Projects/conference-melt && npx vitest run src/domain/normalize.test.ts
```

Expected: 1 failed file, `Error: Failed to load url ./normalize (resolved id: ./normalize) in src/domain/normalize.test.ts. Does the file exist?`

- [ ] **Step 3: Create `src/domain/normalize.ts`**

Pure, DOM-free: the fetch script imports it under `tsconfig.node.json`.

```ts
/**
 * Folds text for matching (spec §5.4): ł→l and Ł→L first (they have no canonical
 * decomposition), then NFD, strip combining marks, lowercase. Shared by the fetch
 * script's speaker matching and the app's search.
 */
export function normalizeText(s: string): string {
  return s
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

const TOKEN = /\p{L}+|\p{N}+/gu;

/** Word tokens of the normalized text as a set, for order-insensitive name comparison. */
export function nameTokens(s: string): Set<string> {
  return new Set(normalizeText(s).match(TOKEN) ?? []);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/tom/Projects/conference-melt && npx vitest run src/domain/normalize.test.ts
```

Expected: `Tests 12 passed (12)`.

- [ ] **Step 5: Write the failing test `src/domain/time.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { hasStart, type Session, type TimedSession } from "../data/types";
import { makeSession } from "../test/fixtures/build";
import {
  POINT_MINUTES,
  durationLabel,
  formatRange,
  formatTime,
  isAllDay,
  isPoint,
  roundDown,
  roundUp,
  visualEnd,
} from "./time";

function timed(overrides: Partial<Session> = {}): TimedSession {
  const s = makeSession(overrides);
  if (!hasStart(s)) throw new Error("test session needs a start");
  return s;
}

describe("formatTime", () => {
  it("zero-pads hours and minutes", () => {
    expect(formatTime(545)).toBe("09:05");
    expect(formatTime(0)).toBe("00:00");
  });

  it("formats an evening time", () => {
    expect(formatTime(1170)).toBe("19:30");
  });
});

describe("formatRange", () => {
  it("joins start and end with an en dash", () => {
    expect(formatRange(545, 615)).toBe("09:05–10:15");
    expect(formatRange(545, 615)).toContain("–");
  });

  it("shows only the start when end is null", () => {
    expect(formatRange(570, null)).toBe("09:30");
  });
});

describe("durationLabel", () => {
  it("shows hours and minutes", () => {
    expect(durationLabel(545, 615)).toBe("1 h 10 min");
  });

  it("omits the minutes part for whole hours", () => {
    expect(durationLabel(540, 660)).toBe("2 h");
    expect(durationLabel(570, 930)).toBe("6 h");
  });

  it("shows only minutes under an hour", () => {
    expect(durationLabel(600, 645)).toBe("45 min");
  });

  it("is null when end is null", () => {
    expect(durationLabel(570, null)).toBeNull();
  });
});

describe("isAllDay", () => {
  it("reads the allDay flag, not the duration", () => {
    expect(isAllDay(makeSession({ allDay: true, start: 540, end: 1080, typeIds: [242] }))).toBe(true);
    expect(isAllDay(makeSession({ allDay: false, start: 540, end: 1080, typeIds: [5] }))).toBe(false);
  });
});

describe("isPoint", () => {
  it("is true for a start without an end", () => {
    expect(isPoint(makeSession({ start: 570, end: null }))).toBe(true);
  });

  it("is false for a range", () => {
    expect(isPoint(makeSession())).toBe(false);
  });

  it("is false without a start", () => {
    expect(isPoint(makeSession({ start: null, end: null }))).toBe(false);
  });
});

describe("visualEnd", () => {
  it("returns the end when present", () => {
    expect(visualEnd(timed({ start: 570, end: 645 }))).toBe(645);
  });

  it("extends a point session by POINT_MINUTES", () => {
    expect(POINT_MINUTES).toBe(20);
    expect(visualEnd(timed({ start: 570, end: null }))).toBe(590);
  });
});

describe("roundDown / roundUp", () => {
  it("rounds down to the step and leaves multiples alone", () => {
    expect(roundDown(575, 30)).toBe(570);
    expect(roundDown(570, 30)).toBe(570);
  });

  it("rounds up to the step and leaves multiples alone", () => {
    expect(roundUp(575, 30)).toBe(600);
    expect(roundUp(600, 30)).toBe(600);
  });

  it("works with a 15-minute step", () => {
    expect(roundDown(1174, 15)).toBe(1170);
    expect(roundUp(1171, 15)).toBe(1185);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
cd /Users/tom/Projects/conference-melt && npx vitest run src/domain/time.test.ts
```

Expected: 1 failed file, `Error: Failed to load url ./time (resolved id: ./time) in src/domain/time.test.ts. Does the file exist?`

- [ ] **Step 7: Create `src/domain/time.ts`**

```ts
import type { Session, TimedSession } from "../data/types";

/** Height, in minutes, given to a point session (start without end) for layout. */
export const POINT_MINUTES = 20;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Minutes since midnight to "HH:MM". */
export function formatTime(m: number): string {
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** "09:05–10:15" (en dash) or "09:05" when end is null. */
export function formatRange(start: number, end: number | null): string {
  return end === null ? formatTime(start) : `${formatTime(start)}–${formatTime(end)}`;
}

/** "1 h 10 min", "2 h" (no minutes part when the remainder is 0), "45 min"; null when end is null. */
export function durationLabel(start: number, end: number | null): string | null {
  if (end === null) return null;
  const total = end - start;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function isAllDay(s: Session): boolean {
  return s.allDay;
}

export function isPoint(s: Session): boolean {
  return s.start !== null && s.end === null;
}

/** End used for layout: the real end, or start + POINT_MINUTES for point sessions. */
export function visualEnd(s: TimedSession): number {
  return s.end ?? s.start + POINT_MINUTES;
}

export function roundDown(m: number, step: number): number {
  return Math.floor(m / step) * step;
}

export function roundUp(m: number, step: number): number {
  return Math.ceil(m / step) * step;
}
```

- [ ] **Step 8: Run the test to verify it passes**

```bash
cd /Users/tom/Projects/conference-melt && npx vitest run src/domain/time.test.ts
```

Expected: `Tests 17 passed (17)`.

- [ ] **Step 9: Write the failing test `src/domain/lookup.test.ts`**

Real cases: event 39549 carries types `[185, 3]` (Fotogra listed before Fotospacer, yet Fotospacer ranks higher), event 46493 carries `[242, 215]` (Ogólne before STREFA TELEOBIEKTYWÓW), event 46526 sits in locations `[308, 313]`. Term ids, slugs, names and counts below are the real ones.

```ts
import { describe, expect, it } from "vitest";
import type { Term } from "../data/types";
import { makeData, makeLocation, makeSession, makeSpeaker } from "../test/fixtures/build";
import {
  TYPE_PRIORITY,
  buildIndex,
  locationLabel,
  locationsOf,
  primaryType,
  speakersOf,
  typeRank,
} from "./lookup";

const EXTRA_TYPES: Term[] = [
  { id: 3, slug: "fotospacer", name: "Fotospacer", count: 5 },
  { id: 185, slug: "fotogra", name: "Fotogra", count: 5 },
  { id: 214, slug: "dzialania-w-strefie-sprzetu", name: "DZIAŁANIA W STREFIE SPRZĘTU", count: 59 },
  { id: 215, slug: "strefa-teleobiektywow", name: "STREFA TELEOBIEKTYWÓW", count: 1 },
  { id: 314, slug: "playground", name: "PLAYGROUND", count: 8 },
  { id: 142, slug: "streaming", name: "Streaming", count: 0 },
  { id: 143, slug: "inne", name: "Inne", count: 0 },
];

describe("buildIndex", () => {
  const a = makeSession({ eventId: 1, day: "pt" });
  const b = makeSession({ eventId: 2, day: "sob", start: 600, end: 660 });
  const c = makeSession({ eventId: 2, day: "pt", start: 600, end: 660 });
  const speaker = makeSpeaker({ id: 134, slug: "emil-bilinski-x", name: "Emil Biliński" });
  const data = makeData([a, b, c], {
    speakers: [speaker],
    themes: [{ id: 7, slug: "portret", name: "Portret", count: 3 }],
    brands: [{ id: 9, slug: "sony", name: "Sony", count: 4 }],
  });
  const index = buildIndex(data);

  it("maps sessions by id and collects the id set", () => {
    expect(index.sessionById.get("2:sob")).toBe(b);
    expect(index.sessionById.get("2:pt")).toBe(c);
    expect(index.sessionIds).toEqual(new Set(["1:pt", "2:sob", "2:pt"]));
  });

  it("groups sessions by day in data order, with an entry for every day", () => {
    expect(index.sessionsByDay.get("pt")).toEqual([a, c]);
    expect(index.sessionsByDay.get("sob")).toEqual([b]);
    expect(index.sessionsByDay.get("czw")).toEqual([]);
  });

  it("maps types, themes, brands, locations, speakers and days by id", () => {
    expect(index.typeById.get(184)?.name).toBe("Prelekcja");
    expect(index.themeById.get(7)?.name).toBe("Portret");
    expect(index.brandById.get(9)?.name).toBe("Sony");
    expect(index.locationById.get(233)?.short).toBe("Sala wykł. 1");
    expect(index.speakerById.get(134)).toBe(speaker);
    expect(index.dayById.get("sob")?.date).toBe("2026-09-05");
  });

  it("works on empty data", () => {
    const empty = buildIndex(makeData([]));
    expect(empty.sessionIds.size).toBe(0);
    expect(empty.sessionsByDay.get("pt")).toEqual([]);
    expect(empty.speakerById.size).toBe(0);
  });
});

describe("TYPE_PRIORITY and typeRank", () => {
  it("lists the nine types in spec §7.2 order", () => {
    expect(TYPE_PRIORITY).toEqual([
      "Prelekcja",
      "Prelekcja z sesją",
      "Warsztaty",
      "Fotospacer",
      "Fotogra",
      "PLAYGROUND",
      "DZIAŁANIA W STREFIE SPRZĘTU",
      "STREFA TELEOBIEKTYWÓW",
      "Ogólne",
    ]);
  });

  it("ranks listed types by position and unlisted types after all of them", () => {
    expect(typeRank("Prelekcja")).toBe(0);
    expect(typeRank("Prelekcja z sesją")).toBe(1);
    expect(typeRank("Ogólne")).toBe(8);
    expect(typeRank("Streaming")).toBe(9);
    expect(typeRank("")).toBe(9);
  });
});

describe("primaryType", () => {
  const base = makeData([]);
  const index = buildIndex({ ...base, types: [...base.types, ...EXTRA_TYPES] });

  it("returns the only type of a single-type session", () => {
    expect(primaryType(makeSession({ typeIds: [184] }), index)?.id).toBe(184);
  });

  it("prefers Fotospacer over Fotogra regardless of typeIds order (event 39549)", () => {
    expect(primaryType(makeSession({ typeIds: [185, 3] }), index)?.name).toBe("Fotospacer");
    expect(primaryType(makeSession({ typeIds: [3, 185] }), index)?.name).toBe("Fotospacer");
  });

  it("prefers STREFA TELEOBIEKTYWÓW over Ogólne (event 46493)", () => {
    expect(primaryType(makeSession({ typeIds: [242, 215] }), index)?.id).toBe(215);
  });

  it("prefers any listed type over an unlisted one", () => {
    expect(primaryType(makeSession({ typeIds: [143, 242] }), index)?.name).toBe("Ogólne");
  });

  it("orders unlisted types by name with Polish collation", () => {
    expect(primaryType(makeSession({ typeIds: [142, 143] }), index)?.name).toBe("Inne");
  });

  it("skips unknown type ids", () => {
    expect(primaryType(makeSession({ typeIds: [999, 184] }), index)?.id).toBe(184);
  });

  it("returns null when no type id is known", () => {
    expect(primaryType(makeSession({ typeIds: [999] }), index)).toBeNull();
    expect(primaryType(makeSession({ typeIds: [] }), index)).toBeNull();
  });
});

describe("locationsOf and locationLabel", () => {
  const playground = makeLocation({
    id: 313,
    slug: "stoiska-wystawcow-poziom-ii-sosalsa-playground",
    name: "Stoiska wystawców - poziom II (SOSALSA) - Playground",
    count: 8,
    venue: "Stoiska wystawców",
    level: "II",
    room: "SOSALSA · Playground",
    short: "Stoiska · Playground",
    order: 4,
  });
  const base = makeData([]);
  const index = buildIndex({ ...base, locations: [...base.locations, playground] });

  it("returns locations in locationIds order (event 46526)", () => {
    const s = makeSession({ locationIds: [308, 313] });
    expect(locationsOf(s, index).map((l) => l.id)).toEqual([308, 313]);
    expect(locationLabel(s, index)).toBe("Stoiska · Plenum / Stoiska · Playground");
  });

  it("keeps the session's own order even when it differs from Location.order", () => {
    const s = makeSession({ locationIds: [313, 308] });
    expect(locationsOf(s, index).map((l) => l.id)).toEqual([313, 308]);
    expect(locationLabel(s, index)).toBe("Stoiska · Playground / Stoiska · Plenum");
  });

  it("uses the short label of a single location", () => {
    expect(locationLabel(makeSession({ locationIds: [233] }), index)).toBe("Sala wykł. 1");
  });

  it("skips unknown ids and gives an empty label without locations", () => {
    expect(locationsOf(makeSession({ locationIds: [999] }), index)).toEqual([]);
    expect(locationLabel(makeSession({ locationIds: [999] }), index)).toBe("");
    expect(locationLabel(makeSession({ locationIds: [] }), index)).toBe("");
  });
});

describe("speakersOf", () => {
  const emil = makeSpeaker({ id: 134, slug: "emil-bilinski-x", name: "Emil Biliński" });
  const karol = makeSpeaker({ id: 128, slug: "karol-bartnik-2", name: "Karol Bartnik" });
  const index = buildIndex(makeData([], { speakers: [emil, karol] }));

  it("returns speakers in speakerIds order", () => {
    expect(speakersOf(makeSession({ speakerIds: [128, 134] }), index)).toEqual([karol, emil]);
  });

  it("skips unknown ids", () => {
    expect(speakersOf(makeSession({ speakerIds: [1, 134] }), index)).toEqual([emil]);
  });

  it("returns an empty list for a session without speakers", () => {
    expect(speakersOf(makeSession(), index)).toEqual([]);
  });
});
```

- [ ] **Step 10: Run the test to verify it fails**

```bash
cd /Users/tom/Projects/conference-melt && npx vitest run src/domain/lookup.test.ts
```

Expected: 1 failed file, `Error: Failed to load url ./lookup (resolved id: ./lookup) in src/domain/lookup.test.ts. Does the file exist?`

- [ ] **Step 11: Create `src/domain/lookup.ts`**

`compareTypes` is internal (used only here); other modules that need "priority order, then Polish collation" combine the exported `typeRank` with their own `Intl.Collator("pl")`.

```ts
import type { Day, Location, ScheduleData, Session, Speaker, Term } from "../data/types";

export interface DataIndex {
  sessionById: Map<string, Session>;
  sessionIds: Set<string>;
  speakerById: Map<number, Speaker>;
  locationById: Map<number, Location>;
  typeById: Map<number, Term>;
  themeById: Map<number, Term>;
  brandById: Map<number, Term>;
  dayById: Map<string, Day>;
  sessionsByDay: Map<string, Session[]>;
}

function byId<T extends { id: number }>(items: T[]): Map<number, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/** Builds every lookup map once per data load. Every day in `data.days` gets a `sessionsByDay` entry, possibly empty. */
export function buildIndex(data: ScheduleData): DataIndex {
  const sessionsByDay = new Map<string, Session[]>(data.days.map((d) => [d.id, []]));
  for (const s of data.sessions) {
    const list = sessionsByDay.get(s.day);
    if (list) {
      list.push(s);
    } else {
      sessionsByDay.set(s.day, [s]);
    }
  }
  return {
    sessionById: new Map(data.sessions.map((s) => [s.id, s])),
    sessionIds: new Set(data.sessions.map((s) => s.id)),
    speakerById: byId(data.speakers),
    locationById: byId(data.locations),
    typeById: byId(data.types),
    themeById: byId(data.themes),
    brandById: byId(data.brands),
    dayById: new Map(data.days.map((d) => [d.id, d])),
    sessionsByDay,
  };
}

/** Type priority for the primary type and the `type` column axis (spec §7.2). */
export const TYPE_PRIORITY: string[] = [
  "Prelekcja",
  "Prelekcja z sesją",
  "Warsztaty",
  "Fotospacer",
  "Fotogra",
  "PLAYGROUND",
  "DZIAŁANIA W STREFIE SPRZĘTU",
  "STREFA TELEOBIEKTYWÓW",
  "Ogólne",
];

/** Position in TYPE_PRIORITY; unlisted types rank after every listed one. */
export function typeRank(name: string): number {
  const i = TYPE_PRIORITY.indexOf(name);
  return i === -1 ? TYPE_PRIORITY.length : i;
}

const collator = new Intl.Collator("pl");

function compareTypes(a: Term, b: Term): number {
  const byRank = typeRank(a.name) - typeRank(b.name);
  return byRank !== 0 ? byRank : collator.compare(a.name, b.name);
}

/** The session's first type in TYPE_PRIORITY order; among unlisted types the first by Polish collation. Null when no type id is known. */
export function primaryType(s: Session, index: DataIndex): Term | null {
  let best: Term | null = null;
  for (const id of s.typeIds) {
    const term = index.typeById.get(id);
    if (!term) continue;
    if (best === null || compareTypes(term, best) < 0) best = term;
  }
  return best;
}

/** Known locations of a session, in `locationIds` order. */
export function locationsOf(s: Session, index: DataIndex): Location[] {
  return s.locationIds.flatMap((id) => {
    const location = index.locationById.get(id);
    return location ? [location] : [];
  });
}

/** Known speakers of a session, in `speakerIds` order. */
export function speakersOf(s: Session, index: DataIndex): Speaker[] {
  return s.speakerIds.flatMap((id) => {
    const speaker = index.speakerById.get(id);
    return speaker ? [speaker] : [];
  });
}

/** Location shorts joined by " / "; empty string when the session has no known location. */
export function locationLabel(s: Session, index: DataIndex): string {
  return locationsOf(s, index)
    .map((l) => l.short)
    .join(" / ");
}
```

- [ ] **Step 12: Run the test to verify it passes**

```bash
cd /Users/tom/Projects/conference-melt && npx vitest run src/domain/lookup.test.ts
```

Expected: `Tests 20 passed (20)`.

- [ ] **Step 13: Run the three domain files together, typecheck, then the whole suite**

```bash
cd /Users/tom/Projects/conference-melt && npx vitest run src/domain && npm run typecheck && npm test
```

Expected: `Test Files 3 passed (3)` for the domain run; both `tsc` invocations exit 0 (the `tsconfig.node.json` pass also type-checks `src/domain/normalize.ts` and `src/data/types.ts` without DOM types, which they must keep passing); the full suite reports 4 passed files (`App`, `normalize`, `time`, `lookup`).

- [ ] **Step 14: Commit**

```bash
cd /Users/tom/Projects/conference-melt && git add -A && git commit -m "feat(domain): add normalize, lookup and time modules" -m "normalizeText folds ł/Ł, strips diacritics and lowercases; nameTokens gives order-insensitive name comparison for speaker matching. lookup builds the DataIndex maps and resolves the primary type by the spec §7.2 priority order, plus locationsOf, speakersOf and locationLabel. time formats times and ranges, builds duration labels, detects point and all-day sessions and provides visualEnd with POINT_MINUTES = 20 and the half-hour rounding helpers.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```


### Task 3: HTML sanitizer and entity helpers (`scripts/lib/sanitize.ts`)

**Files:**
- Create: `scripts/lib/sanitize.ts`
- Test: `scripts/__tests__/sanitize.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks beyond the Vitest setup (`npx vitest run` must already work and `scripts/__tests__/*.test.ts` must run in the `node` environment). No runtime dependencies: the sanitizer is a hand-written tokenizer, not a DOM or a library.
- Produces (contract "Fetch script lib signatures", `sanitize.ts`):
  - `decodeEntities(s: string): string` — decodes `&#NNNN;`, `&#xHHHH;` and the named entities `amp lt gt quot apos nbsp ndash mdash hellip laquo raquo bdquo ldquo rdquo lsquo rsquo copy reg trade euro times deg middot` exactly once; unknown entities stay verbatim.
  - `stripTags(html: string): string` — WordPress comments removed, every tag replaced by one space, entities decoded, whitespace (including `&nbsp;`) collapsed to single spaces, trimmed.
  - `isBlankHtml(html: string): boolean` — `stripTags(html) === ""`.
  - `sanitizeHtml(html: string): string` — spec §4.3 allowlist rewriter. Output is canonical: allowed tags are lowercase with no attributes (except `href`, `target`, `rel` on `a`), tags are balanced (unclosed tags are closed at the end, stray closers dropped), blank paragraphs are removed, and top-level whitespace between blocks is collapsed to one `\n`.
  - `bioHtml(html: string): string` — `sanitizeHtml` plus spec §4.2 "Speakers": every remaining `<p>` whose decoded text matches `/^\s*[-–—][\s\-–—]*$/` becomes `<hr>`.
  - Task 4 imports `decodeEntities`, `stripTags`, `isBlankHtml`; the normalizer (later task) uses `decodeEntities` for titles and names, `sanitizeHtml` for `descriptionHtml` and `bioHtml` for `Speaker.bioHtml`.

Design notes for the implementer: the rewriter scans the input with one tag regex whose attribute part tolerates `>` inside quoted values, keeps a stack of open allowed tags so the output is always balanced, decodes each text node once and re-escapes `&`, `<`, `>`. The tag `<a>` is kept even without a valid `href` (spec §4.3 drops the attribute, not the element). Blank-paragraph removal runs on the rewritten output, so `bioHtml` sees `<p>` with no attributes and `<p> </p>` (speaker 46683) is already gone before the dash rule runs.

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/sanitize.test.ts` with this content. Every "speaker NNNN" constant is a verbatim excerpt of `content.rendered` from the 2026-09-03 `cyfrowe-prelegent` snapshot.

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { bioHtml, decodeEntities, isBlankHtml, sanitizeHtml, stripTags } from "../lib/sanitize";

// Excerpts of speaker content from the 2026-09-03 WordPress snapshot (cyfrowe-prelegent, _embed).

// Speaker 46683 (Maciej Szamałek): a literal "<p> </p>" between two real paragraphs.
const SPEAKER_46683_EXCERPT =
  "<p><strong>KONSULTACJE</strong><br>Pochwal się swoimi odlotowymi fotografiami, skonsultuj technikę, dowiedz się jak ulepszyć swój warsztat i spędź dobrze czas, bujając w obłokach fotografii lotniczej na stoisku Sony!</p>\n\n\n\n<p> </p>\n\n\n\n<p></p>\n\n\n\n<p><strong>Piątek (04-09-2026)</strong></p>";

// Speaker 537 (Adrian Truchta): dash paragraph ending in a hyphen, a heading, a list, a blank paragraph.
const SPEAKER_537_TAIL =
  "<p>&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;-</p>\n\n\n\n<p><strong>Piątek (04-09-2026)</strong></p>\n\n\n\n<ul class=\"wp-block-list\">\n<li><strong>14:00 – 15:00</strong> | <em>Mini&amp;max. Pokaz makro na stoisku</em> | DZIAŁANIE W STREFIE | Marka: OM System | Miejsce: Stoiska wystawców &#8211; poziom I (PLENUM)</li>\n</ul>\n\n\n\n<p></p>\n";
const SPEAKER_537_TAIL_SANITIZED =
  "<p>——————————-</p>\n<p><strong>Piątek (04-09-2026)</strong></p>\n<ul>\n<li><strong>14:00 – 15:00</strong> | <em>Mini&amp;max. Pokaz makro na stoisku</em> | DZIAŁANIE W STREFIE | Marka: OM System | Miejsce: Stoiska wystawców – poziom I (PLENUM)</li>\n</ul>";

// Speaker 46608 (Magdalena Kozłowicz): blank paragraph, then dashes ending in an en dash.
const SPEAKER_46608_DASHES = "<p></p>\n\n\n\n<p>&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8211;</p>";
// Speaker 341 (Grzegorz Maciąg): dashes with a trailing <br>.
const SPEAKER_341_DASHES = "<p>&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;-<br></p>";
// Speaker 46694 (Paweł Uchorczak): em dashes only.
const SPEAKER_46694_DASHES = "<p>&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;&#8212;</p>";

// Speaker 46702 (Tomasz ZIENIU Zienkiewicz): links with data attributes and &amp; inside a href.
const SPEAKER_46702_LINKS =
  "<p>Strona: <a href=\"http://zieniu.pl\" data-type=\"link\" data-id=\"zieniu.pl\" target=\"_blank\" rel=\"noreferrer noopener\">zieniu.pl</a><br>Kursy fotograficzne: <a href=\"https://www.cyfrowe.pl/fotografia/kursy-i-szkolenia?facets%5Bproducer%5D%5B%5D=ZIENIU&amp;price%5Bmin_price%5D=&amp;price%5Bmax_price%5D=&amp;name=\" data-type=\"link\" data-id=\"https://www.cyfrowe.pl/fotografia/kursy-i-szkolenia?facets%5Bproducer%5D%5B%5D=ZIENIU&amp;price%5Bmin_price%5D=&amp;price%5Bmax_price%5D=&amp;name=\" target=\"_blank\" rel=\"noreferrer noopener\">dostępne w cyfrowe.pl</a></p>";

// Speaker 46619 (Olek LEYDO FILM Leydo): a YouTube embed block followed by a blank paragraph.
const SPEAKER_46619_EMBED =
  "<figure class=\"wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube wp-embed-aspect-16-9 wp-has-aspect-ratio\"><div class=\"wp-block-embed__wrapper\">\n<iframe loading=\"lazy\" title=\"ADV   Leydo Film   Peak Design   Boliwia\" width=\"500\" height=\"281\" src=\"https://www.youtube.com/embed/vY2jeEnPpEg?feature=oembed\" frameborder=\"0\" allow=\"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\" referrerpolicy=\"strict-origin-when-cross-origin\" allowfullscreen></iframe>\n</div></figure>\n\n\n\n<p></p>\n";

// Speaker 46691 (Tomasz Tołłoczko): an empty <sup></sup> in the middle of a word.
const SPEAKER_46691_SUP = "<p>Studia z historii sztuki pozwol<sup></sup>iły Tomaszowi opisywać dzieła sztuki</p>";

describe("decodeEntities", () => {
  it("decodes the numeric entities used by WordPress", () => {
    expect(decodeEntities("&#8211;")).toBe("–");
    expect(decodeEntities("&#8212;")).toBe("—");
    expect(decodeEntities("&#8222;cytat&#8221;")).toBe("„cytat”");
    expect(decodeEntities("&#8230;")).toBe("…");
    expect(decodeEntities("&#8217;")).toBe("’");
    expect(decodeEntities("&#215;")).toBe("×");
    expect(decodeEntities("&#x2013;")).toBe("–");
  });

  it("decodes the named entities nbsp and amp", () => {
    expect(decodeEntities("a&nbsp;b")).toBe("a b");
    expect(decodeEntities("&amp;")).toBe("&");
    expect(decodeEntities("&lt;b&gt;")).toBe("<b>");
  });

  it("decodes a real event title (46549)", () => {
    expect(decodeEntities("Analog na czasie &#8211; tips&amp;tricks domowej ciemni")).toBe(
      "Analog na czasie – tips&tricks domowej ciemni",
    );
  });

  it("decodes exactly once", () => {
    expect(decodeEntities("&amp;#8211;")).toBe("&#8211;");
    expect(decodeEntities("&amp;amp;")).toBe("&amp;");
  });

  it("leaves unknown or malformed entities untouched", () => {
    expect(decodeEntities("&bogus; &#; &# 12; & co")).toBe("&bogus; &#; &# 12; & co");
  });
});

describe("stripTags", () => {
  it("replaces tags with a space, decodes and collapses whitespace", () => {
    expect(stripTags("fotografii<br>lotnictwa")).toBe("fotografii lotnictwa");
    expect(stripTags("<p>Mini&amp;max.&nbsp;Pokaz</p>")).toBe("Mini&max. Pokaz");
    expect(stripTags("  <p> a </p>\n<p>b</p> ")).toBe("a b");
  });

  it("keeps anchor text and drops WordPress block comments", () => {
    expect(stripTags('<!-- wp:paragraph --><p>17:00-19:00, Sony <a href="https://www.cyfrowe.pl/x.html">Zapisz się</a></p><!-- /wp:paragraph -->')).toBe(
      "17:00-19:00, Sony Zapisz się",
    );
  });

  it("tolerates a > inside a quoted attribute", () => {
    expect(stripTags('<a href="https://a.pl/?q=a>b" title="x">t</a>')).toBe("t");
  });
});

describe("isBlankHtml", () => {
  it("treats empty, whitespace, nbsp and <br>-only content as blank", () => {
    expect(isBlankHtml("")).toBe(true);
    expect(isBlankHtml("<p></p>")).toBe(true);
    expect(isBlankHtml("<p> </p>")).toBe(true);
    expect(isBlankHtml("&nbsp;")).toBe(true);
    expect(isBlankHtml("<br>")).toBe(true);
    expect(isBlankHtml("\n\n")).toBe(true);
  });

  it("treats text and dashes as content", () => {
    expect(isBlankHtml("<p>a</p>")).toBe(false);
    expect(isBlankHtml("<p>&#8212;</p>")).toBe(false);
  });
});

describe("sanitizeHtml allowlist", () => {
  it("keeps p, br, strong, b, em, i, ul, ol, li, a and hr without attributes", () => {
    expect(sanitizeHtml('<ol start="3" class="x"><li><b>x</b> <i>y</i></li></ol><hr/>')).toBe("<ol><li><b>x</b> <i>y</i></li></ol><hr>");
    expect(sanitizeHtml("<p>a<br/>b<br>c</p>")).toBe("<p>a<br>b<br>c</p>");
    expect(sanitizeHtml('<ul class="wp-block-list">\n<li><strong>a</strong> <em>b</em></li>\n</ul>')).toBe("<ul>\n<li><strong>a</strong> <em>b</em></li>\n</ul>");
  });

  it("removes other tags but keeps their text", () => {
    expect(sanitizeHtml(SPEAKER_46691_SUP)).toBe("<p>Studia z historii sztuki pozwoliły Tomaszowi opisywać dzieła sztuki</p>");
    expect(sanitizeHtml('<p><span style="color:red">a</span> <img src="x.jpg" onerror="e()"> b</p>')).toBe("<p>a  b</p>");
  });

  it("removes a YouTube embed block entirely", () => {
    expect(sanitizeHtml(SPEAKER_46619_EMBED)).toBe("");
  });

  it("removes WordPress block comments", () => {
    expect(sanitizeHtml('<!-- wp:paragraph -->\n<p class="x" style="color:red">Hej</p>\n<!-- /wp:paragraph -->')).toBe("<p>Hej</p>");
  });

  it("lowercases tag names", () => {
    expect(sanitizeHtml("<P><STRONG>a</STRONG></P>")).toBe("<p><strong>a</strong></p>");
  });
});

describe("sanitizeHtml anchors", () => {
  it("keeps http(s) hrefs, drops every other attribute and adds target and rel", () => {
    expect(sanitizeHtml(SPEAKER_46702_LINKS)).toBe(
      "<p>Strona: <a href=\"http://zieniu.pl\" target=\"_blank\" rel=\"noopener noreferrer\">zieniu.pl</a><br>Kursy fotograficzne: <a href=\"https://www.cyfrowe.pl/fotografia/kursy-i-szkolenia?facets%5Bproducer%5D%5B%5D=ZIENIU&amp;price%5Bmin_price%5D=&amp;price%5Bmax_price%5D=&amp;name=\" target=\"_blank\" rel=\"noopener noreferrer\">dostępne w cyfrowe.pl</a></p>",
    );
  });

  it("drops javascript:, relative and mailto: hrefs but keeps the anchor text", () => {
    expect(sanitizeHtml('<p><a href="javascript:alert(1)" onclick="x()">klik</a> <a href="/o-nas">tu</a> <a href=\'mailto:a@b.pl\'>mail</a></p>')).toBe(
      '<p><a target="_blank" rel="noopener noreferrer">klik</a> <a target="_blank" rel="noopener noreferrer">tu</a> <a target="_blank" rel="noopener noreferrer">mail</a></p>',
    );
  });

  it("escapes quotes and angle brackets inside a kept href", () => {
    expect(sanitizeHtml('<p><a href="https://a.pl/?q=a>b&x=\'1\'" title="x">t</a></p>')).toBe(
      "<p><a href=\"https://a.pl/?q=a&gt;b&amp;x='1'\" target=\"_blank\" rel=\"noopener noreferrer\">t</a></p>",
    );
  });
});

describe("sanitizeHtml text nodes", () => {
  it("decodes entities once and re-escapes <, > and &", () => {
    expect(sanitizeHtml("<p>1 &lt; 2 &amp;&amp; 3 &gt; 2, a < b</p>")).toBe("<p>1 &lt; 2 &amp;&amp; 3 &gt; 2, a &lt; b</p>");
    expect(sanitizeHtml("<p>&amp;#8211; zostaje literalnie</p>")).toBe("<p>&amp;#8211; zostaje literalnie</p>");
    expect(sanitizeHtml("<p>Mini&amp;max &#8211; „test&#8221;</p>")).toBe("<p>Mini&amp;max – „test”</p>");
  });

  it("closes unclosed tags and drops stray closing tags", () => {
    expect(sanitizeHtml("<p><strong>a</p><em>b")).toBe("<p><strong>a</strong></p><em>b</em>");
    expect(sanitizeHtml("<p>a</em> b</p>")).toBe("<p>a b</p>");
  });
});

describe("sanitizeHtml blank paragraphs", () => {
  it("removes the whitespace-only paragraph of speaker 46683 and the empty one after it", () => {
    expect(sanitizeHtml(SPEAKER_46683_EXCERPT)).toBe(
      "<p><strong>KONSULTACJE</strong><br>Pochwal się swoimi odlotowymi fotografiami, skonsultuj technikę, dowiedz się jak ulepszyć swój warsztat i spędź dobrze czas, bujając w obłokach fotografii lotniczej na stoisku Sony!</p>\n<p><strong>Piątek (04-09-2026)</strong></p>",
    );
  });

  it("removes empty, nbsp-only, br-only and whitespace-only paragraphs", () => {
    expect(sanitizeHtml("<p></p><p>&nbsp;</p><p><br></p><p> \n </p><p>x</p>")).toBe("<p>x</p>");
  });

  it("collapses the blank lines WordPress puts between blocks to one newline", () => {
    expect(sanitizeHtml("\n<p>a</p>\n\n\n\n<p>b</p>\n")).toBe("<p>a</p>\n<p>b</p>");
    expect(sanitizeHtml(SPEAKER_537_TAIL)).toBe(SPEAKER_537_TAIL_SANITIZED);
  });
});

describe("bioHtml", () => {
  it("replaces dash-only paragraphs with <hr>", () => {
    expect(bioHtml(SPEAKER_46694_DASHES)).toBe("<hr>");
    expect(bioHtml("<p>-</p>")).toBe("<hr>");
    expect(bioHtml("<p>- - -</p>")).toBe("<hr>");
    expect(bioHtml("<p>&#8211;&#8212;-</p>")).toBe("<hr>");
  });

  it("replaces a dash paragraph ending in an en dash (speaker 46608)", () => {
    expect(bioHtml(SPEAKER_46608_DASHES)).toBe("<hr>");
  });

  it("replaces a dash paragraph with a trailing <br> (speaker 341)", () => {
    expect(bioHtml(SPEAKER_341_DASHES)).toBe("<hr>");
  });

  it("keeps paragraphs that contain text next to dashes", () => {
    expect(bioHtml("<p>&#8212; uwaga</p>")).toBe("<p>— uwaga</p>");
    expect(bioHtml("<p>Tomasz &#8211; fotograf</p>")).toBe("<p>Tomasz – fotograf</p>");
  });

  it("removes blank paragraphs before applying the rule, so they never become <hr>", () => {
    expect(bioHtml("<p></p>")).toBe("");
    expect(bioHtml("<p> </p>\n<p>&nbsp;</p>")).toBe("");
  });

  it("sanitizes and separates the tail of speaker 537", () => {
    expect(bioHtml(SPEAKER_537_TAIL)).toBe("<hr>" + SPEAKER_537_TAIL_SANITIZED.slice("<p>——————————-</p>".length));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/__tests__/sanitize.test.ts`

Expected: the run fails before any test executes with a module-resolution error such as `Error: Failed to resolve import "../lib/sanitize" from "scripts/__tests__/sanitize.test.ts". Does the file exist?` (0 tests passed).

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/sanitize.ts`:

```ts
/**
 * Dependency-free HTML helpers for the fetch script (spec §4.3).
 * Entities are decoded exactly once; text nodes are re-escaped on output.
 */

const NAMED_ENTITIES = new Map<string, string>([
  ["amp", "&"], ["lt", "<"], ["gt", ">"], ["quot", '"'], ["apos", "'"], ["nbsp", "\u00a0"],
  ["ndash", "–"], ["mdash", "—"], ["hellip", "…"], ["laquo", "«"], ["raquo", "»"],
  ["bdquo", "„"], ["ldquo", "“"], ["rdquo", "”"], ["lsquo", "‘"], ["rsquo", "’"],
  ["copy", "©"], ["reg", "®"], ["trade", "™"], ["euro", "€"], ["times", "×"],
  ["deg", "°"], ["middot", "·"],
]);

const COMMENT_RE = /<!--[\s\S]*?-->/g;
// A tag: "<", optional "/", a name, then attributes where quoted values may contain ">".
const TAG_RE = /<\/?[a-zA-Z][a-zA-Z0-9]*(?:"[^"]*"|'[^']*'|[^>"'])*>/g;
const HREF_RE = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

const ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "ul", "ol", "li", "a", "hr"]);
const VOID_TAGS = new Set(["br", "hr"]);
const DASH_PARAGRAPH_RE = /^\s*[-–—][\s\-–—]*$/;

export function decodeEntities(s: string): string {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole: string, body: string) => {
    if (body.startsWith("#")) {
      const hex = body[1] === "x" || body[1] === "X";
      const code = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES.get(body.toLowerCase()) ?? whole;
  });
}

export function stripTags(html: string): string {
  const text = html.replace(COMMENT_RE, "").replace(TAG_RE, " ");
  return decodeEntities(text).replace(/\s+/g, " ").trim();
}

export function isBlankHtml(html: string): boolean {
  return stripTags(html) === "";
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}

function openingTag(name: string, attrs: string): string {
  if (name !== "a") return `<${name}>`;
  const m = HREF_RE.exec(attrs);
  const href = m ? decodeEntities(m[1] ?? m[2] ?? m[3] ?? "").trim() : "";
  const keepHref = /^https?:\/\//i.test(href);
  return keepHref
    ? `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">`
    : `<a target="_blank" rel="noopener noreferrer">`;
}

function dropBlankParagraphs(html: string): string {
  return html.replace(/<p>([\s\S]*?)<\/p>/g, (whole: string, inner: string) => (isBlankHtml(inner) ? "" : whole));
}

export function sanitizeHtml(html: string): string {
  const src = html.replace(COMMENT_RE, "");
  const tokenRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  const out: string[] = [];
  const open: string[] = [];
  let last = 0;

  const emitText = (raw: string): void => {
    if (raw === "") return;
    if (open.length === 0 && raw.trim() === "") {
      out.push("\n");
      return;
    }
    out.push(escapeText(decodeEntities(raw)));
  };

  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(src)) !== null) {
    emitText(src.slice(last, m.index));
    last = m.index + m[0].length;
    const closing = m[1] === "/";
    const name = (m[2] ?? "").toLowerCase();
    const attrs = m[3] ?? "";
    if (!ALLOWED_TAGS.has(name)) continue;
    if (VOID_TAGS.has(name)) {
      if (!closing) out.push(`<${name}>`);
      continue;
    }
    if (closing) {
      const at = open.lastIndexOf(name);
      if (at === -1) continue;
      while (open.length > at) out.push(`</${open.pop() ?? ""}>`);
      continue;
    }
    out.push(openingTag(name, attrs));
    open.push(name);
  }
  emitText(src.slice(last));
  while (open.length > 0) out.push(`</${open.pop() ?? ""}>`);

  return dropBlankParagraphs(out.join("")).replace(/\n{2,}/g, "\n").trim();
}

export function bioHtml(html: string): string {
  return sanitizeHtml(html).replace(/<p>([\s\S]*?)<\/p>/g, (whole: string, inner: string) =>
    DASH_PARAGRAPH_RE.test(stripTags(inner)) ? "<hr>" : whole,
  );
}
```

- [ ] **Step 4: Run the tests and the typecheck to verify they pass**

Run: `npx vitest run scripts/__tests__/sanitize.test.ts`

Expected: `Test Files 1 passed`, `Tests 29 passed`, 0 failed.

Run: `npm run typecheck`

Expected: no errors (`scripts/**` is covered by `tsconfig.node.json`).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/sanitize.ts scripts/__tests__/sanitize.test.ts
git commit -F - <<'EOF_COMMIT'
feat(scripts): add dependency-free HTML sanitizer for bios

Adds decodeEntities, stripTags, isBlankHtml, sanitizeHtml (spec 4.3
allowlist rewriter) and bioHtml (dash-only paragraphs become <hr>),
tested against real speaker content excerpts.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2
EOF_COMMIT
```

---

### Task 4: Event content and taxonomy parsing (`scripts/lib/parse.ts`)

**Files:**
- Create: `scripts/lib/parse.ts`
- Test: `scripts/__tests__/parse.test.ts`

**Interfaces:**
- Consumes:
  - from Task 3 (`scripts/lib/sanitize.ts`): `decodeEntities(s: string): string`, `stripTags(html: string): string`, `isBlankHtml(html: string): boolean`.
  - from `src/data/types.ts` (contract, created by the setup tasks): `type SignupStatus = "open" | "full" | "included" | "free" | "soon" | "unknown"` (type-only import).
- Produces (contract "Fetch script lib signatures", `parse.ts`):
  - `paragraphs(html: string): string[]` — inner HTML of every `<p>` in order, WordPress block comments removed first.
  - `firstParagraph(html: string): string` — first paragraph with `!isBlankHtml(p)`, `""` when none.
  - `interface ParsedTime { start: number | null; end: number | null; timeText: string; endDiscarded: boolean }` and `parseTime(text: string): ParsedTime` — spec §4.2 "Time" regex on the *stripped* first paragraph; minutes since midnight; hours 0–23 and minutes 0–59 else everything is null with `timeText: ""`; `end <= start` discards the end and sets `endDiscarded: true`; `timeText` is the regex match verbatim.
  - `interface Anchor { href: string; text: string; dataType: string | null; dataId: string | null; host: string }` and `extractAnchors(html: string): Anchor[]` — every `<a>` in document order; `text` is `stripTags` of the inner HTML; `href`, `data-type`, `data-id` are entity-decoded attribute values (`href` is `""` when absent); `host` is the lowercase hostname or `""` when the href is not an absolute URL.
  - `isSiteHost(host: string): boolean` — `swiatlosila.pl` or `www.swiatlosila.pl`, case-insensitive. The normalizer classifies anchors with it: site host → speaker anchor, anything else → the signup anchor (first one wins).
  - `parseByline(text: string, timeText: string, removeTexts: string[]): string | null` — call it as `parseByline(stripTags(firstParagraph), parsed.timeText, [signupAnchor?.text, ...resolvedSpeakerAnchorTexts])`; unresolved speaker anchors are *not* passed so their text stays in the byline (spec §4.2).
  - `signupStatusFromTerm(name: string | undefined): SignupStatus` — exact term-name map; `undefined` or anything else → `"unknown"`.
  - `interface ParsedDay { id: string; label: string; short: string; labelLong: string; date: string }` and `parseDay(termName: string, year: number): ParsedDay | null`.
  - `isAllDayEvent(start: number | null, end: number | null, typeSlugs: string[]): boolean` — the caller maps `typeIds` to term slugs; true when `end - start >= 300` and `"ogolne"` is among the slugs.

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/parse.test.ts`. The `P_NNNNN` constants are the verbatim inner HTML of the first `<p>` of those events in the 2026-09-03 snapshot (`CONTENT_*` are complete `content.rendered` values); do not "tidy" them.

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  extractAnchors,
  firstParagraph,
  isAllDayEvent,
  isSiteHost,
  paragraphs,
  parseByline,
  parseDay,
  parseTime,
  signupStatusFromTerm,
} from "../lib/parse";
import { stripTags } from "../lib/sanitize";

// Inner HTML of the first paragraph of real events (2026-09-03 snapshot, cyfrowe-event).
const P_39549 =
  '17:00-19:00, Sony <a href="https://www.cyfrowe.pl/swiatlosila-fotogra-before-fotospacer-colour-hunting-z-sony-p.html" data-type="link" data-id="https://www.cyfrowe.pl/swiatlosila-fotogra-before-fotospacer-colour-hunting-z-sony-p.html" target="_blank" rel="noreferrer noopener">Zapisz się</a>';
const P_39565 = "13:30, Cyfrowe.pl";
const P_34237 = "19:30";
const P_33705 = "09:30";
const P_46438 =
  '09:15-18:15, <a href="https://swiatlosila.pl/cyfrowe-prelegent/paulina-szmidtka/" target="_blank" rel="noreferrer noopener">Szmidtka Paulina</a> <a href="https://www.cyfrowe.pl/swiatlosila-jeden-na-jeden-mentor-paulina-szmidtka-modelka-adrianna-kusiak-p.html" data-type="link" data-id="https://www.cyfrowe.pl/swiatlosila-jeden-na-jeden-mentor-paulina-szmidtka-modelka-adrianna-kusiak-p.html" target="_blank" rel="noreferrer noopener">Brak miejsc</a>';
const P_46498 =
  '09:30-11:30, <a href="https://swiatlosila.pl/cyfrowe-prelegent/michal-leja/" target="_blank" rel="noreferrer noopener">Leja Michał</a> / <a href="https://swiatlosila.pl/cyfrowe-prelegent/filip-kowalkowski/" target="_blank" rel="noreferrer noopener">Kowalkowski Filip</a>';
// Event 39613 is the one whose signup link text reads "Brak Miejsc" with a capital M.
const P_39613 =
  '16:00-18:00, <a href="https://swiatlosila.pl/cyfrowe-prelegent/mateusz-was/" target="_blank" rel="noreferrer noopener">Wąs Mateusz MUSTACHE LENS</a> <a href="https://www.cyfrowe.pl/swiatlosila-fotogra-fotospacer-z-mateuszem-wasem-mustache-lens-i-tamron-p.html" data-type="link" data-id="https://www.cyfrowe.pl/swiatlosila-fotogra-fotospacer-z-mateuszem-wasem-mustache-lens-i-tamron-p.html" target="_blank" rel="noreferrer noopener">Brak Miejsc</a>';
const P_41152 =
  '09:30-16:30, <a href="https://swiatlosila.pl/cyfrowe-prelegent/jakub-kazmierczyk/" data-type="cyfrowe-prelegent" data-id="46589">Kaźmierczyk Jakub</a> <a href="https://www.cyfrowe.pl/swiatlosila-warsztaty-masterclass-wejdz-do-swiata-blysku-z-jakubem-kazmierczykiem-p.html" data-type="link" data-id="https://www.cyfrowe.pl/swiatlosila-warsztaty-masterclass-wejdz-do-swiata-blysku-z-jakubem-kazmierczykiem-p.html" target="_blank" rel="noreferrer noopener">Zapisz się</a>';
const P_41154 =
  '11:00-16:15, <a href="https://swiatlosila.pl/cyfrowe-event/warsztaty-masterclass-fotografia-motoryzacyjna-z-filipem-blankiem/" data-type="cyfrowe-event" data-id="41154">Blank Filip</a> <a href="https://www.cyfrowe.pl/swiatlosila-warsztaty-masterclass-fotografia-motoryzacyjna-z-filipem-blankiem-p.html" data-type="link" data-id="https://www.cyfrowe.pl/swiatlosila-warsztaty-masterclass-fotografia-motoryzacyjna-z-filipem-blankiem-p.html" target="_blank" rel="noreferrer noopener">Zapisz się</a>';
const P_39590 =
  '09:30-10:30, <a href="https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/" data-type="link" data-id="https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/">Bartnik Karol</a>';
const P_46722 = "13:00-14:30, Sorger Fabian";

// Complete content.rendered of two real events.
const CONTENT_33705 = "\n<p>09:30</p>\n\n\n\n<p></p>\n";
const CONTENT_39549 = "\n<p>" + P_39549 + "</p>\n\n\n\n<p></p>\n\n\n\n<p></p>\n\n\n\n<p></p>\n";

describe("paragraphs", () => {
  it("returns the inner HTML of every <p> in order", () => {
    expect(paragraphs(CONTENT_33705)).toEqual(["09:30", ""]);
    expect(paragraphs(CONTENT_39549)).toEqual([P_39549, "", "", ""]);
  });

  it("removes WordPress block comments and tolerates attributes on <p>", () => {
    expect(paragraphs('<!-- wp:paragraph -->\n<p class="a">x</p>\n<!-- /wp:paragraph --><P style="b">y</P>')).toEqual(["x", "y"]);
  });

  it("returns an empty list without paragraphs", () => {
    expect(paragraphs("")).toEqual([]);
    expect(paragraphs("<div>no p</div>")).toEqual([]);
  });
});

describe("firstParagraph", () => {
  it("returns the first paragraph of a real event", () => {
    expect(firstParagraph(CONTENT_33705)).toBe("09:30");
    expect(firstParagraph(CONTENT_39549)).toBe(P_39549);
  });

  it("skips blank leading paragraphs", () => {
    expect(firstParagraph("<p></p>\n<p> </p>\n<p>&nbsp;</p>\n<p><br></p>\n<p>13:30, Cyfrowe.pl</p>")).toBe("13:30, Cyfrowe.pl");
  });

  it("returns an empty string when every paragraph is blank", () => {
    expect(firstParagraph("<p></p><p>&nbsp;</p>")).toBe("");
    expect(firstParagraph("")).toBe("");
  });
});

describe("parseTime on real first paragraphs", () => {
  it("parses 17:00-19:00 with a signup link (39549)", () => {
    expect(parseTime(stripTags(P_39549))).toEqual({ start: 1020, end: 1140, timeText: "17:00-19:00", endDiscarded: false });
  });

  it("parses the point events 13:30 (39565), 19:30 (34237) and 09:30 (33705)", () => {
    expect(parseTime(stripTags(P_39565))).toEqual({ start: 810, end: null, timeText: "13:30", endDiscarded: false });
    expect(parseTime(stripTags(P_34237))).toEqual({ start: 1170, end: null, timeText: "19:30", endDiscarded: false });
    expect(parseTime(stripTags(P_33705))).toEqual({ start: 570, end: null, timeText: "09:30", endDiscarded: false });
  });

  it("parses the long workshop 09:15-18:15 (46438) and 09:30-11:30 (46498)", () => {
    expect(parseTime(stripTags(P_46438))).toEqual({ start: 555, end: 1095, timeText: "09:15-18:15", endDiscarded: false });
    expect(parseTime(stripTags(P_46498))).toEqual({ start: 570, end: 690, timeText: "09:30-11:30", endDiscarded: false });
  });

  it("parses 16:00-18:00 of the Brak Miejsc event (39613)", () => {
    expect(parseTime(stripTags(P_39613))).toEqual({ start: 960, end: 1080, timeText: "16:00-18:00", endDiscarded: false });
  });
});

describe("parseTime variants", () => {
  it("accepts en dash, em dash, spaces around the dash and a dot separator", () => {
    expect(parseTime("09:30 – 10:30, Sony")).toEqual({ start: 570, end: 630, timeText: "09:30 – 10:30", endDiscarded: false });
    expect(parseTime("09:30—10:30")).toEqual({ start: 570, end: 630, timeText: "09:30—10:30", endDiscarded: false });
    expect(parseTime("9.30 - 10.45")).toEqual({ start: 570, end: 645, timeText: "9.30 - 10.45", endDiscarded: false });
  });

  it("discards an end that is not after the start and flags it", () => {
    expect(parseTime("10:00-10:00, x")).toEqual({ start: 600, end: null, timeText: "10:00-10:00", endDiscarded: true });
    expect(parseTime("10:00-09:30")).toEqual({ start: 600, end: null, timeText: "10:00-09:30", endDiscarded: true });
  });

  it("treats hours over 23 or minutes over 59 as unparseable", () => {
    const none = { start: null, end: null, timeText: "", endDiscarded: false };
    expect(parseTime("24:00-25:00")).toEqual(none);
    expect(parseTime("09:60")).toEqual(none);
    expect(parseTime("09:00-10:75")).toEqual(none);
  });

  it("gives null start, null end and an empty timeText without a leading time", () => {
    const none = { start: null, end: null, timeText: "", endDiscarded: false };
    expect(parseTime("Prelekcja o 10:00")).toEqual(none);
    expect(parseTime("")).toEqual(none);
    expect(parseTime("Sorger Fabian")).toEqual(none);
  });

  it("accepts midnight and 23:59", () => {
    expect(parseTime("00:00-23:59")).toEqual({ start: 0, end: 1439, timeText: "00:00-23:59", endDiscarded: false });
  });
});

describe("extractAnchors", () => {
  it("reads the signup anchor of 39549 with its host", () => {
    expect(extractAnchors(P_39549)).toEqual([
      {
        href: "https://www.cyfrowe.pl/swiatlosila-fotogra-before-fotospacer-colour-hunting-z-sony-p.html",
        text: "Zapisz się",
        dataType: "link",
        dataId: "https://www.cyfrowe.pl/swiatlosila-fotogra-before-fotospacer-colour-hunting-z-sony-p.html",
        host: "www.cyfrowe.pl",
      },
    ]);
  });

  it("reads two speaker anchors without data attributes (46498)", () => {
    expect(extractAnchors(P_46498)).toEqual([
      { href: "https://swiatlosila.pl/cyfrowe-prelegent/michal-leja/", text: "Leja Michał", dataType: null, dataId: null, host: "swiatlosila.pl" },
      { href: "https://swiatlosila.pl/cyfrowe-prelegent/filip-kowalkowski/", text: "Kowalkowski Filip", dataType: null, dataId: null, host: "swiatlosila.pl" },
    ]);
  });

  it("reads a speaker anchor followed by a signup anchor (39613) in document order", () => {
    const anchors = extractAnchors(P_39613);
    expect(anchors.map((a) => a.text)).toEqual(["Wąs Mateusz MUSTACHE LENS", "Brak Miejsc"]);
    expect(anchors.map((a) => a.host)).toEqual(["swiatlosila.pl", "www.cyfrowe.pl"]);
  });

  it("reads data-type and a numeric data-id (41152)", () => {
    const [speaker] = extractAnchors(P_41152);
    expect(speaker).toEqual({
      href: "https://swiatlosila.pl/cyfrowe-prelegent/jakub-kazmierczyk/",
      text: "Kaźmierczyk Jakub",
      dataType: "cyfrowe-prelegent",
      dataId: "46589",
      host: "swiatlosila.pl",
    });
  });

  it("reads the event-page anchor of 41154 and the URL data-id of 39590 verbatim", () => {
    const [eventAnchor] = extractAnchors(P_41154);
    expect(eventAnchor).toEqual({
      href: "https://swiatlosila.pl/cyfrowe-event/warsztaty-masterclass-fotografia-motoryzacyjna-z-filipem-blankiem/",
      text: "Blank Filip",
      dataType: "cyfrowe-event",
      dataId: "41154",
      host: "swiatlosila.pl",
    });
    expect(extractAnchors(P_39590)).toEqual([
      {
        href: "https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/",
        text: "Bartnik Karol",
        dataType: "link",
        dataId: "https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/",
        host: "swiatlosila.pl",
      },
    ]);
  });

  it("strips tags and decodes entities inside the anchor text", () => {
    expect(extractAnchors('<a href="https://swiatlosila.pl/x/">Wąs <strong>Mateusz</strong>&nbsp;&#8211; M</a>')[0]?.text).toBe("Wąs Mateusz – M");
  });

  it("gives an empty href and host to an anchor without href or with a relative one", () => {
    expect(extractAnchors('<a name="top">x</a><a href="/relative/">y</a>')).toEqual([
      { href: "", text: "x", dataType: null, dataId: null, host: "" },
      { href: "/relative/", text: "y", dataType: null, dataId: null, host: "" },
    ]);
  });

  it("returns an empty list without anchors", () => {
    expect(extractAnchors(P_39565)).toEqual([]);
    expect(extractAnchors(P_46722)).toEqual([]);
  });
});

describe("isSiteHost", () => {
  it("accepts swiatlosila.pl with or without www, in any case", () => {
    expect(isSiteHost("swiatlosila.pl")).toBe(true);
    expect(isSiteHost("www.swiatlosila.pl")).toBe(true);
    expect(isSiteHost("SWIATLOSILA.PL")).toBe(true);
  });

  it("rejects cyfrowe.pl, an empty host and look-alike hosts", () => {
    expect(isSiteHost("www.cyfrowe.pl")).toBe(false);
    expect(isSiteHost("")).toBe(false);
    expect(isSiteHost("swiatlosila.pl.evil.com")).toBe(false);
  });
});

describe("parseByline (spec §4.2 examples)", () => {
  it("keeps the brand name Sony after removing the time and the signup text (39549)", () => {
    expect(parseByline(stripTags(P_39549), "17:00-19:00", ["Zapisz się"])).toBe("Sony");
  });

  it("is null when only a speaker and a signup link remain (39613)", () => {
    expect(parseByline(stripTags(P_39613), "16:00-18:00", ["Brak Miejsc", "Wąs Mateusz MUSTACHE LENS"])).toBeNull();
  });

  it("keeps Cyfrowe.pl after a point time (39565)", () => {
    expect(parseByline(stripTags(P_39565), "13:30", [])).toBe("Cyfrowe.pl");
  });

  it("is null when two speakers separated by a slash are removed (46498)", () => {
    expect(parseByline(stripTags(P_46498), "09:30-11:30", ["Leja Michał", "Kowalkowski Filip"])).toBeNull();
  });

  it("keeps a plain surname-first name (46722)", () => {
    expect(parseByline(stripTags(P_46722), "13:00-14:30", [])).toBe("Sorger Fabian");
  });

  it("keeps the text of an unresolved anchor and drops the separators around it", () => {
    expect(parseByline("09:30-10:30, Nowak Jan / Kowalski Adam", "09:30-10:30", ["Kowalski Adam"])).toBe("Nowak Jan");
    expect(parseByline("09:30-10:30, Kowalski Adam / Nowak Jan", "09:30-10:30", ["Kowalski Adam"])).toBe("Nowak Jan");
  });

  it("collapses internal whitespace and works without a time", () => {
    expect(parseByline("10:00-11:00,   Sony   Polska ", "10:00-11:00", [])).toBe("Sony Polska");
    expect(parseByline("Sorger Fabian", "", [])).toBe("Sorger Fabian");
    expect(parseByline("", "", [])).toBeNull();
  });
});

describe("signupStatusFromTerm", () => {
  it("maps every cyfrowe-event-zapisy term name", () => {
    expect(signupStatusFromTerm("Zapisy")).toBe("open");
    expect(signupStatusFromTerm("Brak miejsc")).toBe("full");
    expect(signupStatusFromTerm("W ramach festiwalu")).toBe("included");
    expect(signupStatusFromTerm("WSTĘP WOLNY")).toBe("free");
    expect(signupStatusFromTerm("Zapisy wkrótce")).toBe("soon");
  });

  it("is unknown without a term or with an unexpected name", () => {
    expect(signupStatusFromTerm(undefined)).toBe("unknown");
    expect(signupStatusFromTerm("Inne")).toBe("unknown");
  });
});

describe("parseDay", () => {
  it("parses the three day terms in use", () => {
    expect(parseDay("⏱️ Czwartek (3 września)", 2026)).toEqual({ id: "czw", label: "Czwartek", short: "Czw", labelLong: "Czwartek, 3 września", date: "2026-09-03" });
    expect(parseDay("⏱️ Piątek (4 września)", 2026)).toEqual({ id: "pt", label: "Piątek", short: "Pt", labelLong: "Piątek, 4 września", date: "2026-09-04" });
    expect(parseDay("⏱️ Sobota (5 września)", 2026)).toEqual({ id: "sob", label: "Sobota", short: "Sob", labelLong: "Sobota, 5 września", date: "2026-09-05" });
  });

  it("parses the unused terms and two-digit days", () => {
    expect(parseDay("⏱️ Sobota (13 września)", 2026)?.date).toBe("2026-09-13");
    expect(parseDay("⏱️ Sobota (7 września)", 2026)?.date).toBe("2026-09-07");
  });

  it("maps every weekday to its id and short code", () => {
    expect(parseDay("Niedziela (6 września)", 2026)).toEqual({ id: "nd", label: "Niedziela", short: "Nd", labelLong: "Niedziela, 6 września", date: "2026-09-06" });
    expect(parseDay("Poniedziałek (7 września)", 2026)).toEqual({ id: "pon", label: "Poniedziałek", short: "Pon", labelLong: "Poniedziałek, 7 września", date: "2026-09-07" });
    expect(parseDay("Wtorek (8 września)", 2026)).toEqual({ id: "wt", label: "Wtorek", short: "Wt", labelLong: "Wtorek, 8 września", date: "2026-09-08" });
    expect(parseDay("Środa (9 września)", 2026)).toEqual({ id: "sr", label: "Środa", short: "Śr", labelLong: "Środa, 9 września", date: "2026-09-09" });
  });

  it("maps other genitive month names and takes the year from the argument", () => {
    expect(parseDay("Piątek (30 października)", 2027)?.date).toBe("2027-10-30");
    expect(parseDay("Sobota (1 lutego)", 2026)?.date).toBe("2026-02-01");
  });

  it("returns null without a weekday, without a date or with an unknown month", () => {
    expect(parseDay("Sesja specjalna", 2026)).toBeNull();
    expect(parseDay("Piątek", 2026)).toBeNull();
    expect(parseDay("Piątek (4 wrzesnia)", 2026)).toBeNull();
  });
});

describe("isAllDayEvent", () => {
  it("marks a 09:00-18:00 Ogólne session", () => {
    expect(isAllDayEvent(540, 1080, ["ogolne"])).toBe(true);
  });

  it("does not mark a 09:30-16:00 or an exactly 300-minute Warsztaty session", () => {
    expect(isAllDayEvent(570, 960, ["warsztaty"])).toBe(false);
    expect(isAllDayEvent(570, 870, ["warsztaty"])).toBe(false);
  });

  it("does not mark a 09:30 Ogólne point session or a session without a time", () => {
    expect(isAllDayEvent(570, null, ["ogolne"])).toBe(false);
    expect(isAllDayEvent(null, null, ["ogolne"])).toBe(false);
  });

  it("marks a 09:30-18:00 session typed Ogólne and STREFA TELEOBIEKTYWÓW, in any order", () => {
    expect(isAllDayEvent(570, 1080, ["strefa-teleobiektywow", "ogolne"])).toBe(true);
    expect(isAllDayEvent(570, 1080, ["ogolne", "strefa-teleobiektywow"])).toBe(true);
  });

  it("uses 300 minutes as the inclusive threshold", () => {
    expect(isAllDayEvent(540, 840, ["ogolne"])).toBe(true);
    expect(isAllDayEvent(540, 839, ["ogolne"])).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/__tests__/parse.test.ts`

Expected: fails before any test executes with `Error: Failed to resolve import "../lib/parse" from "scripts/__tests__/parse.test.ts". Does the file exist?` (0 tests passed).

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/parse.ts`:

```ts
/**
 * Parsing of WordPress event content and taxonomy names (spec §4.2).
 */
import type { SignupStatus } from "../../src/data/types";
import { decodeEntities, isBlankHtml, stripTags } from "./sanitize";

const COMMENT_RE = /<!--[\s\S]*?-->/g;
// Attribute run inside a tag; quoted values may contain ">".
const ATTRS = `(?:"[^"]*"|'[^']*'|[^>"'])*`;
const PARAGRAPH_SOURCE = `<p\\b${ATTRS}>([\\s\\S]*?)</p\\s*>`;
const ANCHOR_SOURCE = `<a\\b(${ATTRS})>([\\s\\S]*?)</a\\s*>`;
const TIME_RE = /^\s*(\d{1,2})[:.](\d{2})(?:\s*[-–—]\s*(\d{1,2})[:.](\d{2}))?/;
const DAY_RE = /(Czwartek|Piątek|Sobota|Niedziela|Poniedziałek|Wtorek|Środa)\s*\((\d{1,2})\s+(\S+)\)/;
const ALL_DAY_MINUTES = 300;
const ALL_DAY_TYPE_SLUG = "ogolne";

export function paragraphs(html: string): string[] {
  const src = html.replace(COMMENT_RE, "");
  const re = new RegExp(PARAGRAPH_SOURCE, "gi");
  const result: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) result.push(m[1] ?? "");
  return result;
}

export function firstParagraph(html: string): string {
  return paragraphs(html).find((p) => !isBlankHtml(p)) ?? "";
}

export interface ParsedTime { start: number | null; end: number | null; timeText: string; endDiscarded: boolean }

function toMinutes(hours: string, minutes: string): number | null {
  const h = Number(hours);
  const min = Number(minutes);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function parseTime(text: string): ParsedTime {
  const none: ParsedTime = { start: null, end: null, timeText: "", endDiscarded: false };
  const m = TIME_RE.exec(text);
  if (!m) return none;
  const start = toMinutes(m[1] ?? "", m[2] ?? "");
  if (start === null) return none;
  const timeText = m[0];
  const endHours: string | undefined = m[3];
  const endMinutes: string | undefined = m[4];
  if (endHours === undefined || endMinutes === undefined) return { start, end: null, timeText, endDiscarded: false };
  const end = toMinutes(endHours, endMinutes);
  if (end === null) return none;
  if (end <= start) return { start, end: null, timeText, endDiscarded: true };
  return { start, end, timeText, endDiscarded: false };
}

export interface Anchor { href: string; text: string; dataType: string | null; dataId: string | null; host: string }

function attribute(attrs: string, name: string): string | null {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
  const m = re.exec(attrs);
  if (!m) return null;
  return decodeEntities(m[1] ?? m[2] ?? m[3] ?? "");
}

function hostOf(href: string): string {
  try {
    return new URL(href).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function extractAnchors(html: string): Anchor[] {
  const re = new RegExp(ANCHOR_SOURCE, "gi");
  const anchors: Anchor[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] ?? "";
    const href = attribute(attrs, "href") ?? "";
    anchors.push({
      href,
      text: stripTags(m[2] ?? ""),
      dataType: attribute(attrs, "data-type"),
      dataId: attribute(attrs, "data-id"),
      host: hostOf(href),
    });
  }
  return anchors;
}

export function isSiteHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "swiatlosila.pl" || h === "www.swiatlosila.pl";
}

export function parseByline(text: string, timeText: string, removeTexts: string[]): string | null {
  let rest = timeText === "" ? text : text.replace(timeText, "");
  for (const t of removeTexts) {
    if (t !== "") rest = rest.replace(t, "");
  }
  const cleaned = rest.replace(/\s+/g, " ").replace(/^[\s,/]+/, "").replace(/[\s,/]+$/, "");
  return cleaned === "" ? null : cleaned;
}

const SIGNUP_BY_TERM = new Map<string, SignupStatus>([
  ["Zapisy", "open"],
  ["Brak miejsc", "full"],
  ["W ramach festiwalu", "included"],
  ["WSTĘP WOLNY", "free"],
  ["Zapisy wkrótce", "soon"],
]);

export function signupStatusFromTerm(name: string | undefined): SignupStatus {
  if (name === undefined) return "unknown";
  return SIGNUP_BY_TERM.get(decodeEntities(name).trim()) ?? "unknown";
}

export interface ParsedDay { id: string; label: string; short: string; labelLong: string; date: string }

const WEEKDAYS = new Map<string, { id: string; short: string }>([
  ["Czwartek", { id: "czw", short: "Czw" }],
  ["Piątek", { id: "pt", short: "Pt" }],
  ["Sobota", { id: "sob", short: "Sob" }],
  ["Niedziela", { id: "nd", short: "Nd" }],
  ["Poniedziałek", { id: "pon", short: "Pon" }],
  ["Wtorek", { id: "wt", short: "Wt" }],
  ["Środa", { id: "sr", short: "Śr" }],
]);

const MONTHS = new Map<string, number>([
  ["stycznia", 1], ["lutego", 2], ["marca", 3], ["kwietnia", 4], ["maja", 5], ["czerwca", 6],
  ["lipca", 7], ["sierpnia", 8], ["września", 9], ["października", 10], ["listopada", 11], ["grudnia", 12],
]);

export function parseDay(termName: string, year: number): ParsedDay | null {
  const m = DAY_RE.exec(decodeEntities(termName));
  if (!m) return null;
  const label = m[1] ?? "";
  const dayNumber = m[2] ?? "";
  const monthName = m[3] ?? "";
  const weekday = WEEKDAYS.get(label);
  const month = MONTHS.get(monthName.toLowerCase());
  if (weekday === undefined || month === undefined) return null;
  const date = `${year}-${String(month).padStart(2, "0")}-${dayNumber.padStart(2, "0")}`;
  return { id: weekday.id, label, short: weekday.short, labelLong: `${label}, ${dayNumber} ${monthName}`, date };
}

export function isAllDayEvent(start: number | null, end: number | null, typeSlugs: string[]): boolean {
  if (start === null || end === null) return false;
  return end - start >= ALL_DAY_MINUTES && typeSlugs.includes(ALL_DAY_TYPE_SLUG);
}
```

- [ ] **Step 4: Run the tests and the typecheck to verify they pass**

Run: `npx vitest run scripts/__tests__/parse.test.ts`

Expected: `Test Files 1 passed`, `Tests 44 passed`, 0 failed.

Run: `npx vitest run scripts/__tests__` (Task 3 must still be green) and `npm run typecheck`.

Expected: 2 test files passed; no type errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/parse.ts scripts/__tests__/parse.test.ts
git commit -F - <<'EOF_COMMIT'
feat(scripts): parse event times, anchors, bylines and day terms

Adds paragraphs, firstParagraph, parseTime (spec 4.2 regex with range
validation and end<=start discard), extractAnchors, isSiteHost,
parseByline, signupStatusFromTerm, parseDay and isAllDayEvent, tested
against the real first paragraphs of events 39549, 39565, 34237, 33705,
46438, 46498 and 39613.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2
EOF_COMMIT
```

---

### Task 5: Location parsing, short labels and ordering (`scripts/lib/locations.ts`)

**Files:**
- Create: `scripts/lib/locations.ts`
- Create: `scripts/__tests__/locations.fixture.json`
- Test: `scripts/__tests__/locations.test.ts`

**Interfaces:**
- Consumes: from `src/data/types.ts` (contract): `type Level = "0" | "I" | "II" | "III" | "I+II" | null` (type-only import). Nothing from Tasks 3–4.
- Produces (contract "Fetch script lib signatures", `locations.ts`):
  - `interface ParsedLocation { venue: string; level: Level; room: string | null; rule: 1 | 2 | 3 | 4 | 5 | 6 }` and `parseLocation(name: string): ParsedLocation` — spec §4.2 rules 1–6 tried in order with the exact regexes; `rule` tells the validator which rule fired (rule 6 on a name other than `Rejestracja`, `W4`, `Wkrótce`, `ZERO ZERO (przed wejściem)` is a warning — that list is the validator's, not this module's).
  - `SHORT_LABELS: Record<number, string>` — the 26-row table of spec §4.2 keyed by term id.
  - `shortLabel(id: number, parsed: ParsedLocation): { short: string; fromMap: boolean }` — map hit, else the fallback (`Sala wykładowa` → `Sala wykł.`, `Sala warsztatowa` → `Warsztat.`, else venue) with `fromMap: false` so the validator can warn.
  - `LEVEL_ORDER: Level[]` = `["0", "I", "I+II", "II", "III", null]`.
  - `compareLocations(a: { level: Level; name: string }, b: { level: Level; name: string }): number` — level index first, then `new Intl.Collator("pl").compare` on the name. The normalizer sorts locations with it and assigns `order` from the resulting index.

- [ ] **Step 1: Write the fixture**

Create `scripts/__tests__/locations.fixture.json`. One entry per `cyfrowe-event-location` term (all 26, including the six with `count` 0), written by hand from the spec §4.2 rules and table; `name` is byte-exact from the API.

```json
[
  {
    "id": 233,
    "name": "So Salsa - poziom II - Sala wykładowa nr 1",
    "venue": "So Salsa",
    "level": "II",
    "room": "Sala wykładowa nr 1",
    "short": "Sala wykł. 1",
    "rule": 1
  },
  {
    "id": 234,
    "name": "Studio na ringu - poziom II - Sala warsztatowa II",
    "venue": "Studio na ringu",
    "level": "II",
    "room": "Sala warsztatowa II",
    "short": "Warsztat. II (ring)",
    "rule": 1
  },
  {
    "id": 235,
    "name": "Studio Luksfera - Sala warsztatowa III",
    "venue": "Studio Luksfera",
    "level": null,
    "room": "Sala warsztatowa III",
    "short": "Warsztat. III",
    "rule": 5
  },
  {
    "id": 236,
    "name": "Studio Cukier by Luksfera - Sala warsztatowa IV",
    "venue": "Studio Cukier by Luksfera",
    "level": null,
    "room": "Sala warsztatowa IV",
    "short": "Warsztat. IV",
    "rule": 5
  },
  {
    "id": 237,
    "name": "Studio Elektryków - Sala warsztatowa V",
    "venue": "Studio Elektryków",
    "level": null,
    "room": "Sala warsztatowa V",
    "short": "Warsztat. V",
    "rule": 5
  },
  {
    "id": 238,
    "name": "Zero Zero - Sala warsztatowa VI",
    "venue": "Zero Zero",
    "level": null,
    "room": "Sala warsztatowa VI",
    "short": "Warsztat. VI",
    "rule": 5
  },
  {
    "id": 239,
    "name": "Strefa sprzętu - poziom I",
    "venue": "Strefa sprzętu",
    "level": "I",
    "room": null,
    "short": "Strefa sprzętu I",
    "rule": 4
  },
  {
    "id": 240,
    "name": "Strefa sprzętu - poziom II",
    "venue": "Strefa sprzętu",
    "level": "II",
    "room": null,
    "short": "Strefa sprzętu II",
    "rule": 4
  },
  {
    "id": 241,
    "name": "Playground Cyfrowe.pl - poziom II",
    "venue": "Playground Cyfrowe.pl",
    "level": "II",
    "room": null,
    "short": "Playground",
    "rule": 4
  },
  {
    "id": 279,
    "name": "Klub bokserski - poziom II - Sala wykładowa nr 4",
    "venue": "Klub bokserski",
    "level": "II",
    "room": "Sala wykładowa nr 4",
    "short": "Sala wykł. 4",
    "rule": 1
  },
  {
    "id": 280,
    "name": "W4 - poziom I - Sala wykładowa nr 5",
    "venue": "W4",
    "level": "I",
    "room": "Sala wykładowa nr 5",
    "short": "Sala wykł. 5",
    "rule": 1
  },
  {
    "id": 281,
    "name": "SoSalsa - poziom II - Sala wykładowa nr 2",
    "venue": "SoSalsa",
    "level": "II",
    "room": "Sala wykładowa nr 2",
    "short": "Sala wykł. 2",
    "rule": 1
  },
  {
    "id": 282,
    "name": "Drizzly Grizzly - poziom 0 - Sala wykładowa nr 3",
    "venue": "Drizzly Grizzly",
    "level": "0",
    "room": "Sala wykładowa nr 3",
    "short": "Sala wykł. 3",
    "rule": 1
  },
  {
    "id": 283,
    "name": "ZERO ZERO (przed wejściem)",
    "venue": "ZERO ZERO (przed wejściem)",
    "level": null,
    "room": null,
    "short": "Zero Zero · wejście",
    "rule": 6
  },
  {
    "id": 290,
    "name": "ZERO ZERO Antresola - Sala warsztatowa VI",
    "venue": "ZERO ZERO Antresola",
    "level": null,
    "room": "Sala warsztatowa VI",
    "short": "Warsztat. VI (antresola)",
    "rule": 5
  },
  {
    "id": 291,
    "name": "Wkrótce",
    "venue": "Wkrótce",
    "level": null,
    "room": null,
    "short": "Wkrótce",
    "rule": 6
  },
  {
    "id": 292,
    "name": "Klub bokserski - poziom II - Sala warsztatowa II",
    "venue": "Klub bokserski",
    "level": "II",
    "room": "Sala warsztatowa II",
    "short": "Warsztat. II",
    "rule": 1
  },
  {
    "id": 293,
    "name": "So Salsa - poziom II - Sala warsztatowa I",
    "venue": "So Salsa",
    "level": "II",
    "room": "Sala warsztatowa I",
    "short": "Warsztat. I",
    "rule": 1
  },
  {
    "id": 307,
    "name": "Stoiska wystawców - poziom I (PLENUM) i poziom II (SOSALSA)",
    "venue": "Stoiska wystawców",
    "level": "I+II",
    "room": "PLENUM · SOSALSA",
    "short": "Stoiska · Plenum i SoSalsa",
    "rule": 2
  },
  {
    "id": 308,
    "name": "Stoiska wystawców - poziom I (PLENUM)",
    "venue": "Stoiska wystawców",
    "level": "I",
    "room": "PLENUM",
    "short": "Stoiska · Plenum",
    "rule": 3
  },
  {
    "id": 309,
    "name": "Stoiska wystawców - poziom II (SOSALSA)",
    "venue": "Stoiska wystawców",
    "level": "II",
    "room": "SOSALSA",
    "short": "Stoiska · SoSalsa",
    "rule": 3
  },
  {
    "id": 310,
    "name": "Stoiska wystawców - poziom II (SOSALSA) - wyjście na dach",
    "venue": "Stoiska wystawców",
    "level": "II",
    "room": "SOSALSA · wyjście na dach",
    "short": "Stoiska · Dach",
    "rule": 3
  },
  {
    "id": 311,
    "name": "Stoiska wystawców - poziom I (PLENUM) - Canon",
    "venue": "Stoiska wystawców",
    "level": "I",
    "room": "PLENUM · Canon",
    "short": "Stoiska · Canon",
    "rule": 3
  },
  {
    "id": 312,
    "name": "W4",
    "venue": "W4",
    "level": null,
    "room": null,
    "short": "W4",
    "rule": 6
  },
  {
    "id": 313,
    "name": "Stoiska wystawców - poziom II (SOSALSA) - Playground",
    "venue": "Stoiska wystawców",
    "level": "II",
    "room": "SOSALSA · Playground",
    "short": "Stoiska · Playground",
    "rule": 3
  },
  {
    "id": 318,
    "name": "Rejestracja",
    "venue": "Rejestracja",
    "level": null,
    "room": null,
    "short": "Rejestracja",
    "rule": 6
  }
]
```

- [ ] **Step 2: Write the failing test**

Create `scripts/__tests__/locations.test.ts`:

```ts
// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Level } from "../../src/data/types";
import { LEVEL_ORDER, SHORT_LABELS, compareLocations, parseLocation, shortLabel } from "../lib/locations";

interface LocationFixture {
  id: number;
  name: string;
  venue: string;
  level: Level;
  room: string | null;
  short: string;
  rule: 1 | 2 | 3 | 4 | 5 | 6;
}

const fixture = JSON.parse(
  readFileSync(new URL("./locations.fixture.json", import.meta.url), "utf8"),
) as LocationFixture[];

describe("locations fixture", () => {
  it("lists all 26 location terms with unique ids", () => {
    expect(fixture).toHaveLength(26);
    expect(new Set(fixture.map((f) => f.id)).size).toBe(26);
  });

  it("uses rules 1-6 for 8/1/5/3/5/4 terms", () => {
    const counts = new Map<number, number>();
    for (const f of fixture) counts.set(f.rule, (counts.get(f.rule) ?? 0) + 1);
    expect([1, 2, 3, 4, 5, 6].map((rule) => counts.get(rule) ?? 0)).toEqual([8, 1, 5, 3, 5, 4]);
  });
});

describe("parseLocation and shortLabel against every term", () => {
  it.each(fixture)("$id $name", (f) => {
    const parsed = parseLocation(f.name);
    expect(parsed).toEqual({ venue: f.venue, level: f.level, room: f.room, rule: f.rule });
    expect(shortLabel(f.id, parsed)).toEqual({ short: f.short, fromMap: true });
  });

  it("reads the two-level term 307 as I+II", () => {
    expect(parseLocation("Stoiska wystawców - poziom I (PLENUM) i poziom II (SOSALSA)").level).toBe("I+II");
  });

  it("reads the SOSALSA terms 309, 310 and 313 as level II and PLENUM 308 as level I", () => {
    expect(parseLocation("Stoiska wystawców - poziom II (SOSALSA)").level).toBe("II");
    expect(parseLocation("Stoiska wystawców - poziom II (SOSALSA) - wyjście na dach").level).toBe("II");
    expect(parseLocation("Stoiska wystawców - poziom II (SOSALSA) - Playground").level).toBe("II");
    expect(parseLocation("Stoiska wystawców - poziom I (PLENUM)").level).toBe("I");
  });

  it("gives the bare venue W4 (312) no level and no room", () => {
    expect(parseLocation("W4")).toEqual({ venue: "W4", level: null, room: null, rule: 6 });
  });

  it("never reads poziom II as poziom I in rule 1", () => {
    expect(parseLocation("Klub bokserski - poziom II - Sala wykładowa nr 4").level).toBe("II");
    expect(parseLocation("Drizzly Grizzly - poziom 0 - Sala wykładowa nr 3").level).toBe("0");
  });

  it("matches poziom case-insensitively and trims the name", () => {
    expect(parseLocation("  Nowa hala - POZIOM iii - Sala wykładowa nr 9 ")).toEqual({
      venue: "Nowa hala",
      level: "III",
      room: "Sala wykładowa nr 9",
      rule: 1,
    });
  });
});

describe("SHORT_LABELS", () => {
  it("has exactly the 26 ids of the spec table", () => {
    const ids = Object.keys(SHORT_LABELS).map(Number).sort((a, b) => a - b);
    expect(ids).toEqual(fixture.map((f) => f.id).sort((a, b) => a - b));
  });
});

describe("shortLabel fallback for unmapped terms", () => {
  it("shortens Sala wykładowa in the room", () => {
    const parsed = parseLocation("Nowa hala - poziom I - Sala wykładowa nr 9");
    expect(shortLabel(999, parsed)).toEqual({ short: "Sala wykł. nr 9", fromMap: false });
  });

  it("shortens Sala warsztatowa in the room", () => {
    const parsed = parseLocation("Nowe studio - Sala warsztatowa VII");
    expect(shortLabel(998, parsed)).toEqual({ short: "Warsztat. VII", fromMap: false });
  });

  it("keeps other rooms verbatim", () => {
    const parsed = parseLocation("Stoiska wystawców - poziom III (DACH)");
    expect(shortLabel(997, parsed)).toEqual({ short: "DACH", fromMap: false });
  });

  it("falls back to the venue when there is no room", () => {
    expect(shortLabel(996, parseLocation("Foyer - poziom 0"))).toEqual({ short: "Foyer", fromMap: false });
    expect(shortLabel(995, parseLocation("Namiot"))).toEqual({ short: "Namiot", fromMap: false });
  });
});

describe("LEVEL_ORDER and compareLocations", () => {
  it("orders levels 0, I, I+II, II, III, null", () => {
    expect(LEVEL_ORDER).toEqual(["0", "I", "I+II", "II", "III", null]);
  });

  it("sorts by level before name", () => {
    expect(compareLocations({ level: "II", name: "A" }, { level: "0", name: "Z" })).toBeGreaterThan(0);
    expect(compareLocations({ level: "I", name: "Z" }, { level: "I+II", name: "A" })).toBeLessThan(0);
    expect(compareLocations({ level: "III", name: "A" }, { level: null, name: "A" })).toBeLessThan(0);
  });

  it("uses Polish collation within a level", () => {
    expect(compareLocations({ level: null, name: "Łódź" }, { level: null, name: "Lublin" })).toBeGreaterThan(0);
    expect(compareLocations({ level: null, name: "Łódź" }, { level: null, name: "Maków" })).toBeLessThan(0);
    expect(compareLocations({ level: null, name: "Środa" }, { level: null, name: "Sobota" })).toBeGreaterThan(0);
    expect(compareLocations({ level: null, name: "Środa" }, { level: null, name: "Tarnów" })).toBeLessThan(0);
  });

  it("orders the 26 real terms as the locations array will be written", () => {
    const sorted = [...fixture].sort(compareLocations).map((f) => f.id);
    expect(sorted).toEqual([
      282,
      308, 311, 239, 280,
      307,
      292, 279, 241, 293, 233, 281, 309, 313, 310, 240, 234,
      318, 236, 237, 235, 312, 291, 238, 283, 290,
    ]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run scripts/__tests__/locations.test.ts`

Expected: fails before any test executes with `Error: Failed to resolve import "../lib/locations" from "scripts/__tests__/locations.test.ts". Does the file exist?` (0 tests passed).

- [ ] **Step 4: Write the implementation**

Create `scripts/lib/locations.ts`:

```ts
/**
 * Location term parsing, short labels and ordering (spec §4.2 "Locations").
 */
import type { Level } from "../../src/data/types";

export interface ParsedLocation { venue: string; level: Level; room: string | null; rule: 1 | 2 | 3 | 4 | 5 | 6 }

// Level alternation is longest-first so "II" is never read as "I".
const RULE_1 = /^(.*?)\s*-\s*poziom\s*(0|III|II|I)\s*-\s*(.+)$/i;
const RULE_2 = /^(.*?)\s*-\s*poziom\s*I\s*\(([^)]+)\)\s*i\s*poziom\s*II\s*\(([^)]+)\)$/i;
const RULE_3 = /^(.*?)\s*-\s*poziom\s*(0|III|II|I)\s*\(([^)]+)\)(?:\s*-\s*(.+))?$/i;
const RULE_4 = /^(.*?)\s*-\s*poziom\s*(0|III|II|I)$/i;
const RULE_5 = /^(.*?)\s*-\s*(Sala .+)$/;

const LEVEL_BY_TEXT = new Map<string, Level>([["0", "0"], ["I", "I"], ["II", "II"], ["III", "III"]]);

function levelOf(text: string): Level {
  return LEVEL_BY_TEXT.get(text.toUpperCase()) ?? null;
}

export function parseLocation(name: string): ParsedLocation {
  const trimmed = name.trim();
  let m = RULE_1.exec(trimmed);
  if (m) return { venue: m[1] ?? "", level: levelOf(m[2] ?? ""), room: m[3] ?? "", rule: 1 };
  m = RULE_2.exec(trimmed);
  if (m) return { venue: m[1] ?? "", level: "I+II", room: `${m[2] ?? ""} · ${m[3] ?? ""}`, rule: 2 };
  m = RULE_3.exec(trimmed);
  if (m) {
    const detail = m[4];
    const room = detail === undefined ? (m[3] ?? "") : `${m[3] ?? ""} · ${detail}`;
    return { venue: m[1] ?? "", level: levelOf(m[2] ?? ""), room, rule: 3 };
  }
  m = RULE_4.exec(trimmed);
  if (m) return { venue: m[1] ?? "", level: levelOf(m[2] ?? ""), room: null, rule: 4 };
  m = RULE_5.exec(trimmed);
  if (m) return { venue: m[1] ?? "", level: null, room: m[2] ?? "", rule: 5 };
  return { venue: trimmed, level: null, room: null, rule: 6 };
}

export const SHORT_LABELS: Record<number, string> = {
  282: "Sala wykł. 3",
  292: "Warsztat. II",
  279: "Sala wykł. 4",
  241: "Playground",
  318: "Rejestracja",
  293: "Warsztat. I",
  233: "Sala wykł. 1",
  281: "Sala wykł. 2",
  308: "Stoiska · Plenum",
  311: "Stoiska · Canon",
  307: "Stoiska · Plenum i SoSalsa",
  309: "Stoiska · SoSalsa",
  313: "Stoiska · Playground",
  310: "Stoiska · Dach",
  239: "Strefa sprzętu I",
  240: "Strefa sprzętu II",
  236: "Warsztat. IV",
  237: "Warsztat. V",
  235: "Warsztat. III",
  234: "Warsztat. II (ring)",
  312: "W4",
  280: "Sala wykł. 5",
  291: "Wkrótce",
  283: "Zero Zero · wejście",
  238: "Warsztat. VI",
  290: "Warsztat. VI (antresola)",
};

export function shortLabel(id: number, parsed: ParsedLocation): { short: string; fromMap: boolean } {
  const mapped: string | undefined = SHORT_LABELS[id];
  if (mapped !== undefined) return { short: mapped, fromMap: true };
  if (parsed.room !== null) {
    const short = parsed.room.replace("Sala wykładowa", "Sala wykł.").replace("Sala warsztatowa", "Warsztat.");
    return { short, fromMap: false };
  }
  return { short: parsed.venue, fromMap: false };
}

export const LEVEL_ORDER: Level[] = ["0", "I", "I+II", "II", "III", null];

const collator = new Intl.Collator("pl");

export function compareLocations(a: { level: Level; name: string }, b: { level: Level; name: string }): number {
  const byLevel = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);
  if (byLevel !== 0) return byLevel;
  return collator.compare(a.name, b.name);
}
```

- [ ] **Step 5: Run the tests and the typecheck to verify they pass**

Run: `npx vitest run scripts/__tests__/locations.test.ts`

Expected: `Test Files 1 passed`, `Tests 42 passed` (26 from `it.each` plus 16 named cases), 0 failed.

Run: `npx vitest run scripts/__tests__` and `npm run typecheck`.

Expected: 3 test files passed; no type errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/locations.ts scripts/__tests__/locations.fixture.json scripts/__tests__/locations.test.ts
git commit -F - <<'EOF_COMMIT'
feat(scripts): parse location terms with short labels and ordering

Adds parseLocation (spec 4.2 rules 1-6), the 26-entry SHORT_LABELS map,
shortLabel fallback, LEVEL_ORDER and compareLocations with Polish
collation, tested against a hand-written fixture of every location term.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2
EOF_COMMIT
```

---


### Task 6: Speaker resolution (`scripts/lib/speakers.ts`)

**Files:**
- Create: `scripts/lib/speakers.ts`
- Test: `scripts/__tests__/speakers.test.ts`

**Interfaces:**
- Consumes:
  - `nameTokens(s: string): Set<string>` from `src/domain/normalize.ts` (normalizeText, then `/\p{L}+|\p{N}+/gu`).
  - `decodeEntities(s: string): string` from `scripts/lib/sanitize.ts`.
  - `Anchor` from `scripts/lib/parse.ts`: `{ href: string; text: string; dataType: string | null; dataId: string | null; host: string }`.
  - `Speaker` from `src/data/types.ts`.
- Produces (used by Task 7's `normalize.ts`):
  - `interface SpeakerLookup { bySlug: Map<string, Speaker>; byId: Map<number, Speaker>; byTokens: { tokens: Set<string>; speaker: Speaker }[] }`
  - `buildSpeakerLookup(speakers: Speaker[]): SpeakerLookup`
  - `type ResolveTier = "slug" | "name" | "data-id"`
  - `resolveSpeaker(anchor: Anchor, lookup: SpeakerLookup): { speaker: Speaker; tier: ResolveTier } | null`

The three tiers run in the order slug, name, `data-id` (spec §4.2). Slug first because event 46769 has a correct slug with a wrong `data-id`; name before `data-id` because the anchor text is what editors see. The name tier compares token *sets* because anchors read "Surname Firstname" and speaker names read "Firstname Surname".

- [ ] **Step 1: Write the failing test**

Every id, slug, name and anchor below is copied from the 2026-09-03 snapshot (the raw anchor HTML is quoted in the comments). Create `scripts/__tests__/speakers.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Speaker } from "../../src/data/types";
import type { Anchor } from "../lib/parse";
import { buildSpeakerLookup, resolveSpeaker } from "../lib/speakers";

function speaker(id: number, slug: string, name: string): Speaker {
  return {
    id,
    slug,
    name,
    photo: null,
    photoThumb: null,
    bioHtml: "",
    url: `https://swiatlosila.pl/cyfrowe-prelegent/${slug}/`,
    brands: [],
  };
}

// Real ids, slugs and names from the 2026-09-03 snapshot (speakers-embed-p*.json).
const SPEAKERS: Speaker[] = [
  speaker(134, "emil-bilinski-x", "Emil Biliński"),
  speaker(128, "karol-bartnik-2", "Karol Bartnik"),
  speaker(293, "filip-blank", "Filip Blank"),
  speaker(46702, "tomasz-zieniu-zienkiewicz-2", "Tomasz ZIENIU Zienkiewicz"),
  speaker(46570, "danaj-katarzyna-budziszyna", "Katarzyna Danaj BUDZISZYNA"),
  speaker(339, "michal-leja", "Michał Leja"),
  speaker(329, "klikfilm-kuba", "KLIK FILM – Jakub Urban"),
  speaker(496, "klik-film-oskar-rak", "KLIK FILM – Oskar Rak"),
];

function anchor(fields: {
  href: string;
  text: string;
  dataType?: string | null;
  dataId?: string | null;
}): Anchor {
  return {
    href: fields.href,
    text: fields.text,
    dataType: fields.dataType ?? null,
    dataId: fields.dataId ?? null,
    host: new URL(fields.href).host,
  };
}

const lookup = buildSpeakerLookup(SPEAKERS);

describe("buildSpeakerLookup", () => {
  it("indexes speakers by slug, by id and by name tokens", () => {
    expect(lookup.bySlug.get("filip-blank")?.id).toBe(293);
    expect(lookup.byId.get(134)?.name).toBe("Emil Biliński");
    const leja = lookup.byTokens.find((entry) => entry.speaker.id === 339);
    expect(leja?.tokens).toEqual(new Set(["michal", "leja"]));
  });
});

describe("resolveSpeaker", () => {
  it("resolves the stale jimmy-salatka slug to 134 Emil Biliński by name", () => {
    // event 46502: <a href="https://swiatlosila.pl/cyfrowe-prelegent/jimmy-salatka/" data-type="cyfrowe-prelegent" data-id="134">Biliński Emil</a>
    const result = resolveSpeaker(
      anchor({
        href: "https://swiatlosila.pl/cyfrowe-prelegent/jimmy-salatka/",
        text: "Biliński Emil",
        dataType: "cyfrowe-prelegent",
        dataId: "134",
      }),
      lookup,
    );
    expect(result?.speaker.id).toBe(134);
    expect(result?.speaker.name).toBe("Emil Biliński");
    expect(result?.tier).toBe("name");
  });

  it("resolves the event 39590 anchor (data-type link, URL in data-id) to 128 Karol Bartnik by name", () => {
    // event 39590: <a href="https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/" data-type="link" data-id="https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/" target="_blank" rel="noreferrer noopener">Bartnik Karol</a>
    const result = resolveSpeaker(
      anchor({
        href: "https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/",
        text: "Bartnik Karol",
        dataType: "link",
        dataId: "https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/",
      }),
      lookup,
    );
    expect(result?.speaker.id).toBe(128);
    expect(result?.speaker.name).toBe("Karol Bartnik");
    expect(result?.tier).toBe("name");
  });

  it("resolves the event 41154 self-link 'Blank Filip' to 293 Filip Blank by name", () => {
    // event 41154: <a href="https://swiatlosila.pl/cyfrowe-event/warsztaty-masterclass-fotografia-motoryzacyjna-z-filipem-blankiem/" data-type="cyfrowe-event" data-id="41154">Blank Filip</a>
    const result = resolveSpeaker(
      anchor({
        href: "https://swiatlosila.pl/cyfrowe-event/warsztaty-masterclass-fotografia-motoryzacyjna-z-filipem-blankiem/",
        text: "Blank Filip",
        dataType: "cyfrowe-event",
        dataId: "41154",
      }),
      lookup,
    );
    expect(result?.speaker.id).toBe(293);
    expect(result?.speaker.name).toBe("Filip Blank");
    expect(result?.tier).toBe("name");
  });

  it("resolves the event 46769 anchor by slug and ignores its wrong data-id 46570", () => {
    // event 46769: <a href="https://swiatlosila.pl/cyfrowe-prelegent/tomasz-zieniu-zienkiewicz-2/" data-type="cyfrowe-prelegent" data-id="46570" target="_blank" rel="noreferrer noopener">Tomasz ZIENIU Zienkiewicz</a>
    const result = resolveSpeaker(
      anchor({
        href: "https://swiatlosila.pl/cyfrowe-prelegent/tomasz-zieniu-zienkiewicz-2/",
        text: "Tomasz ZIENIU Zienkiewicz",
        dataType: "cyfrowe-prelegent",
        dataId: "46570",
      }),
      lookup,
    );
    expect(result?.speaker.id).toBe(46702);
    expect(result?.speaker.id).not.toBe(46570);
    expect(result?.tier).toBe("slug");
  });

  it("matches 'Leja Michal' to 'Michał Leja' when the slug is stale", () => {
    const result = resolveSpeaker(
      anchor({
        href: "https://swiatlosila.pl/cyfrowe-prelegent/leja-michal-stary/",
        text: "Leja Michal",
      }),
      lookup,
    );
    expect(result?.speaker.id).toBe(339);
    expect(result?.speaker.name).toBe("Michał Leja");
    expect(result?.tier).toBe("name");
  });

  it("falls back to a numeric data-id when the slug is stale and the text is ambiguous", () => {
    // "KLIK FILM" is contained in two speaker names (329 and 496), so the name tier fails.
    const result = resolveSpeaker(
      anchor({
        href: "https://swiatlosila.pl/cyfrowe-prelegent/klik-film/",
        text: "KLIK FILM",
        dataType: "cyfrowe-prelegent",
        dataId: "496",
      }),
      lookup,
    );
    expect(result?.speaker.id).toBe(496);
    expect(result?.speaker.name).toBe("KLIK FILM – Oskar Rak");
    expect(result?.tier).toBe("data-id");
  });

  it("stays unresolved when the text is ambiguous and there is no usable data-id", () => {
    expect(
      resolveSpeaker(
        anchor({
          href: "https://swiatlosila.pl/cyfrowe-prelegent/klik-film/",
          text: "KLIK FILM",
        }),
        lookup,
      ),
    ).toBeNull();
    // A data-id that is not numeric or not typed cyfrowe-prelegent is not consulted either.
    expect(
      resolveSpeaker(
        anchor({
          href: "https://swiatlosila.pl/cyfrowe-prelegent/klik-film/",
          text: "KLIK FILM",
          dataType: "link",
          dataId: "496",
        }),
        lookup,
      ),
    ).toBeNull();
  });

  it("never applies the containment rule to a single-token anchor", () => {
    expect(
      resolveSpeaker(
        anchor({
          href: "https://swiatlosila.pl/cyfrowe-prelegent/nieznany/",
          text: "Bartnik",
        }),
        lookup,
      ),
    ).toBeNull();
  });

  it("decodes entities in the anchor text before tokenizing", () => {
    const result = resolveSpeaker(
      anchor({
        href: "https://swiatlosila.pl/cyfrowe-prelegent/nieznany/",
        text: "Bili&#x144;ski Emil",
      }),
      lookup,
    );
    expect(result?.speaker.id).toBe(134);
    expect(result?.tier).toBe("name");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run scripts/__tests__/speakers.test.ts
```

Expected: the run fails with `Failed to resolve import "../lib/speakers"` (the module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/speakers.ts`:

```ts
import type { Speaker } from "../../src/data/types";
import { nameTokens } from "../../src/domain/normalize";
import type { Anchor } from "./parse";
import { decodeEntities } from "./sanitize";

export interface SpeakerLookup {
  bySlug: Map<string, Speaker>;
  byId: Map<number, Speaker>;
  byTokens: { tokens: Set<string>; speaker: Speaker }[];
}

export type ResolveTier = "slug" | "name" | "data-id";

/** Spec §4.2 tier 1: the trailing path segment of a speaker page URL. */
const SLUG_RE = /cyfrowe-prelegent\/([^/]+)\/?$/;
const NUMERIC_RE = /^\d+$/;
const SPEAKER_DATA_TYPE = "cyfrowe-prelegent";

export function buildSpeakerLookup(speakers: Speaker[]): SpeakerLookup {
  const bySlug = new Map<string, Speaker>();
  const byId = new Map<number, Speaker>();
  const byTokens: SpeakerLookup["byTokens"] = [];
  for (const speaker of speakers) {
    bySlug.set(speaker.slug, speaker);
    byId.set(speaker.id, speaker);
    byTokens.push({ tokens: nameTokens(speaker.name), speaker });
  }
  return { bySlug, byId, byTokens };
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const token of a) if (!b.has(token)) return false;
  return true;
}

function containsAll(superset: Set<string>, subset: Set<string>): boolean {
  for (const token of subset) if (!superset.has(token)) return false;
  return true;
}

function slugTier(anchor: Anchor, lookup: SpeakerLookup): Speaker | null {
  const slug = SLUG_RE.exec(anchor.href)?.[1];
  if (slug === undefined) return null;
  return lookup.bySlug.get(slug) ?? null;
}

function nameTier(anchor: Anchor, lookup: SpeakerLookup): Speaker | null {
  const tokens = nameTokens(decodeEntities(anchor.text));
  if (tokens.size === 0) return null;
  const exact = lookup.byTokens.filter((entry) => sameSet(entry.tokens, tokens));
  if (exact.length === 1) return exact[0]?.speaker ?? null;
  if (exact.length > 1 || tokens.size < 2) return null;
  const containing = lookup.byTokens.filter((entry) => containsAll(entry.tokens, tokens));
  if (containing.length === 1) return containing[0]?.speaker ?? null;
  return null;
}

function dataIdTier(anchor: Anchor, lookup: SpeakerLookup): Speaker | null {
  if (anchor.dataType !== SPEAKER_DATA_TYPE) return null;
  if (anchor.dataId === null || !NUMERIC_RE.test(anchor.dataId)) return null;
  return lookup.byId.get(Number(anchor.dataId)) ?? null;
}

export function resolveSpeaker(
  anchor: Anchor,
  lookup: SpeakerLookup,
): { speaker: Speaker; tier: ResolveTier } | null {
  const bySlug = slugTier(anchor, lookup);
  if (bySlug !== null) return { speaker: bySlug, tier: "slug" };
  const byName = nameTier(anchor, lookup);
  if (byName !== null) return { speaker: byName, tier: "name" };
  const byDataId = dataIdTier(anchor, lookup);
  if (byDataId !== null) return { speaker: byDataId, tier: "data-id" };
  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run scripts/__tests__/speakers.test.ts
npm run typecheck
```

Expected: 10 tests pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/speakers.ts scripts/__tests__/speakers.test.ts
git commit -m "feat(scripts): resolve speaker anchors by slug, name and data-id" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```

---

### Task 7: API client, normalizer, validator, slot sets, fixtures and the fetch CLI

**Files:**
- Create: `scripts/lib/api.ts`
- Create: `scripts/lib/normalize.ts`
- Create: `scripts/lib/validate.ts`
- Create: `scripts/lib/slot-sets.ts`
- Create: `scripts/lib/fixtures.ts`
- Create: `scripts/fetch-schedule.ts`
- Create: `scripts/__tests__/raw.fixture.ts` (hand-built `RawData` shared by the normalize and validate tests)
- Create: `scripts/__tests__/data.fixture.ts` (hand-built `ScheduleData` helpers shared by the slot-set and fixture tests)
- Test: `scripts/__tests__/api.test.ts`
- Test: `scripts/__tests__/normalize.test.ts`
- Test: `scripts/__tests__/validate.test.ts`
- Test: `scripts/__tests__/slot-sets.test.ts`
- Test: `scripts/__tests__/fixtures.test.ts`

**Interfaces:**
- Consumes:
  - `src/data/types.ts`: `ScheduleData`, `ScheduleMeta`, `Day`, `Location`, `Term`, `Speaker`, `Session`, `SignupStatus`, `Level`.
  - `scripts/lib/sanitize.ts`: `decodeEntities(s: string): string`, `stripTags(html: string): string`, `isBlankHtml(html: string): boolean`, `sanitizeHtml(html: string): string`, `bioHtml(html: string): string`.
  - `scripts/lib/parse.ts`: `paragraphs(html: string): string[]`, `parseTime(text: string): ParsedTime` (`{ start, end, timeText, endDiscarded }`), `extractAnchors(html: string): Anchor[]`, `isSiteHost(host: string): boolean`, `parseByline(text: string, timeText: string, removeTexts: string[]): string | null`, `signupStatusFromTerm(name: string | undefined): SignupStatus`, `parseDay(termName: string, year: number): ParsedDay | null` (`{ id, label, short, labelLong, date }`), `isAllDayEvent(start: number | null, end: number | null, typeSlugs: string[]): boolean`.
  - `scripts/lib/locations.ts`: `parseLocation(name: string): ParsedLocation` (`{ venue, level, room, rule }`), `shortLabel(id: number, parsed: ParsedLocation): { short: string; fromMap: boolean }`, `compareLocations(a: { level: Level; name: string }, b: { level: Level; name: string }): number`.
  - `scripts/lib/speakers.ts` (Task 6): `buildSpeakerLookup`, `resolveSpeaker`, `SpeakerLookup`.
- Produces:
  - `scripts/lib/api.ts`: `WpRendered`, `WpEvent`, `WpTerm`, `WpMedia`, `WpSpeaker`, `TaxonomyName`, `RawData`, `BASE`, `fetchJson<T>(url: string): Promise<T>`, `fetchAllPages<T>(path: string): Promise<T[]>`, `fetchRaw(): Promise<RawData>`.
  - `scripts/lib/normalize.ts`: `interface NormalizeResult { data: ScheduleData; warnings: string[] }`, `normalizeAll(raw: RawData, opts: { year: number; fetchedAt: string; source: string }): NormalizeResult`.
  - `scripts/lib/validate.ts`: `validate(data: ScheduleData, raw: RawData): { errors: string[]; warnings: string[] }`.
  - `scripts/lib/slot-sets.ts`: `interface SlotSetDef { id: string; day: string; typeIds?: number[]; locationIds?: number[] }`, `SLOT_SETS: SlotSetDef[]`, `slotSetMembers(def: SlotSetDef, data: ScheduleData): Session[]`.
  - `scripts/lib/fixtures.ts`: `buildSlotSetsFixture(data: ScheduleData): Record<string, { id: string; start: number; end: number | null }[]>`, `buildFriLecturesFixture(data: ScheduleData): ScheduleData`.
  - `scripts/fetch-schedule.ts`: the `npm run fetch` CLI (Task 8 runs it); `--fixtures` also writes `src/test/fixtures/slot-sets.json` and `src/test/fixtures/fri-lectures.json`.

Warning ownership, so nothing is reported twice: `normalizeAll` reports what only the raw parse can see (end discarded, every anchor resolved by the `name` or `data-id` tier, unresolved anchors, location terms reaching rule 6 outside the four expected names, location terms missing from `SHORT_LABELS`). `validate` reports what the finished data shows (sessions without a parseable time, sessions of 300 minutes or more that are not `allDay`, speakers without a photo) plus the three fatal conditions of spec §4.4. The CLI prints `[...normalize.warnings, ...validate.warnings]`.

- [ ] **Step 1: Write the failing API test**

Create `scripts/__tests__/api.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE, fetchAllPages, fetchJson, fetchRaw } from "../lib/api";

type FetchArgs = [input: string | URL | Request, init?: RequestInit];

// Exact body the WordPress REST API returns for a page past the last one (observed on 2026-09-03).
const PAGE_OVERFLOW = {
  code: "rest_post_invalid_page_number",
  message: "Liczba żądanych stron jest większa niż liczba dostępnych stron.",
  data: { status: 400 },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function pageOf(url: string): number {
  return Number(new URL(url).searchParams.get("page") ?? "0");
}

function stubFetch(handler: (url: string) => Response) {
  const mock = vi.fn((...args: FetchArgs) => Promise.resolve(handler(String(args[0]))));
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchJson", () => {
  it("returns the parsed body and sends a browser-like User-Agent", async () => {
    const mock = stubFetch(() => json({ ok: true }));
    await expect(fetchJson<{ ok: boolean }>(`${BASE}/cyfrowe-event-day?per_page=100`)).resolves.toEqual({
      ok: true,
    });
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      `${BASE}/cyfrowe-event-day?per_page=100`,
      expect.objectContaining({
        headers: expect.objectContaining({ "User-Agent": expect.stringContaining("Mozilla/5.0") }),
      }),
    );
  });

  it("rejects on a non-2xx response", async () => {
    stubFetch(() => new Response("Service Unavailable", { status: 503 }));
    await expect(fetchJson(`${BASE}/cyfrowe-event`)).rejects.toThrow(/HTTP 503/);
  });
});

describe("fetchAllPages", () => {
  it("concatenates pages until the API reports rest_post_invalid_page_number", async () => {
    const mock = stubFetch((url) => {
      switch (pageOf(url)) {
        case 1:
          return json([{ id: 1 }, { id: 2 }]);
        case 2:
          return json([{ id: 3 }]);
        default:
          return json(PAGE_OVERFLOW, 400);
      }
    });
    const items = await fetchAllPages<{ id: number }>("/cyfrowe-event");
    expect(items.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(mock.mock.calls.map((call) => String(call[0]))).toEqual([
      `${BASE}/cyfrowe-event?per_page=100&page=1`,
      `${BASE}/cyfrowe-event?per_page=100&page=2`,
      `${BASE}/cyfrowe-event?per_page=100&page=3`,
    ]);
  });

  it("appends the paging parameters to an existing query string", async () => {
    const mock = stubFetch((url) => (pageOf(url) === 1 ? json([{ id: 7 }]) : json(PAGE_OVERFLOW, 400)));
    await fetchAllPages("/cyfrowe-prelegent?_embed=1");
    expect(String(mock.mock.calls[0]?.[0])).toBe(`${BASE}/cyfrowe-prelegent?_embed=1&per_page=100&page=1`);
  });

  it("stops on an empty page", async () => {
    const mock = stubFetch(() => json([]));
    await expect(fetchAllPages("/cyfrowe-event")).resolves.toEqual([]);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("rethrows failures other than the page overflow", async () => {
    stubFetch((url) => (pageOf(url) === 1 ? json([{ id: 1 }]) : new Response("boom", { status: 500 })));
    await expect(fetchAllPages("/cyfrowe-event")).rejects.toThrow(/HTTP 500/);
  });
});

describe("fetchRaw", () => {
  it("fetches events, the seven taxonomies and embedded speakers", async () => {
    const mock = stubFetch((url) => {
      const { pathname } = new URL(url);
      if (pathname.endsWith("/cyfrowe-event")) {
        return pageOf(url) === 1 ? json([{ id: 100 }]) : json(PAGE_OVERFLOW, 400);
      }
      if (pathname.endsWith("/cyfrowe-prelegent")) {
        return pageOf(url) === 1 ? json([{ id: 200 }]) : json(PAGE_OVERFLOW, 400);
      }
      return json([{ id: 1, taxonomy: pathname.split("/").pop() }]);
    });
    const raw = await fetchRaw();
    expect(raw.events.map((event) => event.id)).toEqual([100]);
    expect(raw.speakers.map((speaker) => speaker.id)).toEqual([200]);
    expect(Object.keys(raw.terms).sort()).toEqual([
      "cyfrowe-event-brand",
      "cyfrowe-event-day",
      "cyfrowe-event-location",
      "cyfrowe-event-theme",
      "cyfrowe-event-type",
      "cyfrowe-event-zapisy",
      "cyfrowe-prelegent-type",
    ]);
    expect(raw.terms["cyfrowe-event-day"][0]?.taxonomy).toBe("cyfrowe-event-day");
    const urls = mock.mock.calls.map((call) => String(call[0]));
    expect(urls).toContain(`${BASE}/cyfrowe-prelegent-type?per_page=100`);
    expect(urls).toContain(`${BASE}/cyfrowe-prelegent?_embed=1&per_page=100&page=1`);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run scripts/__tests__/api.test.ts
```

Expected: fails with `Failed to resolve import "../lib/api"`.

- [ ] **Step 3: Write `scripts/lib/api.ts`**

```ts
export interface WpRendered {
  rendered: string;
}

export interface WpEvent {
  id: number;
  slug: string;
  link: string;
  title: WpRendered;
  content: WpRendered;
  "cyfrowe-event-type": number[];
  "cyfrowe-event-theme": number[];
  "cyfrowe-event-brand": number[];
  "cyfrowe-event-location": number[];
  "cyfrowe-event-day": number[];
  "cyfrowe-event-zapisy": number[];
}

export interface WpTerm {
  id: number;
  slug: string;
  name: string;
  count: number;
  taxonomy: string;
}

export interface WpMedia {
  source_url: string;
  media_details?: {
    sizes?: Record<string, { source_url: string; width: number; height: number }>;
  };
}

export interface WpSpeaker {
  id: number;
  slug: string;
  link: string;
  title: WpRendered;
  content: WpRendered;
  featured_media: number;
  "cyfrowe-prelegent-type": number[];
  _embedded?: { "wp:featuredmedia"?: WpMedia[] };
}

export type TaxonomyName =
  | "cyfrowe-event-type"
  | "cyfrowe-event-theme"
  | "cyfrowe-event-brand"
  | "cyfrowe-event-location"
  | "cyfrowe-event-day"
  | "cyfrowe-event-zapisy"
  | "cyfrowe-prelegent-type";

export interface RawData {
  events: WpEvent[];
  speakers: WpSpeaker[];
  terms: Record<TaxonomyName, WpTerm[]>;
}

export const BASE = "https://swiatlosila.pl/wp-json/wp/v2";

const TAXONOMIES: readonly TaxonomyName[] = [
  "cyfrowe-event-type",
  "cyfrowe-event-theme",
  "cyfrowe-event-brand",
  "cyfrowe-event-location",
  "cyfrowe-event-day",
  "cyfrowe-event-zapisy",
  "cyfrowe-prelegent-type",
];

const PER_PAGE = 100;
const PAGE_OVERFLOW_CODE = "rest_post_invalid_page_number";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/** Internal, used only here: a non-2xx response, carrying the WP error code when the body had one. */
class HttpError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(url: string, status: number, code: string | null) {
    super(`HTTP ${status}${code === null ? "" : ` (${code})`} for ${url}`);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

async function wpErrorCode(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json();
    if (typeof body === "object" && body !== null && "code" in body && typeof body.code === "string") {
      return body.code;
    }
  } catch {
    // The body was not JSON; the status alone is reported.
  }
  return null;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new HttpError(url, res.status, await wpErrorCode(res));
  return (await res.json()) as T;
}

export async function fetchAllPages<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${BASE}${path}${separator}per_page=${PER_PAGE}&page=${page}`;
    let batch: T[];
    try {
      batch = await fetchJson<T[]>(url);
    } catch (err) {
      if (err instanceof HttpError && err.code === PAGE_OVERFLOW_CODE) break;
      throw err;
    }
    items.push(...batch);
    if (batch.length === 0) break;
  }
  return items;
}

export async function fetchRaw(): Promise<RawData> {
  const events = await fetchAllPages<WpEvent>("/cyfrowe-event");
  const terms: Record<TaxonomyName, WpTerm[]> = {
    "cyfrowe-event-type": [],
    "cyfrowe-event-theme": [],
    "cyfrowe-event-brand": [],
    "cyfrowe-event-location": [],
    "cyfrowe-event-day": [],
    "cyfrowe-event-zapisy": [],
    "cyfrowe-prelegent-type": [],
  };
  for (const taxonomy of TAXONOMIES) {
    terms[taxonomy] = await fetchJson<WpTerm[]>(`${BASE}/${taxonomy}?per_page=${PER_PAGE}`);
  }
  const speakers = await fetchAllPages<WpSpeaker>("/cyfrowe-prelegent?_embed=1");
  return { events, speakers, terms };
}
```

- [ ] **Step 4: Run the API tests to verify they pass, then commit**

```bash
npx vitest run scripts/__tests__/api.test.ts
npm run typecheck
git add scripts/lib/api.ts scripts/__tests__/api.test.ts
git commit -m "feat(scripts): add WordPress REST client with paging" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```

Expected: 7 tests pass.

- [ ] **Step 5: Write the hand-built raw fixture**

Three events (a Friday lecture with a stale-slug speaker anchor and a cyfrowe.pl signup link, a dual-day 09:00–18:00 `Ogólne` zone whose first `<p>` is blank, a Thursday point event with a plain-text byline), two speakers listed out of id order, and term lists that are deliberately unsorted and include unused terms. Term ids, slugs and names copy the real snapshot where one exists (day terms 276/53/18/19, type 184/242, locations 233/318/291, zapisy 56/194/327). Create `scripts/__tests__/raw.fixture.ts`:

```ts
import type { RawData, WpEvent, WpSpeaker, WpTerm } from "../lib/api";

const SITE = "https://swiatlosila.pl";
const UPLOADS = `${SITE}/wp-content/uploads/2024/08`;

function term(id: number, slug: string, name: string, count: number, taxonomy: string): WpTerm {
  return { id, slug, name, count, taxonomy };
}

/** A fresh, mutable RawData on every call; tests may edit the result freely. */
export function makeRaw(): RawData {
  const events: WpEvent[] = [
    {
      id: 1001,
      slug: "swiatlo-wstep",
      link: `${SITE}/cyfrowe-event/swiatlo-wstep/`,
      title: { rendered: "Światło &#8211; wstęp" },
      content: {
        rendered:
          "<!-- wp:paragraph -->\n" +
          '<p>10:45-12:00, <a href="https://swiatlosila.pl/cyfrowe-prelegent/jimmy-salatka/" data-type="cyfrowe-prelegent" data-id="134">Biliński Emil</a> ' +
          '<a href="https://www.cyfrowe.pl/swiatlosila-wstep-p.html" data-type="link" data-id="https://www.cyfrowe.pl/swiatlosila-wstep-p.html" target="_blank" rel="noreferrer noopener">Zapisz się</a></p>\n' +
          "<!-- /wp:paragraph -->\n" +
          "<!-- wp:paragraph -->\n" +
          "<p>Opis <strong>prelekcji</strong>.</p>\n" +
          "<!-- /wp:paragraph -->",
      },
      "cyfrowe-event-type": [184],
      "cyfrowe-event-theme": [500],
      "cyfrowe-event-brand": [600],
      "cyfrowe-event-location": [233],
      "cyfrowe-event-day": [53],
      "cyfrowe-event-zapisy": [56],
    },
    {
      id: 1002,
      slug: "rejestracja",
      link: `${SITE}/cyfrowe-event/rejestracja/`,
      title: { rendered: "Rejestracja" },
      content: { rendered: "<p></p>\n<p>09:00-18:00</p>" },
      "cyfrowe-event-type": [242],
      "cyfrowe-event-theme": [],
      "cyfrowe-event-brand": [],
      "cyfrowe-event-location": [318],
      "cyfrowe-event-day": [18, 53],
      "cyfrowe-event-zapisy": [],
    },
    {
      id: 1003,
      slug: "otwarcie",
      link: `${SITE}/cyfrowe-event/otwarcie/`,
      title: { rendered: "Otwarcie festiwalu" },
      content: { rendered: "<p>09:30, Cyfrowe.pl</p>" },
      "cyfrowe-event-type": [242, 300],
      "cyfrowe-event-theme": [],
      "cyfrowe-event-brand": [],
      "cyfrowe-event-location": [233],
      "cyfrowe-event-day": [276],
      "cyfrowe-event-zapisy": [194],
    },
  ];

  const speakers: WpSpeaker[] = [
    {
      id: 134,
      slug: "emil-bilinski-x",
      link: `${SITE}/cyfrowe-prelegent/emil-bilinski-x/`,
      title: { rendered: "Emil Biliński" },
      content: { rendered: "<p>Bio.</p><p>&#8212;&#8212;&#8212;&#8211;</p><p>Talk.</p>" },
      featured_media: 292,
      "cyfrowe-prelegent-type": [24, 40],
      _embedded: {
        "wp:featuredmedia": [
          {
            source_url: `${UPLOADS}/600_Bilinski_Emil_profoto.jpg`,
            media_details: {
              sizes: {
                medium: { source_url: `${UPLOADS}/600_Bilinski_Emil_profoto-300x300.jpg`, width: 300, height: 300 },
                thumbnail: { source_url: `${UPLOADS}/600_Bilinski_Emil_profoto-150x150.jpg`, width: 150, height: 150 },
                full: { source_url: `${UPLOADS}/600_Bilinski_Emil_profoto.jpg`, width: 600, height: 600 },
              },
            },
          },
        ],
      },
    },
    {
      id: 128,
      slug: "karol-bartnik-2",
      link: `${SITE}/cyfrowe-prelegent/karol-bartnik-2/`,
      title: { rendered: "Karol Bartnik" },
      content: { rendered: "<p>Bio Karola.</p>" },
      featured_media: 0,
      "cyfrowe-prelegent-type": [24],
    },
  ];

  const terms: RawData["terms"] = {
    "cyfrowe-event-type": [
      term(184, "prelekcja", "Prelekcja", 1, "cyfrowe-event-type"),
      term(242, "ogolne", "Ogólne", 2, "cyfrowe-event-type"),
      term(300, "cwiczenia", "Ćwiczenia", 1, "cyfrowe-event-type"),
      term(301, "fotogra", "Fotogra", 0, "cyfrowe-event-type"),
    ],
    "cyfrowe-event-theme": [term(500, "krajobraz", "Krajobraz", 1, "cyfrowe-event-theme")],
    "cyfrowe-event-brand": [term(600, "sony", "Sony", 1, "cyfrowe-event-brand")],
    "cyfrowe-event-location": [
      term(233, "so-salsa-sala-1", "So Salsa - poziom II - Sala wykładowa nr 1", 2, "cyfrowe-event-location"),
      term(318, "rejestracja", "Rejestracja", 1, "cyfrowe-event-location"),
      term(291, "wkrotce", "Wkrótce", 0, "cyfrowe-event-location"),
    ],
    "cyfrowe-event-day": [
      term(276, "czwartek", "⏱️ Czwartek (3 września)", 1, "cyfrowe-event-day"),
      term(18, "sobota", "⏱️ Sobota (5 września)", 1, "cyfrowe-event-day"),
      term(53, "piatek", "⏱️ Piątek (4 września)", 2, "cyfrowe-event-day"),
      term(19, "sobota-7", "⏱️ Sobota (7 września)", 0, "cyfrowe-event-day"),
    ],
    "cyfrowe-event-zapisy": [
      term(56, "zapisy", "Zapisy", 1, "cyfrowe-event-zapisy"),
      term(194, "w-ramach-festiwalu", "W ramach festiwalu", 1, "cyfrowe-event-zapisy"),
      term(327, "brak-miejsc", "Brak miejsc", 0, "cyfrowe-event-zapisy"),
    ],
    "cyfrowe-prelegent-type": [
      term(24, "prelegent", "Prelegent", 2, "cyfrowe-prelegent-type"),
      term(40, "sony", "Sony", 1, "cyfrowe-prelegent-type"),
    ],
  };

  return { events, speakers, terms };
}
```

- [ ] **Step 6: Write the failing normalize test**

Create `scripts/__tests__/normalize.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { WpSpeaker } from "../lib/api";
import { normalizeAll } from "../lib/normalize";
import { makeRaw } from "./raw.fixture";

const OPTS = {
  year: 2026,
  fetchedAt: "2026-09-03T12:00:00.000Z",
  source: "https://swiatlosila.pl/harmonogram-2026/",
};

const UPLOADS = "https://swiatlosila.pl/wp-content/uploads/2024/08";

describe("normalizeAll", () => {
  const { data, warnings } = normalizeAll(makeRaw(), OPTS);

  it("fills meta with the options and counts", () => {
    expect(data.meta).toEqual({
      source: OPTS.source,
      fetchedAt: OPTS.fetchedAt,
      year: 2026,
      version: 1,
      eventCount: 3,
      sessionCount: 4,
      speakerCount: 2,
    });
  });

  it("emits only day terms in use, sorted by date", () => {
    expect(data.days.map((day) => day.id)).toEqual(["czw", "pt", "sob"]);
    expect(data.days[1]).toEqual({
      id: "pt",
      termId: 53,
      date: "2026-09-04",
      label: "Piątek",
      short: "Pt",
      labelLong: "Piątek, 4 września",
    });
  });

  it("emits locations in use in level-then-name order with parsed fields", () => {
    expect(data.locations.map((location) => location.id)).toEqual([233, 318]);
    expect(data.locations[0]).toEqual({
      id: 233,
      slug: "so-salsa-sala-1",
      name: "So Salsa - poziom II - Sala wykładowa nr 1",
      count: 2,
      venue: "So Salsa",
      level: "II",
      room: "Sala wykładowa nr 1",
      short: "Sala wykł. 1",
      order: 0,
    });
    expect(data.locations[1]).toMatchObject({
      id: 318,
      venue: "Rejestracja",
      level: null,
      room: null,
      short: "Rejestracja",
      order: 1,
    });
  });

  it("sorts term arrays by name with Polish collation and drops unused terms", () => {
    expect(data.types.map((t) => t.name)).toEqual(["Ćwiczenia", "Ogólne", "Prelekcja"]);
    expect(data.themes.map((t) => t.id)).toEqual([500]);
    expect(data.brands.map((t) => t.id)).toEqual([600]);
    expect(data.signupStatuses.map((t) => t.name)).toEqual(["W ramach festiwalu", "Zapisy"]);
  });

  it("emits speakers sorted by id with photos, bios and brands", () => {
    expect(data.speakers.map((s) => s.id)).toEqual([128, 134]);
    const emil = data.speakers[1];
    expect(emil).toMatchObject({
      id: 134,
      slug: "emil-bilinski-x",
      name: "Emil Biliński",
      url: "https://swiatlosila.pl/cyfrowe-prelegent/emil-bilinski-x/",
      photo: `${UPLOADS}/600_Bilinski_Emil_profoto.jpg`,
      photoThumb: `${UPLOADS}/600_Bilinski_Emil_profoto-300x300.jpg`,
      brands: ["Sony"],
    });
    expect(emil?.bioHtml).toMatch(/^<p>Bio\.<\/p>\s*<hr>\s*<p>Talk\.<\/p>$/);
    expect(data.speakers[0]).toMatchObject({
      id: 128,
      name: "Karol Bartnik",
      photo: null,
      photoThumb: null,
      brands: [],
    });
  });

  it("creates one session per (event, day), ordered by event id then day position", () => {
    expect(data.sessions.map((s) => s.id)).toEqual(["1001:pt", "1002:pt", "1002:sob", "1003:czw"]);
  });

  it("parses time, speakers, byline, signup and description of a lecture", () => {
    const session = data.sessions.find((s) => s.id === "1001:pt");
    expect(session).toEqual({
      id: "1001:pt",
      eventId: 1001,
      day: "pt",
      title: "Światło – wstęp",
      start: 645,
      end: 720,
      allDay: false,
      timeText: "10:45-12:00",
      speakerIds: [134],
      byline: null,
      typeIds: [184],
      themeIds: [500],
      brandIds: [600],
      locationIds: [233],
      signup: { status: "open", url: "https://www.cyfrowe.pl/swiatlosila-wstep-p.html", label: "Zapisy" },
      descriptionHtml: "<p>Opis <strong>prelekcji</strong>.</p>",
      url: "https://swiatlosila.pl/cyfrowe-event/swiatlo-wstep/",
    });
  });

  it("marks a 09:00-18:00 Ogólne zone as allDay on both of its days, skipping the blank first <p>", () => {
    const zone = data.sessions.filter((s) => s.eventId === 1002);
    expect(zone.map((s) => s.day)).toEqual(["pt", "sob"]);
    for (const session of zone) {
      expect(session).toMatchObject({
        start: 540,
        end: 1080,
        allDay: true,
        timeText: "09:00-18:00",
        speakerIds: [],
        byline: null,
        signup: { status: "unknown", url: null, label: "Brak informacji" },
        descriptionHtml: "",
      });
    }
  });

  it("keeps a point time, a plain-text byline and term-array ordering of typeIds", () => {
    const session = data.sessions.find((s) => s.id === "1003:czw");
    expect(session).toMatchObject({
      start: 570,
      end: null,
      allDay: false,
      timeText: "09:30",
      byline: "Cyfrowe.pl",
      typeIds: [300, 242],
      signup: { status: "included", url: null, label: "W ramach festiwalu" },
    });
  });

  it("warns exactly once, about the anchor resolved by name", () => {
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^Event 1001 .*resolved by name to 134 Emil Biliński$/);
  });

  it("leaves an anchor whose text matches two speakers by name unresolved and keeps its text in the byline", () => {
    const raw = makeRaw();
    const twin = (id: number, slug: string): WpSpeaker => ({
      id,
      slug,
      link: `https://swiatlosila.pl/cyfrowe-prelegent/${slug}/`,
      title: { rendered: "Jan Kowalski" },
      content: { rendered: "<p>Bio.</p>" },
      featured_media: 0,
      "cyfrowe-prelegent-type": [24],
    });
    raw.speakers.push(twin(901, "jan-kowalski"), twin(902, "jan-kowalski-2"));
    raw.events.push({
      id: 1004,
      slug: "swiatlo-w-studio",
      link: "https://swiatlosila.pl/cyfrowe-event/swiatlo-w-studio/",
      title: { rendered: "Światło w studio" },
      content: {
        rendered:
          '<p>13:00-14:00, <a href="https://swiatlosila.pl/cyfrowe-prelegent/stary-slug/">Kowalski Jan</a></p>',
      },
      "cyfrowe-event-type": [184],
      "cyfrowe-event-theme": [],
      "cyfrowe-event-brand": [],
      "cyfrowe-event-location": [233],
      "cyfrowe-event-day": [53],
      "cyfrowe-event-zapisy": [],
    });
    const result = normalizeAll(raw, OPTS);
    const session = result.data.sessions.find((s) => s.id === "1004:pt");
    expect(session).toMatchObject({ speakerIds: [], byline: "Kowalski Jan" });
    expect(result.warnings).toContainEqual(expect.stringContaining("did not resolve; its text stays in the byline"));
    expect(result.warnings.filter((w) => w.startsWith("Event 1004 "))).toEqual([
      'Event 1004 "Światło w studio": speaker anchor "Kowalski Jan" (https://swiatlosila.pl/cyfrowe-prelegent/stary-slug/) did not resolve; its text stays in the byline',
    ]);
  });

  it("produces identical data regardless of the raw input order", () => {
    const raw = makeRaw();
    raw.events.reverse();
    raw.speakers.reverse();
    for (const list of Object.values(raw.terms)) list.reverse();
    expect(normalizeAll(raw, OPTS).data).toEqual(data);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

```bash
npx vitest run scripts/__tests__/normalize.test.ts
```

Expected: fails with `Failed to resolve import "../lib/normalize"`.

- [ ] **Step 8: Write `scripts/lib/normalize.ts`**

```ts
import type {
  Day,
  Location,
  ScheduleData,
  ScheduleMeta,
  Session,
  Speaker,
  Term,
} from "../../src/data/types";
import type { RawData, WpEvent, WpSpeaker, WpTerm } from "./api";
import { compareLocations, parseLocation, shortLabel } from "./locations";
import {
  extractAnchors,
  isAllDayEvent,
  isSiteHost,
  paragraphs,
  parseByline,
  parseDay,
  parseTime,
  signupStatusFromTerm,
} from "./parse";
import { bioHtml, decodeEntities, isBlankHtml, sanitizeHtml, stripTags } from "./sanitize";
import { buildSpeakerLookup, resolveSpeaker } from "./speakers";
import type { SpeakerLookup } from "./speakers";

export interface NormalizeResult {
  data: ScheduleData;
  warnings: string[];
}

const collator = new Intl.Collator("pl");

/** Location names that are expected to reach parsing rule 6 (spec §4.2); any other rule-6 term is reported. */
const EXPECTED_RULE6_NAMES = new Set(["Rejestracja", "W4", "Wkrótce", "ZERO ZERO (przed wejściem)"]);

const NO_SIGNUP_LABEL = "Brak informacji";
const PRELEGENT_BRAND = "Prelegent";

function compareByName(a: Term, b: Term): number {
  return collator.compare(a.name, b.name) || a.id - b.id;
}

function toTerm(term: WpTerm): Term {
  return { id: term.id, slug: term.slug, name: decodeEntities(term.name), count: term.count };
}

function termsInUse(terms: WpTerm[]): Term[] {
  return terms
    .filter((term) => term.count > 0)
    .map(toTerm)
    .sort(compareByName);
}

function buildDays(terms: WpTerm[], year: number): Day[] {
  const days: Day[] = [];
  for (const term of terms) {
    if (term.count <= 0) continue;
    const parsed = parseDay(term.name, year);
    if (parsed === null) continue; // validate() turns this into an error
    days.push({
      id: parsed.id,
      termId: term.id,
      date: parsed.date,
      label: parsed.label,
      short: parsed.short,
      labelLong: parsed.labelLong,
    });
  }
  return days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function buildLocations(terms: WpTerm[], warnings: string[]): Location[] {
  // Every fetched term is parsed and checked, even those with count 0 (spec §4.2).
  const parsedTerms = terms.map((term) => {
    const name = decodeEntities(term.name);
    const parsed = parseLocation(name);
    const { short, fromMap } = shortLabel(term.id, parsed);
    if (parsed.rule === 6 && !EXPECTED_RULE6_NAMES.has(name)) {
      warnings.push(`Location ${term.id} "${name}" matched no parsing rule (fell through to rule 6)`);
    }
    if (!fromMap) {
      warnings.push(`Location ${term.id} "${name}" is missing from SHORT_LABELS (using "${short}")`);
    }
    return { term, name, parsed, short };
  });
  return parsedTerms
    .filter((entry) => entry.term.count > 0)
    .sort((a, b) =>
      compareLocations({ level: a.parsed.level, name: a.name }, { level: b.parsed.level, name: b.name }),
    )
    .map(
      (entry, order): Location => ({
        id: entry.term.id,
        slug: entry.term.slug,
        name: entry.name,
        count: entry.term.count,
        venue: entry.parsed.venue,
        level: entry.parsed.level,
        room: entry.parsed.room,
        short: entry.short,
        order,
      }),
    );
}

function photoUrls(speaker: WpSpeaker): { photo: string | null; photoThumb: string | null } {
  const media = speaker._embedded?.["wp:featuredmedia"]?.[0];
  if (speaker.featured_media === 0 || media === undefined || typeof media.source_url !== "string") {
    return { photo: null, photoThumb: null };
  }
  const sizes = media.media_details?.sizes ?? {};
  const photo = sizes["large"]?.source_url ?? sizes["full"]?.source_url ?? media.source_url;
  const photoThumb = sizes["medium"]?.source_url ?? sizes["thumbnail"]?.source_url ?? photo;
  return { photo, photoThumb };
}

function buildSpeakers(raw: RawData): Speaker[] {
  const brandNames = new Map(
    raw.terms["cyfrowe-prelegent-type"].map((term) => [term.id, decodeEntities(term.name)] as const),
  );
  return raw.speakers
    .map((speaker): Speaker => {
      const { photo, photoThumb } = photoUrls(speaker);
      const brands = speaker["cyfrowe-prelegent-type"]
        .map((id) => brandNames.get(id))
        .filter((name): name is string => name !== undefined && name !== PRELEGENT_BRAND);
      return {
        id: speaker.id,
        slug: speaker.slug,
        name: decodeEntities(speaker.title.rendered),
        photo,
        photoThumb,
        bioHtml: bioHtml(speaker.content.rendered),
        url: speaker.link,
        brands,
      };
    })
    .sort((a, b) => a.id - b.id);
}

interface SessionContext {
  lookup: SpeakerLookup;
  typeOrder: number[];
  themeOrder: number[];
  brandOrder: number[];
  locationOrder: number[];
  typeSlugById: Map<number, string>;
  signupNameById: Map<number, string>;
}

type EventFields = Omit<Session, "id" | "eventId" | "day">;

/** Ids in term-array order first, then any id the term arrays do not know (validate() reports those). */
function orderIds(ids: number[], order: number[]): number[] {
  const wanted = new Set(ids);
  const known = order.filter((id) => wanted.has(id));
  const knownSet = new Set(known);
  return [...known, ...ids.filter((id) => !knownSet.has(id))];
}

function parseEvent(event: WpEvent, ctx: SessionContext, warnings: string[]): EventFields {
  const title = decodeEntities(event.title.rendered);
  const label = `Event ${event.id} "${title}"`;

  const allParagraphs = paragraphs(event.content.rendered);
  const firstIndex = allParagraphs.findIndex((p) => !isBlankHtml(p));
  const firstHtml = firstIndex === -1 ? "" : (allParagraphs[firstIndex] ?? "");
  const rest = firstIndex === -1 ? [] : allParagraphs.slice(firstIndex + 1);
  const text = stripTags(firstHtml);

  const time = parseTime(text);
  if (time.endDiscarded) {
    warnings.push(`${label}: end is not after start in "${time.timeText}", end discarded`);
  }

  const anchors = extractAnchors(firstHtml);
  const signupAnchor = anchors.find((anchor) => !isSiteHost(anchor.host)) ?? null;
  const removeTexts: string[] = signupAnchor === null ? [] : [stripTags(signupAnchor.text)];
  const speakerIds: number[] = [];
  for (const anchor of anchors) {
    if (!isSiteHost(anchor.host)) continue;
    const resolved = resolveSpeaker(anchor, ctx.lookup);
    if (resolved === null) {
      warnings.push(
        `${label}: speaker anchor "${anchor.text}" (${anchor.href}) did not resolve; its text stays in the byline`,
      );
      continue;
    }
    if (resolved.tier !== "slug") {
      warnings.push(
        `${label}: speaker anchor "${anchor.text}" (${anchor.href}) resolved by ${resolved.tier} to ${resolved.speaker.id} ${resolved.speaker.name}`,
      );
    }
    if (!speakerIds.includes(resolved.speaker.id)) speakerIds.push(resolved.speaker.id);
    removeTexts.push(stripTags(anchor.text));
  }

  const signupName = event["cyfrowe-event-zapisy"]
    .map((id) => ctx.signupNameById.get(id))
    .find((name) => name !== undefined);
  const typeSlugs = event["cyfrowe-event-type"].flatMap((id) => {
    const slug = ctx.typeSlugById.get(id);
    return slug === undefined ? [] : [slug];
  });

  return {
    title,
    start: time.start,
    end: time.end,
    allDay: isAllDayEvent(time.start, time.end, typeSlugs),
    timeText: time.timeText,
    speakerIds,
    byline: parseByline(text, time.timeText, removeTexts),
    typeIds: orderIds(event["cyfrowe-event-type"], ctx.typeOrder),
    themeIds: orderIds(event["cyfrowe-event-theme"], ctx.themeOrder),
    brandIds: orderIds(event["cyfrowe-event-brand"], ctx.brandOrder),
    locationIds: orderIds(event["cyfrowe-event-location"], ctx.locationOrder),
    signup: {
      status: signupStatusFromTerm(signupName),
      url: signupAnchor?.href ?? null,
      label: signupName ?? NO_SIGNUP_LABEL,
    },
    descriptionHtml: sanitizeHtml(rest.map((p) => `<p>${p}</p>`).join("")),
    url: event.link,
  };
}

function buildSessions(raw: RawData, days: Day[], ctx: SessionContext, warnings: string[]): Session[] {
  const dayByTermId = new Map(days.map((day) => [day.termId, day] as const));
  const dayPosition = new Map(days.map((day, index) => [day.id, index] as const));
  const sessions: Session[] = [];
  for (const event of raw.events) {
    const fields = parseEvent(event, ctx, warnings);
    for (const termId of event["cyfrowe-event-day"]) {
      const day = dayByTermId.get(termId);
      if (day === undefined) continue; // validate() reports unknown and unparseable day terms
      // Key order here is the on-disk key order (spec §4.5); JSON.stringify keeps insertion order.
      sessions.push({ id: `${event.id}:${day.id}`, eventId: event.id, day: day.id, ...fields });
    }
  }
  return sessions.sort(
    (a, b) => a.eventId - b.eventId || (dayPosition.get(a.day) ?? 0) - (dayPosition.get(b.day) ?? 0),
  );
}

export function normalizeAll(
  raw: RawData,
  opts: { year: number; fetchedAt: string; source: string },
): NormalizeResult {
  const warnings: string[] = [];
  const days = buildDays(raw.terms["cyfrowe-event-day"], opts.year);
  const locations = buildLocations(raw.terms["cyfrowe-event-location"], warnings);
  const types = termsInUse(raw.terms["cyfrowe-event-type"]);
  const themes = termsInUse(raw.terms["cyfrowe-event-theme"]);
  const brands = termsInUse(raw.terms["cyfrowe-event-brand"]);
  const signupStatuses = termsInUse(raw.terms["cyfrowe-event-zapisy"]);
  const speakers = buildSpeakers(raw);
  const ctx: SessionContext = {
    lookup: buildSpeakerLookup(speakers),
    typeOrder: types.map((term) => term.id),
    themeOrder: themes.map((term) => term.id),
    brandOrder: brands.map((term) => term.id),
    locationOrder: locations.map((location) => location.id),
    typeSlugById: new Map(raw.terms["cyfrowe-event-type"].map((term) => [term.id, term.slug] as const)),
    signupNameById: new Map(
      raw.terms["cyfrowe-event-zapisy"].map((term) => [term.id, decodeEntities(term.name)] as const),
    ),
  };
  const sessions = buildSessions(raw, days, ctx, warnings);
  const meta: ScheduleMeta = {
    source: opts.source,
    fetchedAt: opts.fetchedAt,
    year: opts.year,
    version: 1,
    eventCount: raw.events.length,
    sessionCount: sessions.length,
    speakerCount: speakers.length,
  };
  // Top-level key order is the on-disk key order (spec §4.1 step 5).
  return {
    data: { meta, days, locations, types, themes, brands, signupStatuses, speakers, sessions },
    warnings,
  };
}
```

- [ ] **Step 9: Run the normalize tests to verify they pass**

```bash
npx vitest run scripts/__tests__/normalize.test.ts
```

Expected: 12 tests pass. If `bioHtml` or `descriptionHtml` assertions fail on whitespace only, the sanitizer from the earlier task is emitting text nodes between paragraphs; fix the sanitizer (spec §4.3 keeps no text outside allowed elements' content), not the assertion.

- [ ] **Step 10: Write the failing validate test**

Create `scripts/__tests__/validate.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { RawData, WpEvent } from "../lib/api";
import { normalizeAll } from "../lib/normalize";
import { validate } from "../lib/validate";
import { makeRaw } from "./raw.fixture";

const OPTS = {
  year: 2026,
  fetchedAt: "2026-09-03T12:00:00.000Z",
  source: "https://swiatlosila.pl/harmonogram-2026/",
};

function eventOf(raw: RawData, id: number): WpEvent {
  const event = raw.events.find((e) => e.id === id);
  if (event === undefined) throw new Error(`fixture has no event ${id}`);
  return event;
}

/** Pads the fixture with 50 Friday copies of event 1001 so the 50-event floor is met. */
function withManyEvents(raw: RawData): RawData {
  const template = eventOf(raw, 1001);
  const fillers: WpEvent[] = Array.from({ length: 50 }, (_, i) => ({
    ...template,
    id: 5000 + i,
    slug: `filler-${i}`,
    link: `https://swiatlosila.pl/cyfrowe-event/filler-${i}/`,
    content: { rendered: "<p>12:00-13:00</p>" },
    "cyfrowe-event-day": [53],
  }));
  return { ...raw, events: [...raw.events, ...fillers] };
}

function run(raw: RawData): { errors: string[]; warnings: string[] } {
  const { data } = normalizeAll(raw, OPTS);
  return validate(data, raw);
}

describe("validate errors", () => {
  it("accepts a consistent snapshot", () => {
    expect(run(withManyEvents(makeRaw())).errors).toEqual([]);
  });

  it("rejects fewer than 50 events", () => {
    expect(run(makeRaw()).errors).toEqual(["Too few events: 3 (minimum 50)"]);
  });

  it("rejects fewer than 3 days", () => {
    const raw = withManyEvents(makeRaw());
    for (const term of raw.terms["cyfrowe-event-day"]) if (term.id === 276) term.count = 0;
    raw.events = raw.events.filter((e) => e.id !== 1003);
    expect(run(raw).errors).toEqual(["Too few days: 2 (minimum 3)"]);
  });

  it("rejects a day term in use without a parseable date", () => {
    const raw = withManyEvents(makeRaw());
    for (const term of raw.terms["cyfrowe-event-day"]) if (term.id === 276) term.name = "⏱️ Dzień otwarcia";
    const { errors } = run(raw);
    expect(errors).toContain('Day term 276 "⏱️ Dzień otwarcia" has no parseable date');
    expect(errors).toContain("Too few days: 2 (minimum 3)");
    expect(errors).toHaveLength(2);
  });

  it("rejects a session whose location is not a fetched term", () => {
    const raw = withManyEvents(makeRaw());
    eventOf(raw, 1001)["cyfrowe-event-location"] = [999];
    expect(run(raw).errors).toEqual(["Session 1001:pt references unknown location 999"]);
  });

  it("rejects a session whose type is not a fetched term", () => {
    const raw = withManyEvents(makeRaw());
    eventOf(raw, 1001)["cyfrowe-event-type"] = [184, 999];
    expect(run(raw).errors).toEqual(["Session 1001:pt references unknown type 999"]);
  });

  it("rejects an event whose day term was not fetched", () => {
    const raw = withManyEvents(makeRaw());
    eventOf(raw, 1001)["cyfrowe-event-day"] = [53, 999];
    expect(run(raw).errors).toEqual(["Event 1001 references unknown day term 999"]);
  });
});

describe("validate warnings", () => {
  it("warns about a speaker without a photo and nothing else on the fixture", () => {
    expect(run(makeRaw()).warnings).toEqual(["Speaker 128 Karol Bartnik has no photo"]);
  });

  it("warns about a session of 300 minutes or more that is not allDay", () => {
    const raw = makeRaw();
    eventOf(raw, 1001).content = { rendered: "<p>09:30-16:00</p>" };
    expect(run(raw).warnings).toContain('Session 1001:pt "Światło – wstęp" runs 390 minutes but is not allDay');
  });

  it("does not warn about the 540-minute Ogólne zone, which is allDay", () => {
    const { warnings } = run(makeRaw());
    expect(warnings.filter((w) => w.includes("1002:"))).toEqual([]);
  });

  it("warns about a session without a parseable time", () => {
    const raw = makeRaw();
    eventOf(raw, 1001).content = { rendered: "<p>Godzina wkrótce</p>" };
    expect(run(raw).warnings).toContain('Session 1001:pt "Światło – wstęp" has no parseable time');
  });
});
```

- [ ] **Step 11: Run the test to verify it fails**

```bash
npx vitest run scripts/__tests__/validate.test.ts
```

Expected: fails with `Failed to resolve import "../lib/validate"`.

- [ ] **Step 12: Write `scripts/lib/validate.ts`**

```ts
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
```

- [ ] **Step 13: Run the validate tests to verify they pass, then commit**

```bash
npx vitest run scripts/__tests__/normalize.test.ts scripts/__tests__/validate.test.ts
npm run typecheck
git add scripts/lib/normalize.ts scripts/lib/validate.ts scripts/__tests__/raw.fixture.ts scripts/__tests__/normalize.test.ts scripts/__tests__/validate.test.ts
git commit -m "feat(scripts): normalize WordPress events into ScheduleData and validate it" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```

Expected: 23 tests pass (12 normalize, 11 validate).

- [ ] **Step 14: Write the shared ScheduleData test helpers**

Create `scripts/__tests__/data.fixture.ts` (script-side only; the app's `src/test/fixtures/build.ts` is a separate later deliverable):

```ts
import type { Day, Location, ScheduleData, Session, Term } from "../../src/data/types";

/** A complete Session; `id` must be "<eventId>:<dayId>". */
export function sessionOf(id: string, overrides: Partial<Session> = {}): Session {
  const [eventId, day] = id.split(":");
  return {
    id,
    eventId: Number(eventId),
    day: day ?? "pt",
    title: `Sesja ${id}`,
    start: 570,
    end: 630,
    allDay: false,
    timeText: "09:30-10:30",
    speakerIds: [],
    byline: null,
    typeIds: [184],
    themeIds: [],
    brandIds: [],
    locationIds: [233],
    signup: { status: "included", url: null, label: "W ramach festiwalu" },
    descriptionHtml: "",
    url: `https://swiatlosila.pl/cyfrowe-event/${eventId ?? "x"}/`,
    ...overrides,
  };
}

export const DAYS: Day[] = [
  { id: "pt", termId: 53, date: "2026-09-04", label: "Piątek", short: "Pt", labelLong: "Piątek, 4 września" },
  { id: "sob", termId: 18, date: "2026-09-05", label: "Sobota", short: "Sob", labelLong: "Sobota, 5 września" },
];

export const TYPES: Term[] = [
  { id: 242, slug: "ogolne", name: "Ogólne", count: 1 },
  { id: 184, slug: "prelekcja", name: "Prelekcja", count: 4 },
  { id: 278, slug: "prelekcja-z-sesja", name: "Prelekcja z sesją", count: 1 },
  { id: 5, slug: "warsztaty", name: "Warsztaty", count: 1 },
];

export const LOCATIONS: Location[] = [
  {
    id: 233,
    slug: "so-salsa-sala-1",
    name: "So Salsa - poziom II - Sala wykładowa nr 1",
    count: 5,
    venue: "So Salsa",
    level: "II",
    room: "Sala wykładowa nr 1",
    short: "Sala wykł. 1",
    order: 0,
  },
  {
    id: 281,
    slug: "sosalsa-sala-2",
    name: "SoSalsa - poziom II - Sala wykładowa nr 2",
    count: 1,
    venue: "SoSalsa",
    level: "II",
    room: "Sala wykładowa nr 2",
    short: "Sala wykł. 2",
    order: 1,
  },
  {
    id: 318,
    slug: "rejestracja",
    name: "Rejestracja",
    count: 1,
    venue: "Rejestracja",
    level: null,
    room: null,
    short: "Rejestracja",
    order: 2,
  },
];

export function dataOf(sessions: Session[]): ScheduleData {
  return {
    meta: {
      source: "https://swiatlosila.pl/harmonogram-2026/",
      fetchedAt: "2026-09-03T12:00:00.000Z",
      year: 2026,
      version: 1,
      eventCount: new Set(sessions.map((s) => s.eventId)).size,
      sessionCount: sessions.length,
      speakerCount: 0,
    },
    days: DAYS,
    locations: LOCATIONS,
    types: TYPES,
    themes: [],
    brands: [],
    signupStatuses: [],
    speakers: [],
    sessions,
  };
}
```

- [ ] **Step 15: Write the failing slot-set test**

Create `scripts/__tests__/slot-sets.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SLOT_SETS, slotSetMembers } from "../lib/slot-sets";
import { dataOf, sessionOf } from "./data.fixture";

const SESSIONS = [
  sessionOf("10:pt", { typeIds: [184], locationIds: [233], start: 570, end: 645 }),
  sessionOf("11:pt", { typeIds: [278], locationIds: [281], start: 660, end: 735 }),
  sessionOf("12:pt", { typeIds: [5], locationIds: [233], start: 570, end: 960 }),
  sessionOf("13:sob", { typeIds: [184], locationIds: [233], start: 600, end: 675 }),
  sessionOf("14:pt", { typeIds: [242], locationIds: [318], start: 540, end: 1080, allDay: true }),
  sessionOf("15:pt", { typeIds: [184], locationIds: [233], start: null, end: null, timeText: "" }),
  sessionOf("16:pt", { typeIds: [184], locationIds: [233], start: 810, end: null, timeText: "13:30" }),
];
const DATA = dataOf(SESSIONS);

function byId(id: string) {
  return SLOT_SETS.find((def) => def.id === id);
}

describe("SLOT_SETS", () => {
  it("defines the eight calibration sets of spec §5.2 in table order", () => {
    expect(SLOT_SETS.map((def) => def.id)).toEqual([
      "sat-lectures",
      "sat-prelekcja-only",
      "fri-lectures",
      "fri-prelekcja-only",
      "fri-lecture-rooms",
      "fri-all",
      "sat-all",
      "fri-equipment",
    ]);
  });

  it("uses the exact WordPress term ids from the spec table", () => {
    expect(byId("sat-lectures")).toEqual({ id: "sat-lectures", day: "sob", typeIds: [184, 278] });
    expect(byId("sat-prelekcja-only")).toEqual({ id: "sat-prelekcja-only", day: "sob", typeIds: [184] });
    expect(byId("fri-lectures")).toEqual({ id: "fri-lectures", day: "pt", typeIds: [184, 278] });
    expect(byId("fri-prelekcja-only")).toEqual({ id: "fri-prelekcja-only", day: "pt", typeIds: [184] });
    expect(byId("fri-lecture-rooms")).toEqual({
      id: "fri-lecture-rooms",
      day: "pt",
      locationIds: [282, 279, 233, 281, 280],
    });
    expect(byId("fri-all")).toEqual({ id: "fri-all", day: "pt" });
    expect(byId("sat-all")).toEqual({ id: "sat-all", day: "sob" });
    expect(byId("fri-equipment")).toEqual({ id: "fri-equipment", day: "pt", typeIds: [214, 215] });
  });
});

describe("slotSetMembers", () => {
  it("keeps timed, non-allDay sessions of the day matching any listed type, in sessions order", () => {
    const ids = slotSetMembers({ id: "x", day: "pt", typeIds: [184, 278] }, DATA).map((s) => s.id);
    expect(ids).toEqual(["10:pt", "11:pt", "16:pt"]);
  });

  it("matches any listed location", () => {
    const ids = slotSetMembers({ id: "x", day: "pt", locationIds: [281, 318] }, DATA).map((s) => s.id);
    expect(ids).toEqual(["11:pt"]);
  });

  it("takes the whole day when no predicate is given, still excluding allDay and no-start sessions", () => {
    const ids = slotSetMembers({ id: "x", day: "pt" }, DATA).map((s) => s.id);
    expect(ids).toEqual(["10:pt", "11:pt", "12:pt", "16:pt"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(slotSetMembers({ id: "x", day: "sob", typeIds: [5] }, DATA)).toEqual([]);
  });
});
```

- [ ] **Step 16: Run the test to verify it fails**

```bash
npx vitest run scripts/__tests__/slot-sets.test.ts
```

Expected: fails with `Failed to resolve import "../lib/slot-sets"`.

- [ ] **Step 17: Write `scripts/lib/slot-sets.ts`**

```ts
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
```

- [ ] **Step 18: Run the slot-set tests to verify they pass**

```bash
npx vitest run scripts/__tests__/slot-sets.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 19: Write the failing fixtures test**

Create `scripts/__tests__/fixtures.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildFriLecturesFixture, buildSlotSetsFixture } from "../lib/fixtures";
import { dataOf, sessionOf } from "./data.fixture";

const SESSIONS = [
  sessionOf("10:pt", { typeIds: [184], locationIds: [233], start: 570, end: 645 }),
  sessionOf("11:pt", { typeIds: [278], locationIds: [281], start: 660, end: 735 }),
  sessionOf("12:pt", { typeIds: [5], locationIds: [233], start: 570, end: 960 }),
  sessionOf("13:sob", { typeIds: [184], locationIds: [233], start: 600, end: 675 }),
  sessionOf("14:pt", { typeIds: [242], locationIds: [318], start: 540, end: 1080, allDay: true }),
  sessionOf("15:pt", { typeIds: [184], locationIds: [233], start: null, end: null, timeText: "" }),
  sessionOf("16:pt", { typeIds: [184], locationIds: [233], start: 810, end: null, timeText: "13:30" }),
];
const DATA = dataOf(SESSIONS);

describe("buildSlotSetsFixture", () => {
  const fixture = buildSlotSetsFixture(DATA);

  it("has one entry per calibration set, in SLOT_SETS order", () => {
    expect(Object.keys(fixture)).toEqual([
      "sat-lectures",
      "sat-prelekcja-only",
      "fri-lectures",
      "fri-prelekcja-only",
      "fri-lecture-rooms",
      "fri-all",
      "sat-all",
      "fri-equipment",
    ]);
  });

  it("stores only id, start and end of each member, in sessions order", () => {
    expect(fixture["fri-lectures"]).toEqual([
      { id: "10:pt", start: 570, end: 645 },
      { id: "11:pt", start: 660, end: 735 },
      { id: "16:pt", start: 810, end: null },
    ]);
    expect(fixture["sat-lectures"]).toEqual([{ id: "13:sob", start: 600, end: 675 }]);
    expect(fixture["fri-all"]?.map((m) => m.id)).toEqual(["10:pt", "11:pt", "12:pt", "16:pt"]);
    expect(fixture["fri-equipment"]).toEqual([]);
  });
});

describe("buildFriLecturesFixture", () => {
  const fixture = buildFriLecturesFixture(DATA);

  it("keeps the complete Session records of the fri-lectures set", () => {
    expect(fixture.sessions).toEqual([SESSIONS[0], SESSIONS[1], SESSIONS[6]]);
  });

  it("keeps only the days, types and locations those sessions reference, in data order", () => {
    expect(fixture.days.map((d) => d.id)).toEqual(["pt"]);
    expect(fixture.types.map((t) => t.id)).toEqual([184, 278]);
    expect(fixture.locations.map((l) => l.id)).toEqual([233, 281]);
  });

  it("empties themes, brands, speakers and signupStatuses and recounts meta", () => {
    expect(fixture.themes).toEqual([]);
    expect(fixture.brands).toEqual([]);
    expect(fixture.speakers).toEqual([]);
    expect(fixture.signupStatuses).toEqual([]);
    expect(fixture.meta).toEqual({ ...DATA.meta, eventCount: 3, sessionCount: 3, speakerCount: 0 });
  });
});
```

- [ ] **Step 20: Run the test to verify it fails**

```bash
npx vitest run scripts/__tests__/fixtures.test.ts
```

Expected: fails with `Failed to resolve import "../lib/fixtures"`.

- [ ] **Step 21: Write `scripts/lib/fixtures.ts`**

```ts
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
```

- [ ] **Step 22: Run the fixtures tests to verify they pass**

```bash
npx vitest run scripts/__tests__/fixtures.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 23: Write the CLI `scripts/fetch-schedule.ts`**

No unit test: the CLI only wires the tested modules together and talks to the network. Task 8 runs it for real and checks its output. Writes go to a `.tmp` sibling and are renamed into place, so a crash mid-write never leaves a partial file; validation errors return before any write.

```ts
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ScheduleData } from "../src/data/types";
import { fetchRaw } from "./lib/api";
import { buildFriLecturesFixture, buildSlotSetsFixture } from "./lib/fixtures";
import { normalizeAll } from "./lib/normalize";
import { validate } from "./lib/validate";

const YEAR = 2026;
const SOURCE = "https://swiatlosila.pl/harmonogram-2026/";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_FILE = resolve(ROOT, "src/data/schedule.json");
const FIXTURES_DIR = resolve(ROOT, "src/test/fixtures");

/** Pretty-printed, two-space JSON with a trailing newline, written atomically. */
async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, path);
}

function printSummary(data: ScheduleData, warnings: string[]): void {
  for (const day of data.days) {
    const count = data.sessions.filter((session) => session.day === day.id).length;
    console.log(`${day.labelLong}: ${count} sessions`);
  }
  const allDay = data.sessions.filter((session) => session.allDay).length;
  console.log(
    `Total: ${data.meta.eventCount} events, ${data.meta.sessionCount} sessions, ${data.meta.speakerCount} speakers, ${allDay} all-day sessions`,
  );
  console.log(`Warnings: ${warnings.length}`);
  for (const warning of warnings) console.log(`  - ${warning}`);
}

async function main(argv: string[]): Promise<number> {
  const withFixtures = argv.includes("--fixtures");

  const raw = await fetchRaw();
  const { data, warnings: normalizeWarnings } = normalizeAll(raw, {
    year: YEAR,
    fetchedAt: new Date().toISOString(),
    source: SOURCE,
  });
  const { errors, warnings: validateWarnings } = validate(data, raw);
  const warnings = [...normalizeWarnings, ...validateWarnings];

  if (errors.length > 0) {
    console.error(`Validation failed with ${errors.length} error(s); nothing written.`);
    for (const error of errors) console.error(`  - ${error}`);
    return 1;
  }

  await writeJsonAtomic(DATA_FILE, data);
  console.log(`Wrote ${DATA_FILE}`);

  if (withFixtures) {
    await writeJsonAtomic(resolve(FIXTURES_DIR, "slot-sets.json"), buildSlotSetsFixture(data));
    await writeJsonAtomic(resolve(FIXTURES_DIR, "fri-lectures.json"), buildFriLecturesFixture(data));
    console.log(`Wrote slot-sets.json and fri-lectures.json to ${FIXTURES_DIR}`);
  }

  printSummary(data, warnings);
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  },
);
```

- [ ] **Step 24: Run the whole script suite and the typecheck, then commit**

```bash
npx vitest run scripts
npm run typecheck
git add scripts/lib/slot-sets.ts scripts/lib/fixtures.ts scripts/fetch-schedule.ts scripts/__tests__/data.fixture.ts scripts/__tests__/slot-sets.test.ts scripts/__tests__/fixtures.test.ts
git commit -m "feat(scripts): add slot-set fixtures and the fetch-schedule CLI" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```

Expected: every file under `scripts/__tests__` passes (this task adds 41 tests: 7 api, 12 normalize, 11 validate, 6 slot-sets, 5 fixtures, on top of the earlier sanitize, parse, locations and speakers tests) and `npm run typecheck` reports no errors for either tsconfig. The CLI is covered by the `tsconfig.node.json` typecheck.

---

### Task 8: Generate the real snapshot and fixtures

**Files:**
- Create (generated): `src/data/schedule.json`
- Create (generated): `src/test/fixtures/slot-sets.json`
- Create (generated): `src/test/fixtures/fri-lectures.json`

**Interfaces:**
- Consumes: `npm run fetch` (`tsx scripts/fetch-schedule.ts`) from Task 7 and, through it, everything under `scripts/lib/`.
- Produces: the three generated files that every later task imports: `src/data/index.tsx` imports `src/data/schedule.json`; the slot tests load `src/test/fixtures/slot-sets.json`; component tests load `src/test/fixtures/fri-lectures.json`. Never hand-edit any of them (Global Constraints).

All expected numbers below were computed from the 2026-09-03 API responses and match spec §3 and §5.2. If the festival site has changed since, the numbers will differ; in that case update the spec §5.2 table in the same commit (spec §5.2, last paragraph) rather than hand-editing the fixtures.

- [ ] **Step 1: Run the fetch with fixtures**

```bash
npm run fetch -- --fixtures 2>&1 | tee /tmp/fetch.log
```

Expected output, in this order (warning lines are grouped here by kind; the first ten appear in API event order, then the eight long-session lines in session order, then the photo line):

```
Wrote /…/conference-melt/src/data/schedule.json
Wrote slot-sets.json and fri-lectures.json to /…/conference-melt/src/test/fixtures
Czwartek, 3 września: 1 sessions
Piątek, 4 września: 82 sessions
Sobota, 5 września: 80 sessions
Total: 153 events, 163 sessions, 120 speakers, 20 all-day sessions
Warnings: 19
  - Event 39588 "…": speaker anchor "Biliński Emil" (https://swiatlosila.pl/cyfrowe-prelegent/jimmy-salatka/) resolved by name to 134 Emil Biliński
  - (six more "Biliński Emil" lines for events 46502, 46521, 46530, 46542, 46547, 46560)
  - Event 39590 "…": speaker anchor "Bartnik Karol" (https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/) resolved by name to 128 Karol Bartnik
  - Event 46540 "…": speaker anchor "Bartnik Karol" (https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/) resolved by name to 128 Karol Bartnik
  - Event 41154 "…": speaker anchor "Blank Filip" (https://swiatlosila.pl/cyfrowe-event/warsztaty-masterclass-fotografia-motoryzacyjna-z-filipem-blankiem/) resolved by name to 293 Filip Blank
  - Session 41151:pt "…" runs 390 minutes but is not allDay
  - Session 41152:pt "…" runs 420 minutes but is not allDay
  - Session 41154:pt "…" runs 315 minutes but is not allDay
  - Session 41219:sob "…" runs 300 minutes but is not allDay
  - Session 41220:sob "…" runs 300 minutes but is not allDay
  - Session 41222:sob "…" runs 300 minutes but is not allDay
  - Session 46438:pt "…" runs 540 minutes but is not allDay
  - Session 46440:sob "…" runs 540 minutes but is not allDay
  - Speaker 46704 Mateusz RABBITS ANALOGUE Żurowski has no photo
```

The eight "not allDay" lines are the eight paid `Warsztaty` masterclasses that spec §3 and §4.2 describe (300 minutes or more, not typed `Ogólne`); spec §4.4 requires them to be reported so a mis-typed zone never goes unnoticed. There must be no "did not resolve", "end discarded", "no parseable time", "rule 6" or "SHORT_LABELS" line.

- [ ] **Step 2: Check the warning counts mechanically**

```bash
grep -c "resolved by name" /tmp/fetch.log
grep -c "resolved by data-id" /tmp/fetch.log
grep -c "did not resolve" /tmp/fetch.log
grep -c "is not allDay" /tmp/fetch.log
grep -c "has no photo" /tmp/fetch.log
grep -cE "end discarded|no parseable time|rule 6|SHORT_LABELS" /tmp/fetch.log
```

Expected, line by line: `10`, `0`, `0`, `8`, `1`, `0`. (`grep -c` prints `0` and exits 1 when nothing matches; that exit code is fine here.)

- [ ] **Step 3: Verify the snapshot with a node one-liner**

```bash
node -e '
const d = JSON.parse(require("fs").readFileSync("src/data/schedule.json", "utf8"));
console.log({
  version: d.meta.version, year: d.meta.year,
  events: new Set(d.sessions.map(s => s.eventId)).size,
  sessions: d.sessions.length,
  allDay: d.sessions.filter(s => s.allDay).length,
  days: d.days.map(x => x.id),
  perDay: Object.fromEntries(d.days.map(x => [x.id, d.sessions.filter(s => s.day === x.id).length])),
  noStart: d.sessions.filter(s => s.start === null).length,
  points: d.sessions.filter(s => s.start !== null && s.end === null).map(s => s.id),
  speakerRefs: d.sessions.reduce((n, s) => n + s.speakerIds.length, 0),
  speakers: d.speakers.length,
  noPhoto: d.speakers.filter(s => s.photo === null).map(s => s.id),
  largePhotos: d.speakers.filter(s => s.photo !== null && /-1024x/.test(s.photo)).length,
  locations: d.locations.length, types: d.types.length, themes: d.themes.length, brands: d.brands.length,
  signupStatuses: d.signupStatuses.map(t => t.name),
  bylines: d.sessions.filter(s => s.byline !== null).map(s => s.eventId + ":" + s.byline),
  keys: Object.keys(d), sessionKeys: Object.keys(d.sessions[0]),
});
'
```

Expected:

```
{
  version: 1, year: 2026,
  events: 153,
  sessions: 163,
  allDay: 20,
  days: [ 'czw', 'pt', 'sob' ],
  perDay: { czw: 1, pt: 82, sob: 80 },
  noStart: 0,
  points: [ '33705:pt', '34237:sob', '39565:pt' ],
  speakerRefs: 147,
  speakers: 120,
  noPhoto: [ 46704 ],
  largePhotos: 57,
  locations: 20, types: 9, themes: 60, brands: 42,
  signupStatuses: [ 'Brak miejsc', 'W ramach festiwalu', 'Zapisy' ],
  bylines: [ '39549:Sony', '39565:Cyfrowe.pl', '39589:KLIK FILM', '46568:Danaj Katarzyna BUDZISZYNA', '46722:Sorger Fabian' ],
  keys: [ 'meta', 'days', 'locations', 'types', 'themes', 'brands', 'signupStatuses', 'speakers', 'sessions' ],
  sessionKeys: [ 'id', 'eventId', 'day', 'title', 'start', 'end', 'allDay', 'timeText', 'speakerIds', 'byline', 'typeIds', 'themeIds', 'brandIds', 'locationIds', 'signup', 'descriptionHtml', 'url' ]
}
```

`speakerRefs` equals the 147 anchors of spec §3 because no dual-day event carries a speaker anchor. `bylines` are exactly the five non-null bylines listed in spec §3, in `eventId` order. `types: 9` and `locations: 20` are the in-use counts of spec §3; `themes: 60` and `brands: 42` are the in-use subsets of the 80 theme and 65 brand terms (spec §4.2 emits only terms with `count > 0`).

- [ ] **Step 4: Verify the fixtures**

```bash
node -e '
const f = JSON.parse(require("fs").readFileSync("src/test/fixtures/slot-sets.json", "utf8"));
console.log(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.length])));
console.log(Object.values(f).every(set => set.every(m => typeof m.start === "number" && Object.keys(m).join() === "id,start,end")));
const fl = JSON.parse(require("fs").readFileSync("src/test/fixtures/fri-lectures.json", "utf8"));
console.log({
  sessions: fl.sessions.length, events: fl.meta.eventCount, sessionCount: fl.meta.sessionCount, speakerCount: fl.meta.speakerCount,
  days: fl.days.map(d => d.id), types: fl.types.map(t => t.id), locations: fl.locations.map(l => l.id),
  themes: fl.themes.length, brands: fl.brands.length, speakers: fl.speakers.length, signupStatuses: fl.signupStatuses.length,
  has41151: fl.sessions.some(s => s.id === "41151:pt"),
  starts: [...new Set(fl.sessions.map(s => s.start))].sort((a, b) => a - b).length,
});
'
```

Expected:

```
{
  'sat-lectures': 29,
  'sat-prelekcja-only': 26,
  'fri-lectures': 27,
  'fri-prelekcja-only': 25,
  'fri-lecture-rooms': 29,
  'fri-all': 72,
  'sat-all': 70,
  'fri-equipment': 31
}
true
{
  sessions: 27, events: 27, sessionCount: 27, speakerCount: 0,
  days: [ 'pt' ], types: [ 184, 278 ], locations: [ 280, 279, 233, 281 ],
  themes: 0, brands: 0, speakers: 0, signupStatuses: 0,
  has41151: false,
  starts: 27
}
```

The set sizes are the `n` column of the spec §5.2 table. `locations` comes out `[280, 279, 233, 281]` because the array keeps `order` order: level `I` (W4, 280) precedes level `II`, and within level `II` Polish collation puts "Klub bokserski" before "So Salsa" before "SoSalsa". `has41151: false` confirms that event 41151, the 09:30–16:00 `Warsztaty` masterclass, is deliberately absent from the lecture fixture, whose set is `Prelekcja` and `Prelekcja z sesją` only; the slot tests (spec §10) in Task 9 build that workshop synthetically and span it against these lecture rows. (`starts: 27` is the number of distinct start times, one per session on this data; the slot count of 13 in the table comes from clustering them with `tolerance = 15`, which the domain slot tests verify.)

- [ ] **Step 5: Check that a re-run produces a minimal diff**

```bash
git add src/data/schedule.json src/test/fixtures/slot-sets.json src/test/fixtures/fri-lectures.json
npm run fetch > /dev/null
git diff --stat
git diff src/data/schedule.json | grep '^[-+] ' 
```

Expected: `git diff --stat` shows `src/data/schedule.json | 2 +-` and no other file; the grep prints exactly two lines, both `"fetchedAt": "…"` (one `-`, one `+`). Every array order is deterministic (spec §4.1 step 5), so nothing else moves. Then stage the refreshed file:

```bash
git add src/data/schedule.json
```

- [ ] **Step 6: Run the suite and the typecheck**

```bash
npm run typecheck
npm test
```

Expected: both clean. (`resolveJsonModule` must be on in `tsconfig.json` for `src/data/index.tsx` to import the snapshot in later tasks; the typecheck passes here regardless because nothing imports it yet.)

- [ ] **Step 7: Commit the generated files**

```bash
git status --short
git commit -m "chore(data): add 2026-09-03 schedule snapshot and slot-set fixtures" -m "153 events as 163 sessions (czw 1, pt 82, sob 80), 20 all-day zone sessions, 120 speakers; every speaker anchor resolved (137 by slug, 10 by name). Fixtures frozen for the eight spec §5.2 calibration sets and the fri-lectures ScheduleData subset." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
rm -f /tmp/fetch.log
```

Expected: `git status --short` before the commit lists exactly the three `A` files; after it the working tree is clean.


### Task 9: Slot detection and row spans (`src/domain/slots.ts`)

**Files:**
- Create: `src/domain/slots.ts`
- Test: `src/domain/slots.test.ts`

**Interfaces:**
- Consumes: `TimedSession` from `src/data/types.ts`; `visualEnd(s: TimedSession): number` from `src/domain/time.ts`; `makeSession(overrides?: Partial<Session>): Session` from `src/test/fixtures/build.ts`; the generated fixture `src/test/fixtures/slot-sets.json` (shape `Record<setId, { id: string; start: number; end: number | null }[]>`, written by `npm run fetch -- --fixtures` in the fetch-script task).
- Produces (used by `state/derive.ts`, `components/grid/gridLayout.ts` and the list view):
  - `interface Slot { index: number; start: number; lastStart: number; end: number; sessionIds: string[] }`
  - `const DEFAULT_TOLERANCE = 15`
  - `detectSlots(sessions: TimedSession[], opts?: { tolerance?: number }): Slot[]`
  - `slotIndexOf(s: TimedSession, slots: Slot[]): number` (−1 when no slot's `[start, lastStart]` contains `s.start`)
  - `rowSpan(s: TimedSession, slots: Slot[], tolerance: number): number` (≥ 1)
  - `rowInterval(s: TimedSession, slots: Slot[], tolerance: number): [number, number]` (`[startRow, endRowExclusive]`)
  - `spanAllowed(s: TimedSession, columnSessions: TimedSession[], slots: Slot[], tolerance: number): boolean`
  - `interface Regularity { medianGap: number; sharedRatio: number; distinguishable: boolean }`
  - `slotRegularity(slots: Slot[], sessions: TimedSession[], tolerance: number): Regularity`

Rules implemented (spec §5.2): distinct starts sorted ascending; a new cluster starts when the gap to the previous start exceeds `tolerance` **or** the span from the cluster's first start would exceed `2 × tolerance`; `Slot.end` is the next slot's start, or the largest `visualEnd` of the members for the last slot; a session spans its own row plus every later row `r` with `slots[r].start + tolerance < visualEnd(s)`, point sessions (no `end`) always span one row; `medianGap` is the median of consecutive slot-start gaps (mean of the two middle values for an even count, 0 with fewer than two slots); `sharedRatio` is the fraction of `sessions` that sit in a slot holding two or more sessions (0 for an empty list); `distinguishable = slots.length >= 2 && medianGap >= 3 * tolerance && sharedRatio >= 0.75`.

- [ ] **Step 1: Write the failing test**

Create `src/domain/slots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Session, TimedSession } from "../data/types";
import { makeSession } from "../test/fixtures/build";
import slotSets from "../test/fixtures/slot-sets.json";
import {
  DEFAULT_TOLERANCE,
  detectSlots,
  rowInterval,
  rowSpan,
  slotIndexOf,
  slotRegularity,
  spanAllowed,
} from "./slots";

interface FixtureRow {
  id: string;
  start: number;
  end: number | null;
}

const SETS = slotSets as Record<string, FixtureRow[]>;

function timed(overrides: Partial<Session> & { id: string; start: number }): TimedSession {
  return makeSession(overrides) as TimedSession;
}

function fromFixture(setId: string): TimedSession[] {
  const rows = SETS[setId];
  if (rows === undefined) throw new Error(`slot-sets.json has no set "${setId}"`);
  return rows.map((row) => {
    const [eventId, day] = row.id.split(":");
    return timed({ id: row.id, eventId: Number(eventId), day, start: row.start, end: row.end });
  });
}

describe("detectSlots", () => {
  it("returns [] for an empty slot set", () => {
    expect(detectSlots([])).toEqual([]);
  });

  it("exports the default tolerance of 15", () => {
    expect(DEFAULT_TOLERANCE).toBe(15);
  });

  it("merges starts within the tolerance into one slot and keeps the members in input order", () => {
    const a = timed({ id: "a", start: 570, end: 630 });
    const b = timed({ id: "b", start: 575, end: 635 });
    const c = timed({ id: "c", start: 585, end: 645 });
    const d = timed({ id: "d", start: 600, end: 660 });
    const slots = detectSlots([a, b, c, d]);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toEqual({ index: 0, start: 570, lastStart: 600, end: 660, sessionIds: ["a", "b", "c", "d"] });
  });

  it("starts a new slot when the gap to the previous start exceeds the tolerance", () => {
    const a = timed({ id: "a", start: 570, end: 630 });
    const b = timed({ id: "b", start: 590, end: 650 });
    const slots = detectSlots([a, b]);
    expect(slots.map((s) => s.start)).toEqual([570, 590]);
  });

  it("starts a new slot when the span from the first start would exceed twice the tolerance (staggered chain)", () => {
    const chain = [570, 585, 600, 615, 630].map((start, i) => timed({ id: `s${i}`, start, end: start + 60 }));
    const slots = detectSlots(chain);
    expect(slots.map((s) => [s.start, s.lastStart])).toEqual([
      [570, 600],
      [615, 630],
    ]);
  });

  it("honours the tolerance option", () => {
    const three = [570, 600, 630].map((start, i) => timed({ id: `s${i}`, start, end: start + 45 }));
    expect(detectSlots(three)).toHaveLength(3);
    expect(detectSlots(three, { tolerance: 30 })).toHaveLength(1);
  });

  it("ends a slot at the next slot's start and the last slot at the members' latest visual end", () => {
    const a = timed({ id: "a", start: 600, end: 660 });
    const b = timed({ id: "b", start: 615, end: 700 });
    const c = timed({ id: "c", start: 720, end: 780 });
    expect(detectSlots([a, b, c])).toEqual([
      { index: 0, start: 600, lastStart: 615, end: 720, sessionIds: ["a", "b"] },
      { index: 1, start: 720, lastStart: 720, end: 780, sessionIds: ["c"] },
    ]);
  });

  it("uses start + 20 as the visual end of a trailing point session", () => {
    const a = timed({ id: "a", start: 600, end: 660 });
    const p = timed({ id: "p", start: 900, end: null });
    const slots = detectSlots([a, p]);
    expect(slots[1]).toEqual({ index: 1, start: 900, lastStart: 900, end: 920, sessionIds: ["p"] });
  });
});

describe("slotIndexOf, rowSpan, rowInterval", () => {
  const a = timed({ id: "a", start: 570, end: 700 });
  const b = timed({ id: "b", start: 645, end: 705 });
  const c = timed({ id: "c", start: 720, end: 780 });
  const slots = detectSlots([a, b, c]);

  it("detects three rows for the synthetic column", () => {
    expect(slots.map((s) => s.start)).toEqual([570, 645, 720]);
  });

  it("finds the slot whose cluster contains the session start", () => {
    expect(slotIndexOf(a, slots)).toBe(0);
    expect(slotIndexOf(b, slots)).toBe(1);
    expect(slotIndexOf(c, slots)).toBe(2);
    expect(slotIndexOf(timed({ id: "x", start: 800 }), slots)).toBe(-1);
  });

  it("spans every later row whose start plus tolerance lies before the visual end", () => {
    expect(rowSpan(a, slots, 15)).toBe(2);
    expect(rowSpan(b, slots, 15)).toBe(1);
    expect(rowSpan(c, slots, 15)).toBe(1);
  });

  it("does not span a row that starts exactly tolerance minutes before the end", () => {
    const edge = timed({ id: "e", start: 570, end: 660 });
    expect(rowSpan(edge, slots, 15)).toBe(1);
  });

  it("returns 1 for a session outside every slot", () => {
    expect(rowSpan(timed({ id: "x", start: 800, end: 1000 }), slots, 15)).toBe(1);
  });

  it("keeps point sessions on one row even when the next slot is inside their 20 minutes", () => {
    const p = timed({ id: "p", start: 570, end: null });
    const q = timed({ id: "q", start: 576, end: 640 });
    const tight = detectSlots([p, q], { tolerance: 5 });
    expect(tight.map((s) => s.start)).toEqual([570, 576]);
    expect(rowSpan(p, tight, 5)).toBe(1);
  });

  it("returns [startRow, startRow + rowSpan)", () => {
    expect(rowInterval(a, slots, 15)).toEqual([0, 2]);
    expect(rowInterval(b, slots, 15)).toEqual([1, 2]);
    expect(rowInterval(c, slots, 15)).toEqual([2, 3]);
  });
});

describe("spanAllowed", () => {
  const a = timed({ id: "a", start: 570, end: 700 });
  const b = timed({ id: "b", start: 645, end: 705 });
  const c = timed({ id: "c", start: 720, end: 780 });
  const slots = detectSlots([a, b, c]);

  it("is false when another session in the column occupies a row inside the span", () => {
    expect(spanAllowed(a, [a, b, c], slots, 15)).toBe(false);
  });

  it("is false for the confined session whose row the spanning session covers", () => {
    expect(spanAllowed(b, [a, b, c], slots, 15)).toBe(false);
  });

  it("is true once the intersecting session is removed from the column", () => {
    expect(spanAllowed(a, [a, c], slots, 15)).toBe(true);
  });

  it("is true for a one-row session whose row nobody else spans into", () => {
    expect(spanAllowed(c, [a, b, c], slots, 15)).toBe(true);
  });

  it("ignores the session itself", () => {
    expect(spanAllowed(a, [a], slots, 15)).toBe(true);
  });
});

describe("slotRegularity", () => {
  it("returns zeros and not distinguishable for an empty list", () => {
    expect(slotRegularity([], [], 15)).toEqual({ medianGap: 0, sharedRatio: 0, distinguishable: false });
  });

  it("returns medianGap 0 with a single slot", () => {
    const only = [timed({ id: "a", start: 600, end: 660 }), timed({ id: "b", start: 605, end: 665 })];
    const r = slotRegularity(detectSlots(only), only, 15);
    expect(r).toEqual({ medianGap: 0, sharedRatio: 1, distinguishable: false });
  });

  it("takes the mean of the two middle gaps for an even gap count", () => {
    const singles = [570, 600, 660, 720, 750].map((start, i) => timed({ id: `s${i}`, start, end: start + 25 }));
    const r = slotRegularity(detectSlots(singles), singles, 15);
    expect(r.medianGap).toBe(45);
    expect(r.sharedRatio).toBe(0);
    expect(r.distinguishable).toBe(false);
  });

  it("takes the middle gap for an odd gap count", () => {
    const singles = [570, 600, 660, 720].map((start, i) => timed({ id: `s${i}`, start, end: start + 25 }));
    expect(slotRegularity(detectSlots(singles), singles, 15).medianGap).toBe(60);
  });

  it("counts the fraction of sessions sitting in slots with two or more sessions", () => {
    const a = timed({ id: "a", start: 570, end: 630 });
    const b = timed({ id: "b", start: 575, end: 635 });
    const c = timed({ id: "c", start: 660, end: 720 });
    const d = timed({ id: "d", start: 665, end: 725 });
    const e = timed({ id: "e", start: 750, end: 800 });
    const shared = [a, b, c, d];
    expect(slotRegularity(detectSlots(shared), shared, 15)).toEqual({ medianGap: 90, sharedRatio: 1, distinguishable: true });
    const withLoner = [a, b, c, d, e];
    const r = slotRegularity(detectSlots(withLoner), withLoner, 15);
    expect(r.sharedRatio).toBeCloseTo(0.8, 5);
    expect(r.distinguishable).toBe(true);
  });

  it("is not distinguishable when the median gap is below three tolerances", () => {
    const a = timed({ id: "a", start: 570, end: 610 });
    const b = timed({ id: "b", start: 575, end: 615 });
    const c = timed({ id: "c", start: 610, end: 650 });
    const d = timed({ id: "d", start: 615, end: 655 });
    const all = [a, b, c, d];
    const r = slotRegularity(detectSlots(all), all, 15);
    expect(r.medianGap).toBe(40);
    expect(r.sharedRatio).toBe(1);
    expect(r.distinguishable).toBe(false);
  });

  it("is not distinguishable when fewer than three quarters of the sessions share a slot", () => {
    const a = timed({ id: "a", start: 570, end: 630 });
    const b = timed({ id: "b", start: 575, end: 635 });
    const c = timed({ id: "c", start: 660, end: 720 });
    const d = timed({ id: "d", start: 750, end: 810 });
    const all = [a, b, c, d];
    const r = slotRegularity(detectSlots(all), all, 15);
    expect(r.medianGap).toBe(90);
    expect(r.sharedRatio).toBe(0.5);
    expect(r.distinguishable).toBe(false);
  });
});

describe("calibration sets from src/test/fixtures/slot-sets.json (spec §5.2, tolerance 15)", () => {
  const TABLE = [
    { set: "sat-lectures", n: 29, slots: 8, medianGap: 75, shared: 0.97, distinguishable: true },
    { set: "sat-prelekcja-only", n: 26, slots: 8, medianGap: 75, shared: 0.96, distinguishable: true },
    { set: "fri-lectures", n: 27, slots: 13, medianGap: 45, shared: 0.78, distinguishable: true },
    { set: "fri-prelekcja-only", n: 25, slots: 14, medianGap: 45, shared: 0.72, distinguishable: false },
    { set: "fri-lecture-rooms", n: 29, slots: 12, medianGap: 45, shared: 0.83, distinguishable: true },
    { set: "fri-all", n: 72, slots: 16, medianGap: 40, shared: 0.93, distinguishable: false },
    { set: "sat-all", n: 70, slots: 15, medianGap: 40, shared: 0.96, distinguishable: false },
    { set: "fri-equipment", n: 31, slots: 12, medianGap: 40, shared: 0.87, distinguishable: false },
  ];

  for (const row of TABLE) {
    it(`${row.set}: ${row.n} sessions, ${row.slots} slots, median gap ${row.medianGap}, shared ${row.shared}, distinguishable ${row.distinguishable}`, () => {
      const sessions = fromFixture(row.set);
      expect(sessions).toHaveLength(row.n);
      const slots = detectSlots(sessions, { tolerance: 15 });
      const r = slotRegularity(slots, sessions, 15);
      expect(slots).toHaveLength(row.slots);
      expect(r.medianGap).toBe(row.medianGap);
      expect(r.sharedRatio).toBeCloseTo(row.shared, 2);
      expect(r.distinguishable).toBe(row.distinguishable);
    });
  }

  it("every fixture session belongs to exactly one slot", () => {
    for (const row of TABLE) {
      const sessions = fromFixture(row.set);
      const slots = detectSlots(sessions);
      const ids = slots.flatMap((s) => s.sessionIds);
      expect(ids).toHaveLength(sessions.length);
      expect(new Set(ids).size).toBe(sessions.length);
      for (const s of sessions) expect(slotIndexOf(s, slots)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("row spans against the fri-lectures slot rows", () => {
  const friLectures = fromFixture("fri-lectures");
  const slots = detectSlots(friLectures, { tolerance: 15 });

  it("has the 13 slot rows starting 09:30, 10:45, 12:00, 13:20, 13:40, 14:30, 15:00, 15:45, 16:15, 17:00, 17:30, 18:15, 18:40", () => {
    expect(slots.map((s) => s.start)).toEqual([570, 645, 720, 800, 820, 870, 900, 945, 975, 1020, 1050, 1095, 1120]);
  });

  it("the 09:30–16:00 workshop (event 41151) starts in row 0 and spans 7 rows", () => {
    const workshop = timed({
      id: "41151:pt",
      eventId: 41151,
      day: "pt",
      title: "Warsztaty Masterclass – Moda na błysk",
      start: 570,
      end: 960,
      typeIds: [5],
      locationIds: [290],
    });
    expect(slotIndexOf(workshop, slots)).toBe(0);
    expect(rowSpan(workshop, slots, 15)).toBe(7);
    expect(rowInterval(workshop, slots, 15)).toEqual([0, 7]);
    expect(slots[6]?.start).toBe(900);
    expect(slots[7]?.start).toBe(945);
  });

  it("the 13:20–14:20 lecture (39564:pt) spans two rows, its second row being 13:40", () => {
    const lecture = friLectures.find((s) => s.id === "39564:pt");
    if (lecture === undefined) throw new Error("fixture is missing 39564:pt");
    expect(lecture.start).toBe(800);
    expect(lecture.end).toBe(860);
    expect(slotIndexOf(lecture, slots)).toBe(3);
    expect(rowSpan(lecture, slots, 15)).toBe(2);
    expect(slots[4]?.start).toBe(820);
  });

  it("the lecture may span in a column holding only itself but not next to a 13:40 session", () => {
    const lecture = friLectures.find((s) => s.id === "39564:pt");
    if (lecture === undefined) throw new Error("fixture is missing 39564:pt");
    const at1340 = friLectures.filter((s) => s.start === 820);
    expect(at1340.length).toBeGreaterThan(0);
    expect(spanAllowed(lecture, [lecture], slots, 15)).toBe(true);
    expect(spanAllowed(lecture, [lecture, ...at1340], slots, 15)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/slots.test.ts`

Expected: the run fails before any test executes with `Error: Failed to resolve import "./slots" from "src/domain/slots.test.ts". Does the file exist?`

- [ ] **Step 3: Write the implementation**

Create `src/domain/slots.ts`:

```ts
import type { TimedSession } from "../data/types";
import { visualEnd } from "./time";

export interface Slot {
  index: number;
  start: number;
  lastStart: number;
  end: number;
  sessionIds: string[];
}

export const DEFAULT_TOLERANCE = 15;

interface Cluster {
  first: number;
  last: number;
}

/** Spec §5.2 steps 1–3: cluster distinct starts with the gap and 2×tolerance span guards. */
export function detectSlots(sessions: TimedSession[], opts: { tolerance?: number } = {}): Slot[] {
  const tolerance = opts.tolerance ?? DEFAULT_TOLERANCE;
  if (sessions.length === 0) return [];
  const starts = [...new Set(sessions.map((s) => s.start))].sort((a, b) => a - b);
  const clusters: Cluster[] = [];
  for (const start of starts) {
    const current = clusters[clusters.length - 1];
    if (current !== undefined && start - current.last <= tolerance && start - current.first <= 2 * tolerance) {
      current.last = start;
    } else {
      clusters.push({ first: start, last: start });
    }
  }
  return clusters.map((cluster, index) => {
    const members = sessions.filter((s) => s.start >= cluster.first && s.start <= cluster.last);
    const next = clusters[index + 1];
    const end = next !== undefined ? next.first : Math.max(...members.map(visualEnd));
    return {
      index,
      start: cluster.first,
      lastStart: cluster.last,
      end,
      sessionIds: members.map((s) => s.id),
    };
  });
}

export function slotIndexOf(s: TimedSession, slots: Slot[]): number {
  return slots.findIndex((slot) => s.start >= slot.start && s.start <= slot.lastStart);
}

/** Spec §5.2 step 4: own row plus every later row r with slots[r].start + tolerance < visualEnd. Point sessions occupy one row. */
export function rowSpan(s: TimedSession, slots: Slot[], tolerance: number): number {
  const row = slotIndexOf(s, slots);
  if (row < 0 || s.end === null) return 1;
  const end = visualEnd(s);
  let span = 1;
  for (const later of slots.slice(row + 1)) {
    if (later.start + tolerance < end) span += 1;
  }
  return span;
}

export function rowInterval(s: TimedSession, slots: Slot[], tolerance: number): [number, number] {
  const row = slotIndexOf(s, slots);
  return [row, row + rowSpan(s, slots, tolerance)];
}

/** Spec §5.2 step 5: true when no other column session's row interval intersects this session's. */
export function spanAllowed(s: TimedSession, columnSessions: TimedSession[], slots: Slot[], tolerance: number): boolean {
  const [from, to] = rowInterval(s, slots, tolerance);
  return columnSessions.every((other) => {
    if (other.id === s.id) return true;
    const [otherFrom, otherTo] = rowInterval(other, slots, tolerance);
    return !(from < otherTo && otherFrom < to);
  });
}

export interface Regularity {
  medianGap: number;
  sharedRatio: number;
  distinguishable: boolean;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[mid - 1] ?? 0;
  return (lower + upper) / 2;
}

export function slotRegularity(slots: Slot[], sessions: TimedSession[], tolerance: number): Regularity {
  const gaps: number[] = [];
  let previous: Slot | undefined;
  for (const slot of slots) {
    if (previous !== undefined) gaps.push(slot.start - previous.start);
    previous = slot;
  }
  const sharedIds = new Set<string>();
  for (const slot of slots) {
    if (slot.sessionIds.length >= 2) {
      for (const id of slot.sessionIds) sharedIds.add(id);
    }
  }
  const medianGap = median(gaps);
  const sharedRatio = sessions.length === 0 ? 0 : sessions.filter((s) => sharedIds.has(s.id)).length / sessions.length;
  const distinguishable = slots.length >= 2 && medianGap >= 3 * tolerance && sharedRatio >= 0.75;
  return { medianGap, sharedRatio, distinguishable };
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `npx vitest run src/domain/slots.test.ts`

Expected: all tests pass (8 `detectSlots`, 7 index/span, 5 `spanAllowed`, 7 `slotRegularity`, 9 calibration, 4 fri-lectures). If a calibration row fails, the fixture on disk differs from the 2026-09-03 snapshot the spec table was computed from; do not change the table, regenerate the fixture with `npm run fetch -- --fixtures` only if the fetch-script task has not committed it yet.

Run: `npm run typecheck`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/domain/slots.ts src/domain/slots.test.ts
git commit -m "feat(domain): add slot detection, row spans and slot regularity" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```

---

### Task 10: Overlaps, lane packing and plan conflicts (`src/domain/overlaps.ts`)

**Files:**
- Create: `src/domain/overlaps.ts`
- Test: `src/domain/overlaps.test.ts`

**Interfaces:**
- Consumes: `Session`, `TimedSession`, `hasStart(s: Session): s is TimedSession` from `src/data/types.ts`; `visualEnd(s: TimedSession): number` from `src/domain/time.ts`; `makeSession` from `src/test/fixtures/build.ts`.
- Produces (used by `plan.ts`, `derive.ts`, `gridLayout.ts`, `SessionCard`, `DetailSheet`, `ScheduleList`):
  - `type EndOf = (s: TimedSession) => number`
  - `overlaps(a: Session, b: Session): boolean`
  - `overlapGroups(sessions: TimedSession[], endOf?: EndOf): TimedSession[][]`
  - `interface LaneInfo { lane: number; lanes: number }`
  - `packingEnd(s: TimedSession, minMinutes: number): number`
  - `packLanes(sessions: TimedSession[], minMinutes: number): Map<string, LaneInfo>`
  - `maxConcurrency(sessions: TimedSession[]): number`
  - `interface ConflictPair { a: Session; b: Session }`
  - `planConflicts(planSessions: Session[]): ConflictPair[]`
  - `conflictCount(s: Session, planSessions: Session[]): number`

Rules implemented (spec §5.3): `overlaps` is false across days, when either side is `allDay`, or when either lacks a start, else `a.start < visualEnd(b) && b.start < visualEnd(a)`; the `allDay` guard lives only in `overlaps`. `overlapGroups` returns connected components per day by a sweep sorted by start (members sorted by start), using `endOf` (default `visualEnd`). `packingEnd = max(visualEnd, start + minMinutes)`. `packLanes` sorts each component by start ascending then packing end descending, assigns the lowest lane whose last end is `<= start`, and reports the component's lane count as `lanes`. `maxConcurrency` sweeps start/`visualEnd` events (an end at minute `t` is processed before a start at `t`, so touching sessions are not concurrent). `planConflicts` lists `{ a, b }` pairs with `a` the earlier session, sorted by `a.day` then `a.start`.

- [ ] **Step 1: Write the failing test**

Create `src/domain/overlaps.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Session, TimedSession } from "../data/types";
import { makeSession } from "../test/fixtures/build";
import {
  conflictCount,
  maxConcurrency,
  overlapGroups,
  overlaps,
  packLanes,
  packingEnd,
  planConflicts,
} from "./overlaps";

function timed(overrides: Partial<Session> & { id: string; start: number }): TimedSession {
  return makeSession(overrides) as TimedSession;
}

const ids = (list: Session[]): string[] => list.map((s) => s.id);

describe("overlaps", () => {
  it("is true for two sessions sharing a minute on the same day", () => {
    const a = makeSession({ id: "a:pt", start: 600, end: 660 });
    const b = makeSession({ id: "b:pt", start: 630, end: 690 });
    expect(overlaps(a, b)).toBe(true);
    expect(overlaps(b, a)).toBe(true);
  });

  it("is false for touching ends: 10:00–11:00 and 11:00–12:00", () => {
    const a = makeSession({ id: "a:pt", start: 600, end: 660 });
    const b = makeSession({ id: "b:pt", start: 660, end: 720 });
    expect(overlaps(a, b)).toBe(false);
    expect(overlaps(b, a)).toBe(false);
  });

  it("is false across days, including the two sessions of one dual-day event", () => {
    const fri = makeSession({ id: "39549:pt", eventId: 39549, day: "pt", start: 540, end: 1080 });
    const sat = makeSession({ id: "39549:sob", eventId: 39549, day: "sob", start: 540, end: 1080 });
    expect(overlaps(fri, sat)).toBe(false);
    const other = makeSession({ id: "b:sob", day: "sob", start: 600, end: 660 });
    expect(overlaps(fri, other)).toBe(false);
  });

  it("is false when either session is all-day", () => {
    const zone = makeSession({ id: "z:pt", start: 540, end: 1080, allDay: true, typeIds: [242] });
    const talk = makeSession({ id: "t:pt", start: 600, end: 660 });
    expect(overlaps(zone, talk)).toBe(false);
    expect(overlaps(talk, zone)).toBe(false);
  });

  it("is false when either session has no start", () => {
    const none = makeSession({ id: "n:pt", start: null, end: null, timeText: "" });
    const talk = makeSession({ id: "t:pt", start: 600, end: 660 });
    expect(overlaps(none, talk)).toBe(false);
    expect(overlaps(talk, none)).toBe(false);
  });

  it("treats a point session as 20 minutes long", () => {
    const point = makeSession({ id: "p:pt", start: 600, end: null });
    const inside = makeSession({ id: "i:pt", start: 619, end: 680 });
    const after = makeSession({ id: "a:pt", start: 620, end: 680 });
    expect(overlaps(point, inside)).toBe(true);
    expect(overlaps(point, after)).toBe(false);
  });

  it("does not consult the all-day flag of a long non-zone session", () => {
    const workshop = makeSession({ id: "w:pt", start: 570, end: 960, typeIds: [5] });
    const talk = makeSession({ id: "t:pt", start: 600, end: 660 });
    expect(overlaps(workshop, talk)).toBe(true);
  });
});

describe("overlapGroups", () => {
  it("returns connected components, bridged sessions included, members sorted by start", () => {
    const a = timed({ id: "a", start: 540, end: 600 });
    const b = timed({ id: "b", start: 570, end: 660 });
    const c = timed({ id: "c", start: 630, end: 690 });
    const d = timed({ id: "d", start: 720, end: 780 });
    const groups = overlapGroups([c, d, a, b]);
    expect(groups.map(ids)).toEqual([["a", "b", "c"], ["d"]]);
  });

  it("keeps touching sessions in separate components", () => {
    const a = timed({ id: "a", start: 600, end: 660 });
    const b = timed({ id: "b", start: 660, end: 720 });
    expect(overlapGroups([a, b]).map(ids)).toEqual([["a"], ["b"]]);
  });

  it("never connects sessions on different days", () => {
    const fri = timed({ id: "a:pt", day: "pt", start: 600, end: 660 });
    const sat = timed({ id: "a:sob", day: "sob", start: 600, end: 660 });
    expect(overlapGroups([fri, sat]).map(ids)).toEqual([["a:pt"], ["a:sob"]]);
  });

  it("lays out all-day sessions like any other interval", () => {
    const zone = timed({ id: "z", start: 540, end: 1080, allDay: true, typeIds: [242] });
    const talk = timed({ id: "t", start: 600, end: 620 });
    expect(overlapGroups([zone, talk]).map(ids)).toEqual([["z", "t"]]);
  });

  it("uses the supplied end function", () => {
    const short = timed({ id: "s", start: 600, end: 605 });
    const next = timed({ id: "n", start: 610, end: 640 });
    expect(overlapGroups([short, next]).map(ids)).toEqual([["s"], ["n"]]);
    expect(overlapGroups([short, next], (s) => packingEnd(s, 15)).map(ids)).toEqual([["s", "n"]]);
  });

  it("returns [] for no sessions", () => {
    expect(overlapGroups([])).toEqual([]);
  });
});

describe("packingEnd", () => {
  it("is the larger of the visual end and start + minMinutes", () => {
    expect(packingEnd(timed({ id: "a", start: 600, end: 605 }), 15)).toBe(615);
    expect(packingEnd(timed({ id: "b", start: 600, end: 660 }), 15)).toBe(660);
    expect(packingEnd(timed({ id: "p", start: 600, end: null }), 25)).toBe(625);
    expect(packingEnd(timed({ id: "q", start: 600, end: null }), 0)).toBe(620);
  });
});

describe("packLanes", () => {
  it("packs a three-way overlap into three lanes", () => {
    const a = timed({ id: "a", start: 600, end: 660 });
    const b = timed({ id: "b", start: 615, end: 675 });
    const c = timed({ id: "c", start: 630, end: 690 });
    const lanes = packLanes([a, b, c], 0);
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 3 });
    expect(lanes.get("b")).toEqual({ lane: 1, lanes: 3 });
    expect(lanes.get("c")).toEqual({ lane: 2, lanes: 3 });
  });

  it("reuses a lane once its last session has ended (bridging component)", () => {
    const a = timed({ id: "a", start: 540, end: 600 });
    const b = timed({ id: "b", start: 570, end: 660 });
    const c = timed({ id: "c", start: 630, end: 690 });
    const d = timed({ id: "d", start: 720, end: 780 });
    const lanes = packLanes([a, b, c, d], 0);
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("b")).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get("c")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("d")).toEqual({ lane: 0, lanes: 1 });
  });

  it("gives the longer of two sessions with the same start the lower lane", () => {
    const long = timed({ id: "long", start: 600, end: 700 });
    const short = timed({ id: "short", start: 600, end: 630 });
    const lanes = packLanes([short, long], 0);
    expect(lanes.get("long")?.lane).toBe(0);
    expect(lanes.get("short")?.lane).toBe(1);
  });

  it("returns lanes = 2 for a 09:00–18:00 all-day session and a 10:00–10:20 session while overlaps stays false", () => {
    const zone = timed({ id: "z", start: 540, end: 1080, allDay: true, typeIds: [242] });
    const talk = timed({ id: "t", start: 600, end: 620 });
    const lanes = packLanes([zone, talk], 0);
    expect(lanes.get("z")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("t")).toEqual({ lane: 1, lanes: 2 });
    expect(overlaps(zone, talk)).toBe(false);
  });

  it("puts two sessions that collide only through packing ends in one component with lanes = 2", () => {
    const short = timed({ id: "s", start: 600, end: 605 });
    const next = timed({ id: "n", start: 610, end: 640 });
    const loose = packLanes([short, next], 0);
    expect(loose.get("s")).toEqual({ lane: 0, lanes: 1 });
    expect(loose.get("n")).toEqual({ lane: 0, lanes: 1 });
    const tight = packLanes([short, next], 15);
    expect(tight.get("s")).toEqual({ lane: 0, lanes: 2 });
    expect(tight.get("n")).toEqual({ lane: 1, lanes: 2 });
  });

  it("never assigns two overlapping sessions the same lane", () => {
    const starts = [570, 575, 585, 600, 600, 615, 630, 645, 660, 700, 705, 720];
    const list = starts.map((start, i) => timed({ id: `s${i}`, start, end: start + 60 + (i % 3) * 15 }));
    const lanes = packLanes(list, 12);
    for (const a of list) {
      for (const b of list) {
        if (a.id === b.id) continue;
        const la = lanes.get(a.id);
        const lb = lanes.get(b.id);
        if (la === undefined || lb === undefined) throw new Error("missing lane");
        if (a.start < packingEnd(b, 12) && b.start < packingEnd(a, 12)) expect(la.lane).not.toBe(lb.lane);
      }
    }
  });

  it("returns an empty map for no sessions", () => {
    expect(packLanes([], 0).size).toBe(0);
  });
});

describe("maxConcurrency", () => {
  it("is 0 for no sessions", () => {
    expect(maxConcurrency([])).toBe(0);
  });

  it("counts the largest number of sessions running at one minute", () => {
    const a = timed({ id: "a", start: 600, end: 660 });
    const b = timed({ id: "b", start: 630, end: 690 });
    const c = timed({ id: "c", start: 660, end: 720 });
    expect(maxConcurrency([a, b, c])).toBe(2);
    const d = timed({ id: "d", start: 650, end: 720 });
    expect(maxConcurrency([a, b, d])).toBe(3);
  });

  it("does not count touching sessions as concurrent", () => {
    const a = timed({ id: "a", start: 600, end: 660 });
    const b = timed({ id: "b", start: 660, end: 720 });
    expect(maxConcurrency([a, b])).toBe(1);
  });

  it("counts per day", () => {
    const fri = timed({ id: "a:pt", day: "pt", start: 600, end: 660 });
    const sat = timed({ id: "a:sob", day: "sob", start: 600, end: 660 });
    expect(maxConcurrency([fri, sat])).toBe(1);
  });

  it("counts a point session for 20 minutes", () => {
    const point = timed({ id: "p", start: 600, end: null });
    const talk = timed({ id: "t", start: 615, end: 660 });
    expect(maxConcurrency([point, talk])).toBe(2);
  });
});

describe("planConflicts", () => {
  const a = makeSession({ id: "1:pt", eventId: 1, start: 600, end: 660 });
  const b = makeSession({ id: "2:pt", eventId: 2, start: 630, end: 690 });
  const sat = makeSession({ id: "3:sob", eventId: 3, day: "sob", start: 600, end: 660 });
  const later = makeSession({ id: "4:pt", eventId: 4, start: 700, end: 760 });
  const zone = makeSession({ id: "5:pt", eventId: 5, start: 540, end: 1080, allDay: true, typeIds: [242] });
  const noTime = makeSession({ id: "6:pt", eventId: 6, start: null, end: null, timeText: "" });

  it("lists each overlapping pair once with the earlier session as a", () => {
    const pairs = planConflicts([b, a, sat, later, zone, noTime]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.a.id).toBe("1:pt");
    expect(pairs[0]?.b.id).toBe("2:pt");
  });

  it("returns [] when nothing overlaps", () => {
    expect(planConflicts([a, later, sat])).toEqual([]);
    expect(planConflicts([])).toEqual([]);
  });

  it("sorts pairs by day then by start", () => {
    const x = makeSession({ id: "9:pt", eventId: 9, start: 900, end: 960 });
    const y = makeSession({ id: "10:pt", eventId: 10, start: 930, end: 990 });
    const s1 = makeSession({ id: "7:sob", eventId: 7, day: "sob", start: 600, end: 660 });
    const s2 = makeSession({ id: "8:sob", eventId: 8, day: "sob", start: 630, end: 690 });
    const pairs = planConflicts([s1, s2, x, y, a, b]);
    expect(pairs.map((p) => [p.a.id, p.b.id])).toEqual([
      ["1:pt", "2:pt"],
      ["9:pt", "10:pt"],
      ["7:sob", "8:sob"],
    ]);
  });

  it("lists every partner of a session that conflicts with several", () => {
    const c = makeSession({ id: "11:pt", eventId: 11, start: 640, end: 700 });
    const pairs = planConflicts([a, b, c]);
    expect(pairs.map((p) => [p.a.id, p.b.id])).toEqual([
      ["1:pt", "2:pt"],
      ["1:pt", "11:pt"],
      ["2:pt", "11:pt"],
    ]);
  });
});

describe("conflictCount", () => {
  const a = makeSession({ id: "1:pt", eventId: 1, start: 600, end: 660 });
  const b = makeSession({ id: "2:pt", eventId: 2, start: 630, end: 690 });
  const c = makeSession({ id: "3:pt", eventId: 3, start: 650, end: 700 });
  const zone = makeSession({ id: "5:pt", eventId: 5, start: 540, end: 1080, allDay: true, typeIds: [242] });

  it("counts the plan sessions overlapping the session, excluding itself and all-day zones", () => {
    expect(conflictCount(a, [a, b, c, zone])).toBe(2);
    expect(conflictCount(c, [a, b, c, zone])).toBe(2);
    expect(conflictCount(zone, [a, b, c, zone])).toBe(0);
  });

  it("is 0 when the session is alone in the plan", () => {
    expect(conflictCount(a, [a])).toBe(0);
    expect(conflictCount(a, [])).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/overlaps.test.ts`

Expected: `Error: Failed to resolve import "./overlaps" from "src/domain/overlaps.test.ts". Does the file exist?`

- [ ] **Step 3: Write the implementation**

Create `src/domain/overlaps.ts`:

```ts
import type { Session, TimedSession } from "../data/types";
import { hasStart } from "../data/types";
import { visualEnd } from "./time";

export type EndOf = (s: TimedSession) => number;

/** Spec §5.3: the only place the allDay guard lives. */
export function overlaps(a: Session, b: Session): boolean {
  if (a.day !== b.day) return false;
  if (a.allDay || b.allDay) return false;
  if (!hasStart(a) || !hasStart(b)) return false;
  return a.start < visualEnd(b) && b.start < visualEnd(a);
}

function groupByDay(sessions: TimedSession[]): TimedSession[][] {
  const groups = new Map<string, TimedSession[]>();
  for (const s of sessions) {
    const group = groups.get(s.day);
    if (group === undefined) groups.set(s.day, [s]);
    else group.push(s);
  }
  return [...groups.values()];
}

/** Connected components of the same-day interval graph, by a sweep line over starts. */
export function overlapGroups(sessions: TimedSession[], endOf: EndOf = visualEnd): TimedSession[][] {
  const components: TimedSession[][] = [];
  for (const daySessions of groupByDay(sessions)) {
    const sorted = [...daySessions].sort((a, b) => a.start - b.start);
    let current: TimedSession[] = [];
    let reach = Number.NEGATIVE_INFINITY;
    for (const s of sorted) {
      if (current.length > 0 && s.start < reach) {
        current.push(s);
        reach = Math.max(reach, endOf(s));
      } else {
        current = [s];
        components.push(current);
        reach = endOf(s);
      }
    }
  }
  return components;
}

export interface LaneInfo {
  lane: number;
  lanes: number;
}

export function packingEnd(s: TimedSession, minMinutes: number): number {
  return Math.max(visualEnd(s), s.start + minMinutes);
}

/** Greedy interval packing per connected component (components computed with packing ends). */
export function packLanes(sessions: TimedSession[], minMinutes: number): Map<string, LaneInfo> {
  const endOf: EndOf = (s) => packingEnd(s, minMinutes);
  const result = new Map<string, LaneInfo>();
  for (const component of overlapGroups(sessions, endOf)) {
    const ordered = [...component].sort((a, b) => a.start - b.start || endOf(b) - endOf(a));
    const laneEnds: number[] = [];
    const laneOf = new Map<string, number>();
    for (const s of ordered) {
      const free = laneEnds.findIndex((end) => end <= s.start);
      const lane = free >= 0 ? free : laneEnds.length;
      laneEnds[lane] = endOf(s);
      laneOf.set(s.id, lane);
    }
    for (const [id, lane] of laneOf) result.set(id, { lane, lanes: laneEnds.length });
  }
  return result;
}

interface SweepEvent {
  at: number;
  delta: 1 | -1;
}

export function maxConcurrency(sessions: TimedSession[]): number {
  let best = 0;
  for (const daySessions of groupByDay(sessions)) {
    const events: SweepEvent[] = [];
    for (const s of daySessions) {
      events.push({ at: s.start, delta: 1 });
      events.push({ at: visualEnd(s), delta: -1 });
    }
    events.sort((a, b) => a.at - b.at || a.delta - b.delta);
    let running = 0;
    for (const event of events) {
      running += event.delta;
      if (running > best) best = running;
    }
  }
  return best;
}

export interface ConflictPair {
  a: Session;
  b: Session;
}

function compareDayStart(a: TimedSession, b: TimedSession): number {
  if (a.day !== b.day) return a.day < b.day ? -1 : 1;
  return a.start - b.start;
}

/** Pairs are generated from the (day, start)-sorted list, so they come out sorted by a.day then a.start. */
export function planConflicts(planSessions: Session[]): ConflictPair[] {
  const ordered = planSessions.filter(hasStart).sort(compareDayStart);
  const pairs: ConflictPair[] = [];
  ordered.forEach((a, i) => {
    for (const b of ordered.slice(i + 1)) {
      if (overlaps(a, b)) pairs.push({ a, b });
    }
  });
  return pairs;
}

export function conflictCount(s: Session, planSessions: Session[]): number {
  return planSessions.filter((other) => other.id !== s.id && overlaps(s, other)).length;
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `npx vitest run src/domain/overlaps.test.ts`

Expected: all tests pass.

Run: `npm run typecheck`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/domain/overlaps.ts src/domain/overlaps.test.ts
git commit -m "feat(domain): add overlap detection, lane packing and plan conflicts" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```

---

### Task 11: Filters, search index and facet counts (`src/domain/filters.ts`)

**Files:**
- Create: `src/domain/filters.ts`
- Test: `src/domain/filters.test.ts`

**Interfaces:**
- Consumes: `ScheduleData`, `Session`, `SignupStatus`, `Term` from `src/data/types.ts`; `DataIndex`, `buildIndex(data)`, `locationsOf(s, index)`, `speakersOf(s, index)` from `src/domain/lookup.ts`; `normalizeText(s)` from `src/domain/normalize.ts`; `makeSession`, `makeSpeaker`, `makeLocation`, `makeData` from `src/test/fixtures/build.ts`.
- Produces (used by the store, `derive.ts`, `FiltersPanel`, `FilterChips`):
  - `interface Filters { types: number[]; themes: number[]; brands: number[]; locations: number[]; signup: SignupStatus[]; query: string; onlyFavourites: boolean; hideAllDay: boolean }`
  - `const EMPTY_FILTERS: Filters`
  - `type Facet = "types" | "themes" | "brands" | "locations" | "signup"`; `const FACETS: Facet[]` in that order
  - `const SIGNUP_ORDER: SignupStatus[] = ["open", "full", "included", "free", "soon", "unknown"]`
  - `type SearchIndex = Map<string, string>`; `buildSearchIndex(data: ScheduleData, index: DataIndex): SearchIndex`
  - `interface FilterOptions { ignoreQuery?: boolean; ignoreFavourites?: boolean }`
  - `applyFilters(sessions: Session[], filters: Filters, planSet: ReadonlySet<string>, search: SearchIndex, opts?: FilterOptions): Session[]`
  - `facetCounts(sessions: Session[], filters: Filters, facet: Facet, planSet: ReadonlySet<string>, search: SearchIndex): Map<number | SignupStatus, number>` (options absent from the map have count 0)
  - `activeFilterCount(f: Filters): number`
  - `signupLabel(status: SignupStatus, data: ScheduleData): string`

Rules implemented (spec §5.4): a session passes when it matches every non-empty facet (OR inside a facet, AND across facets), the signup facet by `session.signup.status`, the all-day rule (`hideAllDay` removes `allDay` sessions), favourites-only against `planSet`, and the query. The query is `normalizeText(filters.query)` trimmed at both ends and matched as a substring of the session's index entry, which is `normalizeText` of the title, speaker names, byline, theme names, brand names, location names and type names joined by spaces. `ignoreQuery` and `ignoreFavourites` skip those two checks. `facetCounts` runs `applyFilters` with the requested facet emptied and counts each option that the remaining sessions carry. `signupLabel` returns the `signupStatuses` term name for the status, the canonical §4.2 term name when the data has no such term, and `"Brak informacji"` for `unknown`.

- [ ] **Step 1: Write the failing test**

Create `src/domain/filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ScheduleData, Session, Term } from "../data/types";
import { makeData, makeLocation, makeSession, makeSpeaker } from "../test/fixtures/build";
import { buildIndex } from "./lookup";
import {
  EMPTY_FILTERS,
  FACETS,
  SIGNUP_ORDER,
  activeFilterCount,
  applyFilters,
  buildSearchIndex,
  facetCounts,
  signupLabel,
  type Filters,
} from "./filters";

const term = (id: number, slug: string, name: string, count = 1): Term => ({ id, slug, name, count });

// Real records from the 2026-09-03 snapshot (ids, titles, terms and speakers as fetched).
const natura = makeSession({
  id: "39555:pt",
  eventId: 39555,
  day: "pt",
  title: "Natura nie powtarza ujęć. O pracy fotografa krajobrazowego",
  start: 645,
  end: 705,
  timeText: "10:45-11:45",
  speakerIds: [46694],
  byline: null,
  typeIds: [184],
  themeIds: [81, 260, 263, 246],
  brandIds: [148],
  locationIds: [281],
  signup: { status: "included", url: null, label: "W ramach festiwalu" },
  url: "https://swiatlosila.pl/cyfrowe-event/natura-nie-powtarza-ujec-o-pracy-fotografa-krajobrazowego/",
});

const swiatlo = makeSession({
  id: "39556:pt",
  eventId: 39556,
  day: "pt",
  title: "Światło, które widzisz. Oświetlenie LED w fotografii kreatywnej",
  start: 660,
  end: 720,
  timeText: "11:00-12:00",
  speakerIds: [379],
  byline: null,
  typeIds: [184],
  themeIds: [262, 267, 275],
  brandIds: [108, 109],
  locationIds: [279],
  signup: { status: "included", url: null, label: "W ramach festiwalu" },
  url: "https://swiatlosila.pl/cyfrowe-event/swiatlo-ktore-widzisz-oswietlenie-led-w-fotografii-kreatywnej/",
});

const fotogra = makeSession({
  id: "39549:czw",
  eventId: 39549,
  day: "czw",
  title: "Before Fotogra – Color Hunting",
  start: 1020,
  end: 1140,
  timeText: "17:00-19:00",
  speakerIds: [],
  byline: "Sony",
  typeIds: [185, 3],
  themeIds: [251, 256, 271, 272],
  brandIds: [11],
  locationIds: [283],
  signup: {
    status: "open",
    url: "https://www.cyfrowe.pl/swiatlosila-fotogra-before-fotospacer-colour-hunting-z-sony-p.html",
    label: "Zapisy",
  },
  url: "https://swiatlosila.pl/cyfrowe-event/before-fotogra-color-hunting/",
});

const workshop = makeSession({
  id: "41151:pt",
  eventId: 41151,
  day: "pt",
  title: "Warsztaty Masterclass – Moda na błysk",
  start: 570,
  end: 960,
  timeText: "09:30-16:00",
  speakerIds: [],
  byline: null,
  typeIds: [5],
  themeIds: [255, 262, 267, 275],
  brandIds: [95],
  locationIds: [290],
  signup: {
    status: "full",
    url: "https://www.cyfrowe.pl/swiatlosila-warsztaty-masterclass-moda-na-blysk-katarzyna-budziszyna-danaj-p.html",
    label: "Brak miejsc",
  },
  url: "https://swiatlosila.pl/cyfrowe-event/warsztaty-masterclass-moda-na-blysk/",
});

// Synthetic records for the all-day and byline-only cases.
const zone = makeSession({
  id: "4:pt",
  eventId: 4,
  day: "pt",
  title: "Strefa sprzętu",
  start: 540,
  end: 1080,
  allDay: true,
  timeText: "09:00-18:00",
  speakerIds: [],
  byline: null,
  typeIds: [242],
  themeIds: [],
  brandIds: [],
  locationIds: [308],
  signup: { status: "included", url: null, label: "W ramach festiwalu" },
});

const film = makeSession({
  id: "6:sob",
  eventId: 6,
  day: "sob",
  title: "Pokaz filmowy",
  start: 1140,
  end: 1200,
  timeText: "19:00-20:00",
  speakerIds: [],
  byline: "KLIK FILM",
  typeIds: [5],
  themeIds: [],
  brandIds: [],
  locationIds: [],
  signup: { status: "included", url: null, label: "W ramach festiwalu" },
});

const sessions: Session[] = [natura, swiatlo, fotogra, workshop, zone, film];

const data: ScheduleData = makeData(sessions, {
  types: [
    term(184, "prelekcja", "Prelekcja", 51),
    term(5, "warsztaty", "Warsztaty", 12),
    term(242, "ogolne", "Ogólne", 13),
    term(185, "fotogra", "Fotogra", 5),
    term(3, "fotospacer", "Fotospacer", 5),
  ],
  themes: [
    term(81, "fotografia-przyrodnicza", "Fotografia przyrodnicza", 6),
    term(260, "krajobraz", "Krajobraz", 6),
    term(263, "natura", "Natura", 12),
    term(246, "podroz", "Podróż", 11),
    term(262, "moda", "Moda"),
    term(267, "portret", "Portret"),
    term(275, "z-lampa", "Z lampą"),
    term(255, "fotografia-reklamowa", "Fotografia reklamowa"),
    term(251, "fotogra", "Fotogra"),
    term(256, "fotospacer", "Fotospacer"),
    term(271, "stocznia", "Stocznia"),
    term(272, "street", "Street"),
  ],
  brands: [
    term(148, "manfrotto", "Manfrotto", 1),
    term(108, "newell", "Newell"),
    term(109, "voigtlander", "Voigtlander"),
    term(11, "sony", "Sony"),
    term(95, "glareone", "GlareOne"),
  ],
  locations: [
    makeLocation({ id: 281, slug: "so-salsa-1-2", name: "SoSalsa - poziom II - Sala wykładowa nr 2", count: 16, venue: "SoSalsa", level: "II", room: "Sala wykładowa nr 2", short: "Sala wykł. 2", order: 0 }),
    makeLocation({ id: 279, slug: "klub-bokserski-poziom-ii-sala-wykladowa-nr-4", name: "Klub bokserski - poziom II - Sala wykładowa nr 4", count: 14, venue: "Klub bokserski", level: "II", room: "Sala wykładowa nr 4", short: "Sala wykł. 4", order: 1 }),
    makeLocation({ id: 290, slug: "zero-zero-antresola-sala-warsztatowa-vi", name: "ZERO ZERO Antresola - Sala warsztatowa VI", count: 2, venue: "ZERO ZERO Antresola", level: null, room: "Sala warsztatowa VI", short: "Warsztat. VI (antresola)", order: 2 }),
    makeLocation({ id: 283, slug: "zero-zero-przed-wejsciem", name: "ZERO ZERO (przed wejściem)", count: 1, venue: "ZERO ZERO (przed wejściem)", level: null, room: null, short: "Zero Zero · wejście", order: 3 }),
    makeLocation({ id: 308, slug: "stoiska-wystawcow-poziom-i-plenum", name: "Stoiska wystawców - poziom I (PLENUM)", count: 54, venue: "Stoiska wystawców", level: "I", room: "PLENUM", short: "Stoiska · Plenum", order: 4 }),
  ],
  signupStatuses: [
    term(327, "brak-miejsc", "Brak miejsc", 9),
    term(194, "w-ramach-festiwalu", "W ramach festiwalu", 136),
    term(56, "zapisy", "Zapisy", 8),
  ],
  speakers: [
    makeSpeaker({ id: 46694, slug: "pawel-uchorczak", name: "Paweł Uchorczak", url: "https://swiatlosila.pl/cyfrowe-prelegent/pawel-uchorczak/" }),
    makeSpeaker({ id: 379, slug: "piotr-werner-2", name: "Piotr Werner", url: "https://swiatlosila.pl/cyfrowe-prelegent/piotr-werner-2/" }),
  ],
});

const index = buildIndex(data);
const search = buildSearchIndex(data, index);
const none: ReadonlySet<string> = new Set();

const ids = (list: Session[]): string[] => list.map((s) => s.id);
const withQuery = (query: string, rest: Partial<Filters> = {}): Filters => ({ ...EMPTY_FILTERS, ...rest, query });

describe("constants", () => {
  it("EMPTY_FILTERS has every facet empty and both toggles off", () => {
    expect(EMPTY_FILTERS).toEqual({
      types: [],
      themes: [],
      brands: [],
      locations: [],
      signup: [],
      query: "",
      onlyFavourites: false,
      hideAllDay: false,
    });
  });

  it("FACETS and SIGNUP_ORDER are in the spec order", () => {
    expect(FACETS).toEqual(["types", "themes", "brands", "locations", "signup"]);
    expect(SIGNUP_ORDER).toEqual(["open", "full", "included", "free", "soon", "unknown"]);
  });
});

describe("buildSearchIndex", () => {
  it("indexes every session by id", () => {
    expect(search.size).toBe(sessions.length);
    for (const s of sessions) expect(search.has(s.id)).toBe(true);
  });

  it("folds title, speakers, byline, themes, brands, locations and types into one normalized string", () => {
    const entry = search.get("39555:pt") ?? "";
    expect(entry).toContain("natura nie powtarza ujec");
    expect(entry).toContain("pawel uchorczak");
    expect(entry).toContain("krajobraz");
    expect(entry).toContain("manfrotto");
    expect(entry).toContain("sala wykladowa nr 2");
    expect(entry).toContain("prelekcja");
    expect(search.get("39549:czw") ?? "").toContain("sony");
    expect(search.get("6:sob") ?? "").toContain("klik film");
  });
});

describe("applyFilters query", () => {
  it("finds 'Światło' with the query 'swiatlo'", () => {
    expect(ids(applyFilters(sessions, withQuery("swiatlo"), none, search))).toEqual(["39556:pt"]);
  });

  it("finds 'Paweł' with the query 'pawel'", () => {
    expect(ids(applyFilters(sessions, withQuery("pawel"), none, search))).toEqual(["39555:pt"]);
  });

  it("normalizes the query itself, so 'ŚWIATŁO' also matches", () => {
    expect(ids(applyFilters(sessions, withQuery("ŚWIATŁO"), none, search))).toEqual(["39556:pt"]);
  });

  it("matches theme names, brand names, location names, type names and the byline", () => {
    expect(ids(applyFilters(sessions, withQuery("moda"), none, search))).toEqual(["39556:pt", "41151:pt"]);
    expect(ids(applyFilters(sessions, withQuery("manfrotto"), none, search))).toEqual(["39555:pt"]);
    expect(ids(applyFilters(sessions, withQuery("antresola"), none, search))).toEqual(["41151:pt"]);
    expect(ids(applyFilters(sessions, withQuery("prelekcja"), none, search))).toEqual(["39555:pt", "39556:pt"]);
    expect(ids(applyFilters(sessions, withQuery("klik"), none, search))).toEqual(["6:sob"]);
  });

  it("returns nothing for a query nobody matches and everything for a blank query", () => {
    expect(applyFilters(sessions, withQuery("zzz"), none, search)).toEqual([]);
    expect(ids(applyFilters(sessions, withQuery("   "), none, search))).toEqual(ids(sessions));
  });

  it("skips the query with ignoreQuery", () => {
    expect(ids(applyFilters(sessions, withQuery("zzz"), none, search, { ignoreQuery: true }))).toEqual(ids(sessions));
  });
});

describe("applyFilters facets", () => {
  it("ORs values inside a facet", () => {
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, types: [184] }, none, search))).toEqual(["39555:pt", "39556:pt"]);
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, types: [184, 5] }, none, search))).toEqual([
      "39555:pt",
      "39556:pt",
      "41151:pt",
      "6:sob",
    ]);
  });

  it("ANDs across facets", () => {
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, types: [184], brands: [148] }, none, search))).toEqual(["39555:pt"]);
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, types: [184], brands: [11] }, none, search))).toEqual([]);
  });

  it("matches a session carrying any of the wanted term ids", () => {
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, themes: [262] }, none, search))).toEqual(["39556:pt", "41151:pt"]);
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, locations: [308] }, none, search))).toEqual(["4:pt"]);
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, types: [3] }, none, search))).toEqual(["39549:czw"]);
  });

  it("filters the signup facet by status value", () => {
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, signup: ["open"] }, none, search))).toEqual(["39549:czw"]);
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, signup: ["full", "included"] }, none, search))).toEqual([
      "39555:pt",
      "39556:pt",
      "41151:pt",
      "4:pt",
      "6:sob",
    ]);
  });

  it("combines a facet with the query", () => {
    expect(ids(applyFilters(sessions, withQuery("pawel", { types: [184] }), none, search))).toEqual(["39555:pt"]);
    expect(ids(applyFilters(sessions, withQuery("pawel", { types: [5] }), none, search))).toEqual([]);
  });
});

describe("applyFilters toggles", () => {
  it("hides all-day sessions with hideAllDay", () => {
    const kept = applyFilters(sessions, { ...EMPTY_FILTERS, hideAllDay: true }, none, search);
    expect(ids(kept)).not.toContain("4:pt");
    expect(kept).toHaveLength(sessions.length - 1);
  });

  it("keeps only plan sessions with onlyFavourites", () => {
    const plan = new Set(["41151:pt", "6:sob"]);
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, onlyFavourites: true }, plan, search))).toEqual(["41151:pt", "6:sob"]);
  });

  it("skips favourites-only with ignoreFavourites", () => {
    const plan = new Set(["41151:pt"]);
    expect(ids(applyFilters(sessions, { ...EMPTY_FILTERS, onlyFavourites: true }, plan, search, { ignoreFavourites: true }))).toEqual(ids(sessions));
  });

  it("still applies facets and hideAllDay when both ignore options are set", () => {
    const filters: Filters = { ...EMPTY_FILTERS, types: [242, 5], query: "zzz", onlyFavourites: true, hideAllDay: true };
    expect(ids(applyFilters(sessions, filters, none, search, { ignoreQuery: true, ignoreFavourites: true }))).toEqual(["41151:pt", "6:sob"]);
  });
});

describe("facetCounts", () => {
  it("ignores the counted facet's own selection but applies every other facet and the query", () => {
    const counts = facetCounts(sessions, withQuery("natura", { types: [5] }), "types", none, search);
    expect(counts.get(184)).toBe(1);
    expect(counts.get(5)).toBeUndefined();
    expect(counts.size).toBe(1);
  });

  it("counts every option the remaining sessions carry", () => {
    const counts = facetCounts(sessions, { ...EMPTY_FILTERS, types: [184] }, "brands", none, search);
    expect([...counts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))).toEqual([
      [108, 1],
      [109, 1],
      [148, 1],
    ]);
  });

  it("keys the signup facet by status", () => {
    const counts = facetCounts(sessions, EMPTY_FILTERS, "signup", none, search);
    expect(counts.get("included")).toBe(4);
    expect(counts.get("open")).toBe(1);
    expect(counts.get("full")).toBe(1);
    expect(counts.get("unknown")).toBeUndefined();
  });

  it("applies hideAllDay and favourites-only", () => {
    const hidden = facetCounts(sessions, { ...EMPTY_FILTERS, hideAllDay: true }, "locations", none, search);
    expect(hidden.get(308)).toBeUndefined();
    expect(hidden.get(281)).toBe(1);
    const plan = new Set(["4:pt"]);
    const favs = facetCounts(sessions, { ...EMPTY_FILTERS, onlyFavourites: true }, "locations", plan, search);
    expect([...favs.entries()]).toEqual([[308, 1]]);
  });

  it("counts all options when the facet's own selection matches nothing", () => {
    const counts = facetCounts(sessions, { ...EMPTY_FILTERS, types: [999] }, "types", none, search);
    expect(counts.get(184)).toBe(2);
    expect(counts.get(5)).toBe(2);
    expect(counts.get(185)).toBe(1);
    expect(counts.get(3)).toBe(1);
    expect(counts.get(242)).toBe(1);
  });
});

describe("activeFilterCount", () => {
  it("is 0 for EMPTY_FILTERS and for a whitespace query", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(activeFilterCount(withQuery("   "))).toBe(0);
  });

  it("adds every facet value, a non-blank query and each toggle", () => {
    const filters: Filters = {
      types: [184, 5],
      themes: [],
      brands: [148],
      locations: [],
      signup: ["open"],
      query: "a",
      onlyFavourites: true,
      hideAllDay: true,
    };
    expect(activeFilterCount(filters)).toBe(7);
  });
});

describe("signupLabel", () => {
  it("returns the matching term name from the data", () => {
    expect(signupLabel("open", data)).toBe("Zapisy");
    expect(signupLabel("full", data)).toBe("Brak miejsc");
    expect(signupLabel("included", data)).toBe("W ramach festiwalu");
  });

  it("returns 'Brak informacji' for unknown", () => {
    expect(signupLabel("unknown", data)).toBe("Brak informacji");
  });

  it("falls back to the canonical term name when the data has no such term", () => {
    expect(signupLabel("free", data)).toBe("WSTĘP WOLNY");
    expect(signupLabel("soon", data)).toBe("Zapisy wkrótce");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/filters.test.ts`

Expected: `Error: Failed to resolve import "./filters" from "src/domain/filters.test.ts". Does the file exist?`

- [ ] **Step 3: Write the implementation**

Create `src/domain/filters.ts`:

```ts
import type { ScheduleData, Session, SignupStatus, Term } from "../data/types";
import type { DataIndex } from "./lookup";
import { locationsOf, speakersOf } from "./lookup";
import { normalizeText } from "./normalize";

export interface Filters {
  types: number[];
  themes: number[];
  brands: number[];
  locations: number[];
  signup: SignupStatus[];
  query: string;
  onlyFavourites: boolean;
  hideAllDay: boolean;
}

export const EMPTY_FILTERS: Filters = {
  types: [],
  themes: [],
  brands: [],
  locations: [],
  signup: [],
  query: "",
  onlyFavourites: false,
  hideAllDay: false,
};

export type Facet = "types" | "themes" | "brands" | "locations" | "signup";

export const FACETS: Facet[] = ["types", "themes", "brands", "locations", "signup"];

export const SIGNUP_ORDER: SignupStatus[] = ["open", "full", "included", "free", "soon", "unknown"];

export type SearchIndex = Map<string, string>;

type TermFacet = Exclude<Facet, "signup">;

const TERM_FACETS: TermFacet[] = ["types", "themes", "brands", "locations"];

const SESSION_KEY: Record<TermFacet, "typeIds" | "themeIds" | "brandIds" | "locationIds"> = {
  types: "typeIds",
  themes: "themeIds",
  brands: "brandIds",
  locations: "locationIds",
};

function termNames(ids: number[], byId: Map<number, Term>): string[] {
  return ids.flatMap((id) => {
    const t = byId.get(id);
    return t === undefined ? [] : [t.name];
  });
}

/** Spec §5.4: title, speaker names, byline, theme, brand, location and type names, normalized once per session. */
export function buildSearchIndex(data: ScheduleData, index: DataIndex): SearchIndex {
  const result: SearchIndex = new Map();
  for (const s of data.sessions) {
    const parts = [
      s.title,
      ...speakersOf(s, index).map((sp) => sp.name),
      s.byline ?? "",
      ...termNames(s.themeIds, index.themeById),
      ...termNames(s.brandIds, index.brandById),
      ...locationsOf(s, index).map((l) => l.name),
      ...termNames(s.typeIds, index.typeById),
    ];
    result.set(s.id, normalizeText(parts.join(" ")));
  }
  return result;
}

export interface FilterOptions {
  ignoreQuery?: boolean;
  ignoreFavourites?: boolean;
}

function matchesFacets(s: Session, filters: Filters): boolean {
  for (const facet of TERM_FACETS) {
    const wanted = filters[facet];
    if (wanted.length > 0 && !s[SESSION_KEY[facet]].some((id) => wanted.includes(id))) return false;
  }
  if (filters.signup.length > 0 && !filters.signup.includes(s.signup.status)) return false;
  return true;
}

export function applyFilters(
  sessions: Session[],
  filters: Filters,
  planSet: ReadonlySet<string>,
  search: SearchIndex,
  opts: FilterOptions = {},
): Session[] {
  const query = opts.ignoreQuery === true ? "" : normalizeText(filters.query).trim();
  const favouritesOnly = filters.onlyFavourites && opts.ignoreFavourites !== true;
  return sessions.filter((s) => {
    if (!matchesFacets(s, filters)) return false;
    if (filters.hideAllDay && s.allDay) return false;
    if (favouritesOnly && !planSet.has(s.id)) return false;
    if (query !== "" && !(search.get(s.id) ?? "").includes(query)) return false;
    return true;
  });
}

/** Counts per option of `facet` over the sessions left when that facet is cleared and everything else still applies. */
export function facetCounts(
  sessions: Session[],
  filters: Filters,
  facet: Facet,
  planSet: ReadonlySet<string>,
  search: SearchIndex,
): Map<number | SignupStatus, number> {
  const relaxed: Filters = { ...filters };
  relaxed[facet] = [];
  const remaining = applyFilters(sessions, relaxed, planSet, search);
  const counts = new Map<number | SignupStatus, number>();
  const bump = (key: number | SignupStatus): void => {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (const s of remaining) {
    if (facet === "signup") {
      bump(s.signup.status);
    } else {
      for (const id of s[SESSION_KEY[facet]]) bump(id);
    }
  }
  return counts;
}

export function activeFilterCount(f: Filters): number {
  const facetValues = FACETS.reduce((n, facet) => n + f[facet].length, 0);
  const query = f.query.trim() === "" ? 0 : 1;
  const toggles = (f.onlyFavourites ? 1 : 0) + (f.hideAllDay ? 1 : 0);
  return facetValues + query + toggles;
}

/** Canonical cyfrowe-event-zapisy term names (spec §4.2), used when the data lacks the term. */
const SIGNUP_TERM_NAMES: Record<Exclude<SignupStatus, "unknown">, string> = {
  open: "Zapisy",
  full: "Brak miejsc",
  included: "W ramach festiwalu",
  free: "WSTĘP WOLNY",
  soon: "Zapisy wkrótce",
};

const UNKNOWN_SIGNUP_LABEL = "Brak informacji";

export function signupLabel(status: SignupStatus, data: ScheduleData): string {
  if (status === "unknown") return UNKNOWN_SIGNUP_LABEL;
  const canonical = SIGNUP_TERM_NAMES[status];
  const term = data.signupStatuses.find((t) => t.name === canonical);
  return term?.name ?? canonical;
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `npx vitest run src/domain/filters.test.ts`

Expected: all tests pass.

Run: `npm run typecheck`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/domain/filters.ts src/domain/filters.test.ts
git commit -m "feat(domain): add filters, search index and facet counts" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```

---

### Task 12: Clock, live state and default day (`src/domain/now.ts`)

**Files:**
- Create: `src/domain/now.ts`
- Test: `src/domain/now.test.ts`

**Interfaces:**
- Consumes: `Day`, `Session`, `hasStart` from `src/data/types.ts`; `visualEnd` from `src/domain/time.ts`; `makeDay`, `makeSession` from `src/test/fixtures/build.ts`.
- Produces (used by `main.tsx`, the store, `boot.ts`, `plan.ts`, `LiveChip`, `NowLine`, `SessionCard`):
  - `const SOON_MINUTES = 15`
  - `localDateString(d: Date): string` (`"YYYY-MM-DD"` in local time)
  - `resolveNow(search: string, realNow?: () => Date): Date`
  - `interface Clock { now(): Date }`; `createClock(search: string, realNow?: () => number): Clock`
  - `nowFor(day: Day, now: Date): number | null`
  - `type LiveState = "past" | "live" | "soon" | "upcoming"`; `liveState(s: Session, nowMinutes: number | null): LiveState`
  - `defaultDay(days: Day[], now: Date, sessionsPerDay: Map<string, number>): Day`
  - `isToday(day: Day, now: Date): boolean`; `isTomorrow(day: Day, now: Date): boolean`
  - `minutesUntil(start: number, nowMinutes: number): number`

Rules implemented (spec §5.6): `?now=v` is parsed with `new Date(v)` after appending `T00:00` to a value matching `/^\d{4}-\d{2}-\d{2}$/` (so a date-only override is local midnight, not UTC); a value that does not parse to a finite time, or no `now` parameter, falls back to the real clock. `createClock` freezes `bootedAt = realNow()` and returns `base + (realNow() - bootedAt)` so an override keeps advancing. `nowFor` returns minutes since local midnight when `now`'s local date equals `day.date`, else `null`. `liveState`: `"upcoming"` when `start == null` or `nowMinutes == null`; `"past"` when `visualEnd <= now`; `"live"` when `start <= now < visualEnd`; `"soon"` when `0 < start - now <= 15`; else `"upcoming"`. `defaultDay`: the first day with more than 5 sessions whose date is on or after today, else the first day with more than 5 sessions, else the first day. Note that `URLSearchParams` decodes `+` as a space, so a positive offset in the override must be written `%2B02:00`.

- [ ] **Step 1: Write the failing test**

Create `src/domain/now.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeDay, makeSession } from "../test/fixtures/build";
import {
  SOON_MINUTES,
  createClock,
  defaultDay,
  isToday,
  isTomorrow,
  liveState,
  localDateString,
  minutesUntil,
  nowFor,
  resolveNow,
} from "./now";

const czw = makeDay({ id: "czw", termId: 276, date: "2026-09-03", label: "Czwartek", short: "Czw", labelLong: "Czwartek, 3 września" });
const pt = makeDay({ id: "pt", termId: 53, date: "2026-09-04", label: "Piątek", short: "Pt", labelLong: "Piątek, 4 września" });
const sob = makeDay({ id: "sob", termId: 18, date: "2026-09-05", label: "Sobota", short: "Sob", labelLong: "Sobota, 5 września" });
const days = [czw, pt, sob];
const counts = new Map<string, number>([
  ["czw", 1],
  ["pt", 82],
  ["sob", 80],
]);

const fixed = (): Date => new Date(2026, 8, 4, 10, 30);

describe("localDateString", () => {
  it("formats the local calendar date with zero padding", () => {
    expect(localDateString(new Date(2026, 8, 4, 10, 30))).toBe("2026-09-04");
    expect(localDateString(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
    expect(localDateString(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
});

describe("resolveNow", () => {
  it("parses a date-time without an offset as local time", () => {
    expect(resolveNow("?now=2026-09-04T10:30", fixed)).toEqual(new Date(2026, 8, 4, 10, 30));
  });

  it("parses a date-time with an offset as that instant", () => {
    expect(resolveNow("?now=2026-09-04T08:30:00%2B02:00", fixed).getTime()).toBe(Date.UTC(2026, 8, 4, 6, 30));
    expect(resolveNow("?now=2026-09-04T06:30:00Z", fixed).getTime()).toBe(Date.UTC(2026, 8, 4, 6, 30));
  });

  it("resolves a date-only override to local midnight", () => {
    expect(resolveNow("?now=2026-09-04", fixed)).toEqual(new Date(2026, 8, 4, 0, 0));
  });

  it("falls back to the real clock without a now parameter", () => {
    expect(resolveNow("", fixed)).toEqual(fixed());
    expect(resolveNow("?d=pt&v=grid", fixed)).toEqual(fixed());
  });

  it("falls back to the real clock for an unparseable or empty override", () => {
    expect(resolveNow("?now=yesterday", fixed)).toEqual(fixed());
    expect(resolveNow("?now=", fixed)).toEqual(fixed());
    expect(resolveNow("?now=2026-13-45", fixed)).toEqual(fixed());
  });

  it("reads now next to other parameters", () => {
    expect(resolveNow("?d=pt&now=2026-09-05T09:00&v=list", fixed)).toEqual(new Date(2026, 8, 5, 9, 0));
  });

  it("uses the real Date when no realNow is given", () => {
    const before = Date.now();
    const resolved = resolveNow("").getTime();
    expect(resolved).toBeGreaterThanOrEqual(before);
    expect(resolved).toBeLessThanOrEqual(Date.now());
  });
});

describe("createClock", () => {
  it("advances an override by the elapsed real time", () => {
    let ticks = 1_000_000;
    const clock = createClock("?now=2026-09-04T10:30", () => ticks);
    expect(clock.now()).toEqual(new Date(2026, 8, 4, 10, 30));
    ticks += 90_000;
    expect(clock.now()).toEqual(new Date(2026, 8, 4, 10, 31, 30));
  });

  it("follows the real clock without an override", () => {
    let ticks = 5_000;
    const clock = createClock("", () => ticks);
    expect(clock.now().getTime()).toBe(5_000);
    ticks = 65_000;
    expect(clock.now().getTime()).toBe(65_000);
  });

  it("uses Date.now when no realNow is given", () => {
    const before = Date.now();
    const clock = createClock("");
    expect(clock.now().getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe("nowFor", () => {
  it("returns minutes since local midnight on the day's date", () => {
    expect(nowFor(pt, new Date(2026, 8, 4, 10, 30))).toBe(630);
    expect(nowFor(pt, new Date(2026, 8, 4, 0, 0))).toBe(0);
    expect(nowFor(pt, new Date(2026, 8, 4, 23, 59))).toBe(1439);
  });

  it("returns null on any other date", () => {
    expect(nowFor(sob, new Date(2026, 8, 4, 10, 30))).toBeNull();
    expect(nowFor(pt, new Date(2026, 8, 5, 10, 30))).toBeNull();
  });
});

describe("liveState", () => {
  const talk = makeSession({ id: "t:pt", start: 600, end: 660 });
  const point = makeSession({ id: "p:pt", start: 600, end: null });
  const noTime = makeSession({ id: "n:pt", start: null, end: null, timeText: "" });

  it("exports SOON_MINUTES = 15", () => {
    expect(SOON_MINUTES).toBe(15);
  });

  it("is upcoming when the session has no start or now is null", () => {
    expect(liveState(noTime, 630)).toBe("upcoming");
    expect(liveState(talk, null)).toBe("upcoming");
  });

  it("is live from the start minute up to but excluding the end minute", () => {
    expect(liveState(talk, 600)).toBe("live");
    expect(liveState(talk, 630)).toBe("live");
    expect(liveState(talk, 659)).toBe("live");
  });

  it("is past from the end minute onwards", () => {
    expect(liveState(talk, 660)).toBe("past");
    expect(liveState(talk, 900)).toBe("past");
  });

  it("is soon within 15 minutes before the start, inclusive", () => {
    expect(liveState(talk, 585)).toBe("soon");
    expect(liveState(talk, 599)).toBe("soon");
  });

  it("is upcoming more than 15 minutes before the start", () => {
    expect(liveState(talk, 584)).toBe("upcoming");
    expect(liveState(talk, 0)).toBe("upcoming");
  });

  it("treats a point session as 20 minutes long", () => {
    expect(liveState(point, 600)).toBe("live");
    expect(liveState(point, 619)).toBe("live");
    expect(liveState(point, 620)).toBe("past");
    expect(liveState(point, 585)).toBe("soon");
  });
});

describe("isToday and isTomorrow", () => {
  it("compares the day's date with the local date of now", () => {
    expect(isToday(pt, new Date(2026, 8, 4, 10, 30))).toBe(true);
    expect(isToday(pt, new Date(2026, 8, 4, 0, 0))).toBe(true);
    expect(isToday(pt, new Date(2026, 8, 5, 0, 0))).toBe(false);
  });

  it("isTomorrow is true only for the calendar day after now", () => {
    expect(isTomorrow(sob, new Date(2026, 8, 4, 10, 30))).toBe(true);
    expect(isTomorrow(sob, new Date(2026, 8, 4, 23, 59))).toBe(true);
    expect(isTomorrow(sob, new Date(2026, 8, 5, 0, 0))).toBe(false);
    expect(isTomorrow(pt, new Date(2026, 8, 4, 10, 30))).toBe(false);
  });

  it("isTomorrow crosses a month boundary", () => {
    const october = makeDay({ id: "czw", date: "2026-10-01", label: "Czwartek", short: "Czw", labelLong: "Czwartek, 1 października" });
    expect(isTomorrow(october, new Date(2026, 8, 30, 22, 0))).toBe(true);
  });
});

describe("defaultDay", () => {
  it("before the festival picks the first busy day", () => {
    expect(defaultDay(days, new Date(2026, 8, 1, 12, 0), counts)).toBe(pt);
  });

  it("on the one-session Thursday still picks Friday", () => {
    expect(defaultDay(days, new Date(2026, 8, 3, 12, 0), counts)).toBe(pt);
  });

  it("during the festival picks today", () => {
    expect(defaultDay(days, new Date(2026, 8, 4, 10, 30), counts)).toBe(pt);
    expect(defaultDay(days, new Date(2026, 8, 5, 10, 30), counts)).toBe(sob);
  });

  it("after the festival falls back to the first busy day", () => {
    expect(defaultDay(days, new Date(2026, 8, 7, 9, 0), counts)).toBe(pt);
  });

  it("falls back to the first day when no day has more than 5 sessions", () => {
    const sparse = new Map<string, number>([
      ["czw", 1],
      ["pt", 5],
      ["sob", 2],
    ]);
    expect(defaultDay(days, new Date(2026, 8, 4, 10, 30), sparse)).toBe(czw);
    expect(defaultDay(days, new Date(2026, 8, 4, 10, 30), new Map())).toBe(czw);
  });

  it("throws on an empty day list", () => {
    expect(() => defaultDay([], new Date(2026, 8, 4, 10, 30), counts)).toThrow();
  });
});

describe("minutesUntil", () => {
  it("is the signed difference start - now", () => {
    expect(minutesUntil(655, 630)).toBe(25);
    expect(minutesUntil(630, 630)).toBe(0);
    expect(minutesUntil(600, 630)).toBe(-30);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/now.test.ts`

Expected: `Error: Failed to resolve import "./now" from "src/domain/now.test.ts". Does the file exist?`

- [ ] **Step 3: Write the implementation**

Create `src/domain/now.ts`:

```ts
import type { Day, Session } from "../data/types";
import { hasStart } from "../data/types";
import { visualEnd } from "./time";

export const SOON_MINUTES = 15;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function localDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Spec §5.6: `?now=v` when it parses to a finite time (date-only values become local midnight), else the real clock. */
export function resolveNow(search: string, realNow: () => Date = () => new Date()): Date {
  const raw = new URLSearchParams(search).get("now");
  if (raw === null || raw === "") return realNow();
  const value = DATE_ONLY.test(raw) ? `${raw}T00:00` : raw;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : realNow();
}

export interface Clock {
  now(): Date;
}

export function createClock(search: string, realNow: () => number = () => Date.now()): Clock {
  const bootedAt = realNow();
  const base = resolveNow(search, () => new Date(bootedAt)).getTime();
  return {
    now: () => new Date(base + (realNow() - bootedAt)),
  };
}

export function nowFor(day: Day, now: Date): number | null {
  if (localDateString(now) !== day.date) return null;
  return now.getHours() * 60 + now.getMinutes();
}

export type LiveState = "past" | "live" | "soon" | "upcoming";

export function liveState(s: Session, nowMinutes: number | null): LiveState {
  if (!hasStart(s) || nowMinutes === null) return "upcoming";
  const end = visualEnd(s);
  if (end <= nowMinutes) return "past";
  if (s.start <= nowMinutes) return "live";
  const until = s.start - nowMinutes;
  if (until > 0 && until <= SOON_MINUTES) return "soon";
  return "upcoming";
}

export function isToday(day: Day, now: Date): boolean {
  return day.date === localDateString(now);
}

export function isTomorrow(day: Day, now: Date): boolean {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return day.date === localDateString(tomorrow);
}

const BUSY_THRESHOLD = 5;

export function defaultDay(days: Day[], now: Date, sessionsPerDay: Map<string, number>): Day {
  const first = days[0];
  if (first === undefined) throw new Error("defaultDay: the day list is empty");
  const today = localDateString(now);
  const busy = days.filter((d) => (sessionsPerDay.get(d.id) ?? 0) > BUSY_THRESHOLD);
  return busy.find((d) => d.date >= today) ?? busy[0] ?? first;
}

export function minutesUntil(start: number, nowMinutes: number): number {
  return start - nowMinutes;
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `npx vitest run src/domain/now.test.ts`

Expected: all tests pass in any timezone (every expectation is built from local-time constructors or `Date.UTC`).

Run: `npm run typecheck`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/domain/now.ts src/domain/now.test.ts
git commit -m "feat(domain): add clock override, live state and default day" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```

---

### Task 13: Colour hues (`src/domain/colors.ts`)

**Files:**
- Create: `src/domain/colors.ts`
- Test: `src/domain/colors.test.ts`

**Interfaces:**
- Consumes: `Session`, `Term` from `src/data/types.ts`; `DataIndex`, `buildIndex(data)`, `primaryType(s, index): Term | null` from `src/domain/lookup.ts`; `makeSession`, `makeData` from `src/test/fixtures/build.ts`.
- Produces (used by `SessionCard`, `ScheduleList` rows, `Avatar` initials fallback, `ContinuationStub`):
  - `type ColorBy = "type" | "location" | "brand"`
  - `interface Hue { hue: number; chroma: number }` (`chroma` 0 means neutral; chromatic hues carry `chroma` 0.16, the §8 value the CSS uses as the OKLCH chroma)
  - `const TYPE_HUES: Record<string, number>` keyed by type name: Prelekcja 45, Prelekcja z sesją 25, Warsztaty 340, Fotospacer 95, Fotogra 95, PLAYGROUND 175, DZIAŁANIA W STREFIE SPRZĘTU 240, STREFA TELEOBIEKTYWÓW 260. Ogólne is not in the map: it is neutral. Any other type name falls back to hue 300.
  - `hashHue(id: number): number` — one of the 12 evenly spaced hues 0, 30, …, 330, from a 32-bit integer mix of the id.
  - `hueFor(s: Session, colorBy: ColorBy, index: DataIndex): Hue` — `type`: the primary type by the §7.2 priority order; `location`: `hashHue(locationIds[0])`; `brand`: `hashHue(brandIds[0])`; neutral `{ hue: 0, chroma: 0 }` when there is no primary type, the type is Ogólne, or the session has no location / no brand.

- [ ] **Step 1: Write the failing test**

Create `src/domain/colors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Term } from "../data/types";
import { makeData, makeSession } from "../test/fixtures/build";
import { buildIndex } from "./lookup";
import { TYPE_HUES, hashHue, hueFor } from "./colors";

const term = (id: number, slug: string, name: string, count = 1): Term => ({ id, slug, name, count });

const data = makeData([], {
  types: [
    term(184, "prelekcja", "Prelekcja", 51),
    term(278, "prelekcja-z-sesja", "Prelekcja z sesją", 5),
    term(5, "warsztaty", "Warsztaty", 12),
    term(3, "fotospacer", "Fotospacer", 5),
    term(185, "fotogra", "Fotogra", 5),
    term(314, "playground", "PLAYGROUND", 8),
    term(214, "dzialania-w-strefie-sprzetu", "DZIAŁANIA W STREFIE SPRZĘTU", 59),
    term(215, "strefa-teleobiektywow", "STREFA TELEOBIEKTYWÓW", 1),
    term(242, "ogolne", "Ogólne", 13),
    term(143, "inne", "Inne", 0),
  ],
});
const index = buildIndex(data);

const NEUTRAL = { hue: 0, chroma: 0 };
const CHROMA = 0.16;

describe("TYPE_HUES", () => {
  it("holds the spec §8 hues by type name", () => {
    expect(TYPE_HUES).toEqual({
      Prelekcja: 45,
      "Prelekcja z sesją": 25,
      Warsztaty: 340,
      Fotospacer: 95,
      Fotogra: 95,
      PLAYGROUND: 175,
      "DZIAŁANIA W STREFIE SPRZĘTU": 240,
      "STREFA TELEOBIEKTYWÓW": 260,
    });
  });

  it("does not list Ogólne, which is neutral", () => {
    expect("Ogólne" in TYPE_HUES).toBe(false);
  });
});

describe("hashHue", () => {
  it("returns one of the 12 evenly spaced hues", () => {
    for (let id = 1; id <= 500; id += 1) {
      const hue = hashHue(id);
      expect(hue % 30).toBe(0);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThanOrEqual(330);
    }
  });

  it("is deterministic and reaches every hue", () => {
    expect(hashHue(233)).toBe(hashHue(233));
    const seen = new Set<number>();
    for (let id = 1; id <= 200; id += 1) seen.add(hashHue(id));
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]);
  });

  it("maps the real location and brand ids to fixed hues", () => {
    expect(hashHue(233)).toBe(60);
    expect(hashHue(281)).toBe(180);
    expect(hashHue(282)).toBe(90);
    expect(hashHue(279)).toBe(270);
    expect(hashHue(280)).toBe(60);
    expect(hashHue(308)).toBe(0);
    expect(hashHue(318)).toBe(30);
    expect(hashHue(10)).toBe(120);
  });
});

describe("hueFor by type", () => {
  it("uses the type hue of the primary type with chroma 0.16", () => {
    expect(hueFor(makeSession({ typeIds: [184] }), "type", index)).toEqual({ hue: 45, chroma: CHROMA });
    expect(hueFor(makeSession({ typeIds: [278] }), "type", index)).toEqual({ hue: 25, chroma: CHROMA });
    expect(hueFor(makeSession({ typeIds: [5] }), "type", index)).toEqual({ hue: 340, chroma: CHROMA });
    expect(hueFor(makeSession({ typeIds: [3] }), "type", index)).toEqual({ hue: 95, chroma: CHROMA });
    expect(hueFor(makeSession({ typeIds: [185] }), "type", index)).toEqual({ hue: 95, chroma: CHROMA });
    expect(hueFor(makeSession({ typeIds: [314] }), "type", index)).toEqual({ hue: 175, chroma: CHROMA });
    expect(hueFor(makeSession({ typeIds: [214] }), "type", index)).toEqual({ hue: 240, chroma: CHROMA });
    expect(hueFor(makeSession({ typeIds: [215] }), "type", index)).toEqual({ hue: 260, chroma: CHROMA });
  });

  it("picks the primary type by the §7.2 priority order, not by position", () => {
    expect(hueFor(makeSession({ typeIds: [5, 184] }), "type", index)).toEqual({ hue: 45, chroma: CHROMA });
    expect(hueFor(makeSession({ typeIds: [242, 215] }), "type", index)).toEqual({ hue: 260, chroma: CHROMA });
  });

  it("is neutral for Ogólne", () => {
    expect(hueFor(makeSession({ typeIds: [242] }), "type", index)).toEqual(NEUTRAL);
  });

  it("falls back to hue 300 for a type outside the map", () => {
    expect(hueFor(makeSession({ typeIds: [143] }), "type", index)).toEqual({ hue: 300, chroma: CHROMA });
  });

  it("is neutral for a session without types", () => {
    expect(hueFor(makeSession({ typeIds: [] }), "type", index)).toEqual(NEUTRAL);
  });
});

describe("hueFor by location and brand", () => {
  it("hashes the first location id", () => {
    expect(hueFor(makeSession({ locationIds: [233] }), "location", index)).toEqual({ hue: 60, chroma: CHROMA });
    expect(hueFor(makeSession({ locationIds: [281, 233] }), "location", index)).toEqual({ hue: 180, chroma: CHROMA });
  });

  it("hashes the first brand id", () => {
    expect(hueFor(makeSession({ brandIds: [10] }), "brand", index)).toEqual({ hue: 120, chroma: CHROMA });
    expect(hueFor(makeSession({ brandIds: [10, 11] }), "brand", index)).toEqual({ hue: 120, chroma: CHROMA });
  });

  it("is neutral without a location or a brand", () => {
    expect(hueFor(makeSession({ locationIds: [] }), "location", index)).toEqual(NEUTRAL);
    expect(hueFor(makeSession({ brandIds: [] }), "brand", index)).toEqual(NEUTRAL);
  });

  it("ignores the type when colouring by location or brand", () => {
    const s = makeSession({ typeIds: [242], locationIds: [233], brandIds: [10] });
    expect(hueFor(s, "location", index).chroma).toBe(CHROMA);
    expect(hueFor(s, "brand", index).chroma).toBe(CHROMA);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/colors.test.ts`

Expected: `Error: Failed to resolve import "./colors" from "src/domain/colors.test.ts". Does the file exist?`

- [ ] **Step 3: Write the implementation**

Create `src/domain/colors.ts`:

```ts
import type { Session } from "../data/types";
import type { DataIndex } from "./lookup";
import { primaryType } from "./lookup";

export type ColorBy = "type" | "location" | "brand";

export interface Hue {
  hue: number;
  /** 0 means neutral (grey); chromatic hues use the spec §8 chroma. */
  chroma: number;
}

/** Spec §8 type hues by type name. Ogólne is neutral and deliberately absent. */
export const TYPE_HUES: Record<string, number> = {
  Prelekcja: 45,
  "Prelekcja z sesją": 25,
  Warsztaty: 340,
  Fotospacer: 95,
  Fotogra: 95,
  PLAYGROUND: 175,
  "DZIAŁANIA W STREFIE SPRZĘTU": 240,
  "STREFA TELEOBIEKTYWÓW": 260,
};

const FALLBACK_TYPE_HUE = 300;
const NEUTRAL_TYPE_NAME = "Ogólne";
const CHROMA = 0.16;
const HUE_COUNT = 12;
const NEUTRAL: Hue = { hue: 0, chroma: 0 };

/** 32-bit integer mix (xorshift-multiply) folded into 12 evenly spaced hues. */
export function hashHue(id: number): number {
  let h = id >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return ((h >>> 0) % HUE_COUNT) * (360 / HUE_COUNT);
}

function chromatic(hue: number): Hue {
  return { hue, chroma: CHROMA };
}

function hashedOrNeutral(id: number | undefined): Hue {
  return id === undefined ? NEUTRAL : chromatic(hashHue(id));
}

export function hueFor(s: Session, colorBy: ColorBy, index: DataIndex): Hue {
  if (colorBy === "location") return hashedOrNeutral(s.locationIds[0]);
  if (colorBy === "brand") return hashedOrNeutral(s.brandIds[0]);
  const type = primaryType(s, index);
  if (type === null || type.name === NEUTRAL_TYPE_NAME) return NEUTRAL;
  return chromatic(TYPE_HUES[type.name] ?? FALLBACK_TYPE_HUE);
}
```

- [ ] **Step 4: Run the tests, the type check and the whole suite**

Run: `npx vitest run src/domain/colors.test.ts`

Expected: all tests pass.

Run: `npm run typecheck`

Expected: no errors.

Run: `npm test`

Expected: every test file passes; the domain core (Tasks 9–13) is complete and green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/colors.ts src/domain/colors.test.ts
git commit -m "feat(domain): add type, location and brand colour hues" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```


### Task 14: Plan selectors and summary (`src/domain/plan.ts`)

**Files:**
- Create: `src/domain/plan.ts`
- Test: `src/domain/plan.test.ts`

**Interfaces:**
- Consumes:
  - `Session`, `Day` from `src/data/types.ts`
  - `planConflicts(planSessions: Session[]): ConflictPair[]` and `ConflictPair { a: Session; b: Session }` from `src/domain/overlaps.ts` (pairs sorted by `a.day` then `a.start`; both members always share a day)
  - `localDateString(d: Date): string` and `nowFor(day: Day, now: Date): number | null` from `src/domain/now.ts`
  - `makeSession(overrides?)`, `makeDay(overrides?)` from `src/test/fixtures/build.ts`
- Produces (used by `PlanView`, `PlanSummary`, `ConflictsPanel`, `PlanActions`, `PrintPlan`, `store.ts`):
  - `planSessions(planSet: ReadonlySet<string>, sessions: Session[]): Session[]` — plan members in `sessions` (data) order, ids not in the data ignored
  - `planForDay(planSessions: Session[], dayId: string): Session[]`
  - `interface PlanSummary { perDay: { day: Day; count: number }[]; conflicts: { day: Day; pairs: ConflictPair[] }[]; conflictCount: number }` — `perDay` has one entry per element of `days` (zero counts included, in `days` order); `conflicts` lists only days with at least one pair, in `days` order
  - `planSummary(planSessions: Session[], days: Day[]): PlanSummary`
  - `nextUp(planSessions: Session[], days: Day[], now: Date): Session | null` — earliest plan session with `start >= nowFor(day, now)` on the day whose `date` is today's local date, else `null`

Steps:

- [ ] **Step 1: Write the failing test**

Create `src/domain/plan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Day, Session } from "../data/types";
import { makeDay, makeSession } from "../test/fixtures/build";
import { nextUp, planForDay, planSessions, planSummary } from "./plan";

const DAYS: Day[] = [
  makeDay({ id: "czw", termId: 276, date: "2026-09-03", label: "Czwartek", short: "Czw", labelLong: "Czwartek, 3 września" }),
  makeDay({ id: "pt", termId: 53, date: "2026-09-04", label: "Piątek", short: "Pt", labelLong: "Piątek, 4 września" }),
  makeDay({ id: "sob", termId: 18, date: "2026-09-05", label: "Sobota", short: "Sob", labelLong: "Sobota, 5 września" }),
];

// Friday: A and B overlap (09:30–10:30 vs 10:00–11:00); C touches B's end (11:00–12:00) so B/C do not overlap.
const A = makeSession({ id: "10:pt", eventId: 10, day: "pt", title: "A", start: 570, end: 630 });
const B = makeSession({ id: "11:pt", eventId: 11, day: "pt", title: "B", start: 600, end: 660 });
const C = makeSession({ id: "12:pt", eventId: 12, day: "pt", title: "C", start: 660, end: 720 });
// Saturday: D and E collide; Z is an all-day zone (never a conflict); N has no start.
const D = makeSession({ id: "13:sob", eventId: 13, day: "sob", title: "D", start: 570, end: 630 });
const E = makeSession({ id: "14:sob", eventId: 14, day: "sob", title: "E", start: 570, end: 630 });
const Z = makeSession({ id: "15:sob", eventId: 15, day: "sob", title: "Rejestracja", start: 540, end: 1080, allDay: true, typeIds: [242], locationIds: [318] });
const N = makeSession({ id: "16:sob", eventId: 16, day: "sob", title: "N", start: null, end: null, timeText: "" });
const ALL: Session[] = [A, B, C, D, E, Z, N];

const idsOf = (sessions: Session[]): string[] => sessions.map((s) => s.id);
const pairIds = (pairs: { a: Session; b: Session }[]): string[][] => pairs.map((p) => [p.a.id, p.b.id].sort());

describe("planSessions", () => {
  it("returns plan members in data order regardless of set insertion order", () => {
    const plan = planSessions(new Set(["14:sob", "10:pt", "12:pt"]), ALL);
    expect(idsOf(plan)).toEqual(["10:pt", "12:pt", "14:sob"]);
  });

  it("ignores ids that are not in the data", () => {
    const plan = planSessions(new Set(["999:pt", "10:pt"]), ALL);
    expect(idsOf(plan)).toEqual(["10:pt"]);
  });

  it("returns an empty list for an empty plan set", () => {
    expect(planSessions(new Set(), ALL)).toEqual([]);
  });
});

describe("planForDay", () => {
  it("keeps only the sessions of the given day", () => {
    expect(idsOf(planForDay(ALL, "sob"))).toEqual(["13:sob", "14:sob", "15:sob", "16:sob"]);
    expect(planForDay(ALL, "czw")).toEqual([]);
  });
});

describe("planSummary", () => {
  it("counts plan sessions per day in days order, including days with none", () => {
    const summary = planSummary(ALL, DAYS);
    expect(summary.perDay.map((p) => [p.day.id, p.count])).toEqual([
      ["czw", 0],
      ["pt", 3],
      ["sob", 4],
    ]);
  });

  it("groups conflict pairs by day and counts them", () => {
    const summary = planSummary(ALL, DAYS);
    expect(summary.conflicts.map((c) => c.day.id)).toEqual(["pt", "sob"]);
    expect(pairIds(summary.conflicts[0]!.pairs)).toEqual([["10:pt", "11:pt"]]);
    expect(pairIds(summary.conflicts[1]!.pairs)).toEqual([["13:sob", "14:sob"]]);
    expect(summary.conflictCount).toBe(2);
  });

  it("never lists all-day zones, touching ends or no-start sessions as conflicts", () => {
    const summary = planSummary([B, C, Z, N, D], DAYS);
    expect(summary.conflicts).toEqual([]);
    expect(summary.conflictCount).toBe(0);
  });

  it("returns zero counts and no conflicts for an empty plan", () => {
    const summary = planSummary([], DAYS);
    expect(summary.perDay.map((p) => p.count)).toEqual([0, 0, 0]);
    expect(summary.conflicts).toEqual([]);
    expect(summary.conflictCount).toBe(0);
  });
});

describe("nextUp", () => {
  it("returns the earliest plan session starting at or after now on a festival day", () => {
    expect(nextUp([C, B, A], DAYS, new Date(2026, 8, 4, 9, 0))?.id).toBe("10:pt");
  });

  it("treats a session starting exactly now as next", () => {
    expect(nextUp([A, B, C], DAYS, new Date(2026, 8, 4, 10, 0))?.id).toBe("11:pt");
  });

  it("returns null when every plan session of today has started", () => {
    expect(nextUp([A, B, C], DAYS, new Date(2026, 8, 4, 13, 0))).toBeNull();
  });

  it("never picks a session from another day", () => {
    expect(nextUp([D, E], DAYS, new Date(2026, 8, 4, 8, 0))).toBeNull();
  });

  it("returns null off the festival days", () => {
    expect(nextUp(ALL, DAYS, new Date(2026, 8, 6, 10, 0))).toBeNull();
    expect(nextUp(ALL, DAYS, new Date(2026, 8, 2, 10, 0))).toBeNull();
  });

  it("ignores sessions without a start", () => {
    expect(nextUp([N, D], DAYS, new Date(2026, 8, 5, 9, 0))?.id).toBe("13:sob");
    expect(nextUp([N], DAYS, new Date(2026, 8, 5, 9, 0))).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/plan.test.ts`

Expected: the file fails to load with `Error: Failed to load url ./plan` (Vite cannot resolve the missing module); no test in the file runs.

- [ ] **Step 3: Write the implementation**

Create `src/domain/plan.ts`:

```ts
import type { Day, Session } from "../data/types";
import { localDateString, nowFor } from "./now";
import { planConflicts, type ConflictPair } from "./overlaps";

/** Plan members in data order; ids missing from the data are ignored. */
export function planSessions(planSet: ReadonlySet<string>, sessions: Session[]): Session[] {
  return sessions.filter((s) => planSet.has(s.id));
}

export function planForDay(plan: Session[], dayId: string): Session[] {
  return plan.filter((s) => s.day === dayId);
}

export interface PlanSummary {
  perDay: { day: Day; count: number }[];
  conflicts: { day: Day; pairs: ConflictPair[] }[];
  conflictCount: number;
}

export function planSummary(plan: Session[], days: Day[]): PlanSummary {
  const perDay = days.map((day) => ({ day, count: planForDay(plan, day.id).length }));
  const pairs = planConflicts(plan);
  const conflicts: PlanSummary["conflicts"] = [];
  for (const day of days) {
    const dayPairs = pairs.filter((p) => p.a.day === day.id);
    if (dayPairs.length > 0) conflicts.push({ day, pairs: dayPairs });
  }
  return { perDay, conflicts, conflictCount: pairs.length };
}

/** Earliest plan session with start >= now on the day whose date is today's local date, else null. */
export function nextUp(plan: Session[], days: Day[], now: Date): Session | null {
  const today = localDateString(now);
  const day = days.find((d) => d.date === today);
  if (day === undefined) return null;
  const nowMinutes = nowFor(day, now);
  if (nowMinutes === null) return null;
  let best: Session | null = null;
  let bestStart = Number.POSITIVE_INFINITY;
  for (const s of plan) {
    if (s.day !== day.id || s.start === null || s.start < nowMinutes) continue;
    if (s.start < bestStart) {
      best = s;
      bestStart = s.start;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `npx vitest run src/domain/plan.test.ts`

Expected: 14 tests pass.

Run: `npm run typecheck`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/domain/plan.ts src/domain/plan.test.ts && git commit -m "feat(domain): add plan selectors and summary

planSessions, planForDay, planSummary and nextUp per spec §5.5,
with per-day counts, conflict pairs grouped by day and the
next-up lookup against the local date.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```

---

### Task 15: Share-link encoding (`src/domain/share.ts`)

**Files:**
- Create: `src/domain/share.ts`
- Test: `src/domain/share.test.ts`

**Interfaces:**
- Consumes: nothing from other modules (pure string code; `URL` is the platform global).
- Produces (used by `boot.ts`, `ShareBanner`, `PlanActions`):
  - `SHARE_VERSION = "1~"`
  - `DAY_CODES: Record<string, string>` — `czw→c, pt→p, sob→s, nd→n, pon→m, wt→t, sr→r`
  - `encodePlan(ids: string[]): string` — `"1~" + tokens.join(".")`, token = base-36 event id + day code; ids that do not parse as `<integer>:<known day>` are skipped
  - `decodePlan(str: string, sessionIds: ReadonlySet<string>): { ids: string[]; unknown: number }` — duplicates collapsed, `unknown` counts malformed tokens and ids absent from `sessionIds`; a bad version prefix gives `{ ids: [], unknown: 0 }`
  - `buildShareUrl(href: string, dayId: string, ids: string[]): string` — `new URL(href)` with `search` cleared and hash `#d=<dayId>&v=plan&plan=<encodePlan(ids)>`

Steps:

- [ ] **Step 1: Write the failing test**

Create `src/domain/share.test.ts`. The real event ids used below encode as `39619 → ukj`, `39587 → ujn`, `39556 → uis`, `41151 → vr3`, `39549 → uil`, `46655 → zzz`.

```ts
import { describe, expect, it } from "vitest";
import { DAY_CODES, SHARE_VERSION, buildShareUrl, decodePlan, encodePlan } from "./share";

const KNOWN: ReadonlySet<string> = new Set(["39619:sob", "39587:sob", "39556:pt", "41151:pt", "39549:czw"]);

describe("DAY_CODES", () => {
  it("maps every day id the normalizer can emit to a distinct letter", () => {
    expect(DAY_CODES).toEqual({ czw: "c", pt: "p", sob: "s", nd: "n", pon: "m", wt: "t", sr: "r" });
    expect(new Set(Object.values(DAY_CODES)).size).toBe(7);
  });
});

describe("encodePlan", () => {
  it("writes the version prefix, base-36 event ids and day codes joined by dots", () => {
    expect(SHARE_VERSION).toBe("1~");
    expect(encodePlan(["39619:sob", "39587:sob", "39556:pt", "41151:pt", "39549:czw"])).toBe("1~ukjs.ujns.uisp.vr3p.uilc");
  });

  it("encodes an empty plan as the bare prefix", () => {
    expect(encodePlan([])).toBe("1~");
  });

  it("skips ids with an unknown day or a non-numeric event id", () => {
    expect(encodePlan(["1:pt", "2:xyz", "abc:pt", "3:sob", "nocolon"])).toBe("1~1p.3s");
  });
});

describe("decodePlan", () => {
  it("round-trips a plan", () => {
    const ids = ["39619:sob", "39587:sob", "39556:pt", "41151:pt", "39549:czw"];
    expect(decodePlan(encodePlan(ids), KNOWN)).toEqual({ ids, unknown: 0 });
  });

  it("counts ids that are not in the data as unknown", () => {
    expect(decodePlan("1~ukjs.zzzp.ujns", KNOWN)).toEqual({ ids: ["39619:sob", "39587:sob"], unknown: 1 });
  });

  it("counts tokens with an unmapped day code as unknown", () => {
    expect(decodePlan("1~ukjx", KNOWN)).toEqual({ ids: [], unknown: 1 });
    expect(decodePlan("1~ukjz", KNOWN)).toEqual({ ids: [], unknown: 1 });
  });

  it("counts tokens that do not match the token grammar as unknown", () => {
    expect(decodePlan("1~ukjS", KNOWN)).toEqual({ ids: [], unknown: 1 });
    expect(decodePlan("1~ukj-s", KNOWN)).toEqual({ ids: [], unknown: 1 });
    expect(decodePlan("1~s", KNOWN)).toEqual({ ids: [], unknown: 1 });
  });

  it("ignores empty tokens so the bare prefix and stray dots give no unknowns", () => {
    expect(decodePlan("1~", KNOWN)).toEqual({ ids: [], unknown: 0 });
    expect(decodePlan("1~ukjs..ujns.", KNOWN)).toEqual({ ids: ["39619:sob", "39587:sob"], unknown: 0 });
  });

  it("collapses duplicate tokens", () => {
    expect(decodePlan("1~ukjs.ukjs", KNOWN)).toEqual({ ids: ["39619:sob"], unknown: 0 });
  });

  it("returns an empty result for an unknown version prefix", () => {
    expect(decodePlan("2~ukjs", KNOWN)).toEqual({ ids: [], unknown: 0 });
    expect(decodePlan("ukjs", KNOWN)).toEqual({ ids: [], unknown: 0 });
    expect(decodePlan("", KNOWN)).toEqual({ ids: [], unknown: 0 });
  });
});

describe("buildShareUrl", () => {
  it("drops the query, replaces the hash and keeps the file path", () => {
    expect(buildShareUrl("file:///Users/tom/dist/index.html?now=2026-09-04T10:30#d=sob&v=grid", "pt", ["1:pt", "2:sob"])).toBe(
      "file:///Users/tom/dist/index.html#d=pt&v=plan&plan=1~1p.2s",
    );
  });

  it("works for http origins and an empty plan", () => {
    expect(buildShareUrl("https://example.com/plan/?x=1#d=pt", "sob", [])).toBe("https://example.com/plan/#d=sob&v=plan&plan=1~");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/share.test.ts`

Expected: `Error: Failed to load url ./share`; no test runs.

- [ ] **Step 3: Write the implementation**

Create `src/domain/share.ts`:

```ts
export const SHARE_VERSION = "1~";

/** Day id -> single-letter share code. Unique across every id the normalizer can emit. */
export const DAY_CODES: Record<string, string> = {
  czw: "c",
  pt: "p",
  sob: "s",
  nd: "n",
  pon: "m",
  wt: "t",
  sr: "r",
};

const CODE_DAYS: Record<string, string> = Object.fromEntries(
  Object.entries(DAY_CODES).map(([dayId, code]) => [code, dayId]),
);

const TOKEN = /^([0-9a-z]+)([cpsnmtr])$/;

export function encodePlan(ids: string[]): string {
  const tokens: string[] = [];
  for (const id of ids) {
    const sep = id.indexOf(":");
    if (sep < 0) continue;
    const eventId = Number(id.slice(0, sep));
    const code: string | undefined = DAY_CODES[id.slice(sep + 1)];
    if (!Number.isInteger(eventId) || eventId < 0 || code === undefined) continue;
    tokens.push(eventId.toString(36) + code);
  }
  return SHARE_VERSION + tokens.join(".");
}

export function decodePlan(str: string, sessionIds: ReadonlySet<string>): { ids: string[]; unknown: number } {
  if (!str.startsWith(SHARE_VERSION)) return { ids: [], unknown: 0 };
  const ids: string[] = [];
  const seen = new Set<string>();
  let unknown = 0;
  for (const token of str.slice(SHARE_VERSION.length).split(".")) {
    if (token === "") continue;
    const match = TOKEN.exec(token);
    if (match === null) {
      unknown += 1;
      continue;
    }
    const [, eventPart = "", code = ""] = match;
    const dayId: string | undefined = CODE_DAYS[code];
    if (dayId === undefined) {
      unknown += 1;
      continue;
    }
    const id = `${parseInt(eventPart, 36)}:${dayId}`;
    if (!sessionIds.has(id)) {
      unknown += 1;
      continue;
    }
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return { ids, unknown };
}

export function buildShareUrl(href: string, dayId: string, ids: string[]): string {
  const u = new URL(href);
  u.search = "";
  u.hash = `#d=${dayId}&v=plan&plan=${encodePlan(ids)}`;
  return u.href;
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `npx vitest run src/domain/share.test.ts`

Expected: 13 tests pass.

Run: `npm run typecheck`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/domain/share.ts src/domain/share.test.ts && git commit -m "feat(domain): add plan share encoding

encodePlan/decodePlan with the 1~ version prefix, base-36 event ids
and single-letter day codes, plus buildShareUrl per spec §5.5 and §7.5.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```

---

### Task 16: Plan as text (`src/domain/text.ts`)

**Files:**
- Create: `src/domain/text.ts`
- Test: `src/domain/text.test.ts`

**Interfaces:**
- Consumes:
  - `Session`, `Day`, `ScheduleData`, `hasStart` from `src/data/types.ts`
  - `DataIndex`, `buildIndex`, `speakersOf(s, index): Speaker[]`, `locationLabel(s, index): string` (shorts joined by `" / "`, `""` when none) from `src/domain/lookup.ts`
  - `formatRange(start, end): string` from `src/domain/time.ts` (`"09:05–10:15"` with an en dash, `"09:05"` when `end` is null)
  - `makeSession`, `makeDay`, `makeLocation`, `makeSpeaker`, `makeData` from `src/test/fixtures/build.ts`
- Produces (used by `PlanActions` "Kopiuj jako tekst" and `PrintPlan`):
  - `interface PlanLinesEntry { day: Day | null; lines: string[] }`
  - `sessionLine(s: Session, data: ScheduleData, index: DataIndex): string` — parts joined by `" · "`: time range (omitted when `start` is null), title, location shorts joined by `" / "` (omitted when none), speaker names joined by `", "` or the byline when no speaker resolved (omitted when both absent)
  - `planLines(sessions: Session[], data: ScheduleData, index: DataIndex): PlanLinesEntry[]` — one entry per day in `data.days` order that has timed plan sessions (lines sorted by start, ties by title with Polish collation), then a final `{ day: null, lines }` entry for sessions without a start; entries with no lines are omitted
  - `planAsText(sessions: Session[], data: ScheduleData, index: DataIndex): string` — each entry as a heading (`labelLong`, or `Bez godziny` for the null entry) followed by its lines, entries separated by a blank line; `""` for an empty plan

Steps:

- [ ] **Step 1: Write the failing test**

Create `src/domain/text.test.ts`. Titles, times, locations and speakers are real (events 39587, 39619, 33705, 46722; locations 233, 281, 282; speakers 379 and 46589).

```ts
import { describe, expect, it } from "vitest";
import type { Day, Session } from "../data/types";
import { makeData, makeDay, makeLocation, makeSession, makeSpeaker } from "../test/fixtures/build";
import { buildIndex } from "./lookup";
import { planAsText, planLines, sessionLine } from "./text";

const DAYS: Day[] = [
  makeDay({ id: "czw", termId: 276, date: "2026-09-03", label: "Czwartek", short: "Czw", labelLong: "Czwartek, 3 września" }),
  makeDay({ id: "pt", termId: 53, date: "2026-09-04", label: "Piątek", short: "Pt", labelLong: "Piątek, 4 września" }),
  makeDay({ id: "sob", termId: 18, date: "2026-09-05", label: "Sobota", short: "Sob", labelLong: "Sobota, 5 września" }),
];

const LOCATIONS = [
  makeLocation({ id: 233, name: "So Salsa - poziom II - Sala wykładowa nr 1", venue: "So Salsa", level: "II", room: "Sala wykładowa nr 1", short: "Sala wykł. 1", order: 3 }),
  makeLocation({ id: 281, name: "SoSalsa - poziom II - Sala wykładowa nr 2", venue: "SoSalsa", level: "II", room: "Sala wykładowa nr 2", short: "Sala wykł. 2", order: 4 }),
  makeLocation({ id: 282, name: "Drizzly Grizzly - poziom 0 - Sala wykładowa nr 3", venue: "Drizzly Grizzly", level: "0", room: "Sala wykładowa nr 3", short: "Sala wykł. 3", order: 0 }),
];

const SPEAKERS = [
  makeSpeaker({ id: 379, slug: "piotr-werner-2", name: "Piotr Werner" }),
  makeSpeaker({ id: 46589, slug: "jakub-kazmierczyk", name: "Jakub Kaźmierczyk" }),
];

const lecture = makeSession({
  id: "39587:sob", eventId: 39587, day: "sob",
  title: "Wszystko, co musisz wiedzieć o świetle, ale boisz się zapytać",
  start: 555, end: 630, timeText: "09:15-10:30", typeIds: [278], locationIds: [233], speakerIds: [379],
});
const evening = makeSession({
  id: "39619:sob", eventId: 39619, day: "sob",
  title: "Gdzie AI nie da rady, tam tablet wyśle",
  start: 1110, end: 1170, timeText: "18:30-19:30", locationIds: [282], speakerIds: [46589],
});
const opening = makeSession({
  id: "33705:pt", eventId: 33705, day: "pt", title: "Oficjalne otwarcie festiwalu",
  start: 570, end: null, timeText: "09:30", typeIds: [242], locationIds: [281], speakerIds: [],
});
const bylineOnly = makeSession({
  id: "46722:pt", eventId: 46722, day: "pt", title: "Storytelling in the streets of Gdansk (po angielsku)",
  start: 780, end: 870, timeText: "13:00-14:30", locationIds: [], speakerIds: [], byline: "Sorger Fabian",
});
const beta = makeSession({ id: "2:pt", eventId: 2, day: "pt", title: "Beta", start: 570, end: 630, locationIds: [233, 281], speakerIds: [379, 46589] });
const alfa = makeSession({ id: "3:pt", eventId: 3, day: "pt", title: "Alfa", start: 570, end: 630, locationIds: [], speakerIds: [] });
const noTime = makeSession({ id: "4:sob", eventId: 4, day: "sob", title: "Bez czasu", start: null, end: null, timeText: "", locationIds: [233], speakerIds: [379] });

const ALL: Session[] = [evening, lecture, opening, bylineOnly, beta, alfa, noTime];
const data = makeData(ALL, { days: DAYS, locations: LOCATIONS, speakers: SPEAKERS });
const index = buildIndex(data);

describe("sessionLine", () => {
  it("joins time, title, location short and speaker with middle dots", () => {
    expect(sessionLine(lecture, data, index)).toBe("09:15–10:30 · Wszystko, co musisz wiedzieć o świetle, ale boisz się zapytać · Sala wykł. 1 · Piotr Werner");
  });

  it("joins several speakers with commas and several locations with slashes", () => {
    expect(sessionLine(beta, data, index)).toBe("09:30–10:30 · Beta · Sala wykł. 1 / Sala wykł. 2 · Piotr Werner, Jakub Kaźmierczyk");
  });

  it("shows a single time for point sessions and omits the speaker part when nobody is listed", () => {
    expect(sessionLine(opening, data, index)).toBe("09:30 · Oficjalne otwarcie festiwalu · Sala wykł. 2");
  });

  it("falls back to the byline when no speaker resolved and omits an empty location", () => {
    expect(sessionLine(bylineOnly, data, index)).toBe("13:00–14:30 · Storytelling in the streets of Gdansk (po angielsku) · Sorger Fabian");
  });

  it("omits both trailing parts when the session has neither location nor people", () => {
    expect(sessionLine(alfa, data, index)).toBe("09:30–10:30 · Alfa");
  });

  it("omits the time part for a session without a start", () => {
    expect(sessionLine(noTime, data, index)).toBe("Bez czasu · Sala wykł. 1 · Piotr Werner");
  });
});

describe("planLines", () => {
  it("returns one entry per day with sessions, in days order, plus a final no-start entry", () => {
    const entries = planLines(ALL, data, index);
    expect(entries.map((e) => e.day?.id ?? null)).toEqual(["pt", "sob", null]);
  });

  it("sorts each day's lines chronologically, ties by title", () => {
    const entries = planLines(ALL, data, index);
    expect(entries[0]!.lines).toEqual([
      "09:30–10:30 · Alfa",
      "09:30–10:30 · Beta · Sala wykł. 1 / Sala wykł. 2 · Piotr Werner, Jakub Kaźmierczyk",
      "09:30 · Oficjalne otwarcie festiwalu · Sala wykł. 2",
      "13:00–14:30 · Storytelling in the streets of Gdansk (po angielsku) · Sorger Fabian",
    ]);
    expect(entries[1]!.lines).toEqual([
      "09:15–10:30 · Wszystko, co musisz wiedzieć o świetle, ale boisz się zapytać · Sala wykł. 1 · Piotr Werner",
      "18:30–19:30 · Gdzie AI nie da rady, tam tablet wyśle · Sala wykł. 3 · Jakub Kaźmierczyk",
    ]);
    expect(entries[2]!.lines).toEqual(["Bez czasu · Sala wykł. 1 · Piotr Werner"]);
  });

  it("omits the no-start entry when every session has a start", () => {
    const entries = planLines([lecture, opening], data, index);
    expect(entries.map((e) => e.day?.id ?? null)).toEqual(["pt", "sob"]);
  });

  it("returns no entries for an empty plan", () => {
    expect(planLines([], data, index)).toEqual([]);
  });
});

describe("planAsText", () => {
  it("renders labelLong headings, Bez godziny for the no-start entry, and blank lines between entries", () => {
    expect(planAsText(ALL, data, index)).toBe(
      [
        "Piątek, 4 września",
        "09:30–10:30 · Alfa",
        "09:30–10:30 · Beta · Sala wykł. 1 / Sala wykł. 2 · Piotr Werner, Jakub Kaźmierczyk",
        "09:30 · Oficjalne otwarcie festiwalu · Sala wykł. 2",
        "13:00–14:30 · Storytelling in the streets of Gdansk (po angielsku) · Sorger Fabian",
        "",
        "Sobota, 5 września",
        "09:15–10:30 · Wszystko, co musisz wiedzieć o świetle, ale boisz się zapytać · Sala wykł. 1 · Piotr Werner",
        "18:30–19:30 · Gdzie AI nie da rady, tam tablet wyśle · Sala wykł. 3 · Jakub Kaźmierczyk",
        "",
        "Bez godziny",
        "Bez czasu · Sala wykł. 1 · Piotr Werner",
      ].join("\n"),
    );
  });

  it("renders an empty plan as an empty string", () => {
    expect(planAsText([], data, index)).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/text.test.ts`

Expected: `Error: Failed to load url ./text`; no test runs.

- [ ] **Step 3: Write the implementation**

Create `src/domain/text.ts`:

```ts
import { hasStart, type Day, type ScheduleData, type Session, type TimedSession } from "../data/types";
import { locationLabel, speakersOf, type DataIndex } from "./lookup";
import { formatRange } from "./time";

export interface PlanLinesEntry {
  day: Day | null;
  lines: string[];
}

const SEPARATOR = " · ";
const NO_TIME_HEADING = "Bez godziny";
const collator = new Intl.Collator("pl");

/** `09:30–10:30 · Title · Sala wykł. 1 · Speaker`; the `data` argument is part of the shared signature, the index carries everything the line needs. */
export function sessionLine(s: Session, _data: ScheduleData, index: DataIndex): string {
  const parts: string[] = [];
  if (s.start !== null) parts.push(formatRange(s.start, s.end));
  parts.push(s.title);
  const location = locationLabel(s, index);
  if (location !== "") parts.push(location);
  const speakers = speakersOf(s, index)
    .map((speaker) => speaker.name)
    .join(", ");
  if (speakers !== "") parts.push(speakers);
  else if (s.byline !== null && s.byline !== "") parts.push(s.byline);
  return parts.join(SEPARATOR);
}

function byStartThenTitle(a: TimedSession, b: TimedSession): number {
  return a.start - b.start || collator.compare(a.title, b.title);
}

export function planLines(sessions: Session[], data: ScheduleData, index: DataIndex): PlanLinesEntry[] {
  const entries: PlanLinesEntry[] = [];
  const timed = sessions.filter(hasStart);
  for (const day of data.days) {
    const ofDay = timed.filter((s) => s.day === day.id).sort(byStartThenTitle);
    if (ofDay.length > 0) entries.push({ day, lines: ofDay.map((s) => sessionLine(s, data, index)) });
  }
  const untimed = sessions.filter((s) => s.start === null);
  if (untimed.length > 0) entries.push({ day: null, lines: untimed.map((s) => sessionLine(s, data, index)) });
  return entries;
}

export function planAsText(sessions: Session[], data: ScheduleData, index: DataIndex): string {
  return planLines(sessions, data, index)
    .map((entry) => [entry.day === null ? NO_TIME_HEADING : entry.day.labelLong, ...entry.lines].join("\n"))
    .join("\n\n");
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `npx vitest run src/domain/text.test.ts`

Expected: 12 tests pass.

Run: `npm run typecheck`

Expected: no errors (the `_data` parameter name keeps `noUnusedParameters` quiet while preserving the contract signature).

- [ ] **Step 5: Commit**

```bash
git add src/domain/text.ts src/domain/text.test.ts && git commit -m "feat(domain): add plan text rendering

sessionLine, planLines and planAsText per spec §5.5: middle-dot
separated lines, per-day entries plus a Bez godziny entry, and
labelLong headings for the copy and print features.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```

---

### Task 17: iCalendar export (`src/domain/ics.ts`)

**Files:**
- Create: `src/domain/ics.ts`
- Test: `src/domain/ics.test.ts`

**Interfaces:**
- Consumes:
  - `Session`, `TimedSession`, `ScheduleData`, `hasStart` from `src/data/types.ts`
  - `DataIndex`, `buildIndex`, `locationsOf(s, index): Location[]`, `speakersOf(s, index): Speaker[]` from `src/domain/lookup.ts` (`index.dayById` supplies the day's `date`)
  - `visualEnd(s: TimedSession): number` from `src/domain/time.ts` (`end ?? start + 20`)
  - `makeSession`, `makeDay`, `makeLocation`, `makeSpeaker`, `makeData` from `src/test/fixtures/build.ts`
- Produces (used by `PlanActions` "Pobierz .ics"):
  - `escapeIcsText(s: string): string` — `\` → `\\`, `;` → `\;`, `,` → `\,`, newline (`\r\n`, `\r` or `\n`) → `\n`
  - `foldIcsLine(line: string): string` — physical lines of at most 75 octets of UTF-8, continuation lines start with one space, pieces joined by CRLF; never splits a code point
  - `buildIcs(sessions: Session[], data: ScheduleData, index: DataIndex): string` — complete `VCALENDAR` text with CRLF line endings and a trailing CRLF; one `VEVENT` per session with a start (no-start sessions skipped)

Steps:

- [ ] **Step 1: Write the failing test**

Create `src/domain/ics.test.ts`. Real strings: event 39619 (a title with a comma, Saturday 18:30–19:30, location 282, speaker 46589) and the longest real title, event 39551 (189 UTF-8 octets). No real title contains a semicolon, so semicolons and backslashes are covered with a synthetic title.

```ts
import { describe, expect, it } from "vitest";
import type { Day } from "../data/types";
import { makeData, makeDay, makeLocation, makeSession, makeSpeaker } from "../test/fixtures/build";
import { buildIcs, escapeIcsText, foldIcsLine } from "./ics";
import { buildIndex } from "./lookup";

const octets = (s: string): number => new TextEncoder().encode(s).length;
/** Logical (unfolded) lines of an iCalendar text; the trailing CRLF yields a final "" element that is dropped. */
const logicalLines = (ics: string): string[] => ics.replace(/\r\n[ \t]/g, "").split("\r\n").slice(0, -1);

const DAYS: Day[] = [
  makeDay({ id: "pt", termId: 53, date: "2026-09-04", label: "Piątek", short: "Pt", labelLong: "Piątek, 4 września" }),
  makeDay({ id: "sob", termId: 18, date: "2026-09-05", label: "Sobota", short: "Sob", labelLong: "Sobota, 5 września" }),
];
const LOCATIONS = [
  makeLocation({ id: 233, name: "So Salsa - poziom II - Sala wykładowa nr 1", venue: "So Salsa", level: "II", room: "Sala wykładowa nr 1", short: "Sala wykł. 1", order: 3 }),
  makeLocation({ id: 281, name: "SoSalsa - poziom II - Sala wykładowa nr 2", venue: "SoSalsa", level: "II", room: "Sala wykładowa nr 2", short: "Sala wykł. 2", order: 4 }),
  makeLocation({ id: 282, name: "Drizzly Grizzly - poziom 0 - Sala wykładowa nr 3", venue: "Drizzly Grizzly", level: "0", room: "Sala wykładowa nr 3", short: "Sala wykł. 3", order: 0 }),
];
const SPEAKERS = [
  makeSpeaker({ id: 379, slug: "piotr-werner-2", name: "Piotr Werner" }),
  makeSpeaker({ id: 46589, slug: "jakub-kazmierczyk", name: "Jakub Kaźmierczyk" }),
];
const META = { source: "https://swiatlosila.pl/harmonogram-2026/", fetchedAt: "2026-09-03T12:54:11.000Z", year: 2026, version: 1 as const, eventCount: 3, sessionCount: 3, speakerCount: 2 };

const evening = makeSession({
  id: "39619:sob", eventId: 39619, day: "sob",
  title: "Gdzie AI nie da rady, tam tablet wyśle",
  start: 1110, end: 1170, timeText: "18:30-19:30", locationIds: [282], speakerIds: [46589],
  url: "https://swiatlosila.pl/cyfrowe-event/gdzie-ai-nie-da-rady-tam-tablet-wysle/",
});
const point = makeSession({
  id: "2:pt", eventId: 2, day: "pt", title: "Sesja", start: 570, end: null, timeText: "09:30",
  locationIds: [233, 281], speakerIds: [379, 46589], url: "https://example.test/2",
});
const noStart = makeSession({ id: "3:pt", eventId: 3, day: "pt", title: "Bez czasu", start: null, end: null, timeText: "", url: "https://example.test/3" });
const special = makeSession({
  id: "4:pt", eventId: 4, day: "pt", title: "A;B\\C", start: 600, end: 660, locationIds: [], speakerIds: [],
  byline: "Sorger Fabian", url: "https://example.test/4",
});
const LONG_TITLE = "Dlaczego jedni fotografowie zostają w pamięci, a inni tylko robią zdjęcia? O zaufaniu, doświadczeniu i emocjach, które stają się dziś większą przewagą niż perfekcyjne portfolio";
const long = makeSession({ id: "39551:pt", eventId: 39551, day: "pt", title: LONG_TITLE, start: 585, end: 645, locationIds: [], speakerIds: [], url: "https://example.test/39551" });

const data = makeData([evening, point, noStart, special, long], { meta: META, days: DAYS, locations: LOCATIONS, speakers: SPEAKERS });
const index = buildIndex(data);

describe("escapeIcsText", () => {
  it("escapes backslashes, semicolons, commas and newlines", () => {
    expect(escapeIcsText("A;B\\C, D\nE")).toBe("A\\;B\\\\C\\, D\\nE");
    expect(escapeIcsText("x\r\ny")).toBe("x\\ny");
  });

  it("leaves plain text alone", () => {
    expect(escapeIcsText("Oficjalne otwarcie festiwalu")).toBe("Oficjalne otwarcie festiwalu");
  });
});

describe("foldIcsLine", () => {
  it("leaves lines of 75 octets or fewer untouched", () => {
    expect(foldIcsLine("a".repeat(75))).toBe("a".repeat(75));
    expect(foldIcsLine("")).toBe("");
  });

  it("folds at 75 octets with a CRLF and one leading space", () => {
    expect(foldIcsLine("a".repeat(76))).toBe(`${"a".repeat(75)}\r\n a`);
  });

  it("counts octets, not characters, and never splits a two-byte character", () => {
    // "SUMMARY:" is 8 octets; 33 × "ą" (2 octets each) fills the line to 74; the 34th would exceed 75.
    expect(foldIcsLine(`SUMMARY:${"ą".repeat(40)}`)).toBe(`SUMMARY:${"ą".repeat(33)}\r\n ${"ą".repeat(7)}`);
  });

  it("never splits a four-byte character (surrogate pair)", () => {
    const folded = foldIcsLine(`X:${"🎥".repeat(20)}`);
    expect(folded).toBe(`X:${"🎥".repeat(18)}\r\n ${"🎥".repeat(2)}`);
    for (const line of folded.split("\r\n")) expect(() => encodeURIComponent(line)).not.toThrow();
  });

  it("folds the longest real title so every physical line fits and unfolding restores it", () => {
    const logical = `SUMMARY:${escapeIcsText(LONG_TITLE)}`;
    const folded = foldIcsLine(logical);
    expect(folded).toBe(
      "SUMMARY:Dlaczego jedni fotografowie zostają w pamięci\\, a inni tylko robi\r\n" +
        " ą zdjęcia? O zaufaniu\\, doświadczeniu i emocjach\\, które stają się d\r\n" +
        " ziś większą przewagą niż perfekcyjne portfolio",
    );
    expect(folded.split("\r\n").map(octets)).toEqual([75, 75, 52]);
    expect(folded.replace(/\r\n /g, "")).toBe(logical);
  });
});

describe("buildIcs", () => {
  const ics = buildIcs([evening, point, noStart, special, long], data, index);
  const lines = logicalLines(ics);

  it("emits the calendar header and footer", () => {
    expect(lines.slice(0, 4)).toEqual(["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//swiatlosila-plan//PL", "CALSCALE:GREGORIAN"]);
    expect(lines[lines.length - 1]).toBe("END:VCALENDAR");
  });

  it("uses CRLF line endings, ends with CRLF and keeps every physical line within 75 octets", () => {
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.includes("\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "").includes("\n")).toBe(false);
    for (const line of ics.split("\r\n")) expect(octets(line)).toBeLessThanOrEqual(75);
  });

  it("writes one VEVENT per session with a start and skips sessions without one", () => {
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(4);
    expect(lines.filter((l) => l === "END:VEVENT")).toHaveLength(4);
    expect(lines.some((l) => l.startsWith("UID:3:pt@"))).toBe(false);
  });

  it("renders a real session with a comma in its title", () => {
    const start = lines.indexOf("UID:39619:sob@swiatlosila-plan");
    expect(lines.slice(start - 1, start + 9)).toEqual([
      "BEGIN:VEVENT",
      "UID:39619:sob@swiatlosila-plan",
      "DTSTAMP:20260903T125411Z",
      "DTSTART:20260905T183000",
      "DTEND:20260905T193000",
      "SUMMARY:Gdzie AI nie da rady\\, tam tablet wyśle",
      "LOCATION:Drizzly Grizzly - poziom 0 - Sala wykładowa nr 3",
      "DESCRIPTION:Jakub Kaźmierczyk\\nhttps://swiatlosila.pl/cyfrowe-event/gdzie-ai-nie-da-rady-tam-tablet-wysle/",
      "URL:https://swiatlosila.pl/cyfrowe-event/gdzie-ai-nie-da-rady-tam-tablet-wysle/",
      "END:VEVENT",
    ]);
  });

  it("ends point sessions 20 minutes after their start and joins several locations and speakers with escaped commas", () => {
    const start = lines.indexOf("UID:2:pt@swiatlosila-plan");
    expect(lines.slice(start + 2, start + 7)).toEqual([
      "DTSTART:20260904T093000",
      "DTEND:20260904T095000",
      "SUMMARY:Sesja",
      "LOCATION:So Salsa - poziom II - Sala wykładowa nr 1\\, SoSalsa - poziom II - Sala wykładowa nr 2",
      "DESCRIPTION:Piotr Werner\\, Jakub Kaźmierczyk\\nhttps://example.test/2",
    ]);
  });

  it("escapes semicolons and backslashes in the summary, puts the byline in the description and omits an empty LOCATION", () => {
    const start = lines.indexOf("UID:4:pt@swiatlosila-plan");
    expect(lines.slice(start + 2, start + 7)).toEqual([
      "DTSTART:20260904T100000",
      "DTEND:20260904T110000",
      "SUMMARY:A\\;B\\\\C",
      "DESCRIPTION:Sorger Fabian\\nhttps://example.test/4",
      "URL:https://example.test/4",
    ]);
  });

  it("folds the long summary in the output and unfolds back to the escaped title", () => {
    expect(ics).toContain("SUMMARY:Dlaczego jedni fotografowie zostają w pamięci\\, a inni tylko robi\r\n ą zdjęcia?");
    expect(lines).toContain(`SUMMARY:${escapeIcsText(LONG_TITLE)}`);
  });

  it("rolls a session that ends after midnight into the next day", () => {
    const late = makeSession({ id: "5:sob", eventId: 5, day: "sob", title: "Late", start: 1435, end: null, url: "https://example.test/5" });
    const lateLines = logicalLines(buildIcs([late], data, index));
    expect(lateLines).toContain("DTSTART:20260905T235500");
    expect(lateLines).toContain("DTEND:20260906T001500");
  });

  it("falls back to the Unix epoch for DTSTAMP when fetchedAt is not a date", () => {
    const broken = makeData([evening], { meta: { ...META, fetchedAt: "garbage" }, days: DAYS, locations: LOCATIONS, speakers: SPEAKERS });
    expect(logicalLines(buildIcs([evening], broken, buildIndex(broken)))).toContain("DTSTAMP:19700101T000000Z");
  });

  it("renders an empty plan as a calendar with no events", () => {
    expect(logicalLines(buildIcs([], data, index))).toEqual(["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//swiatlosila-plan//PL", "CALSCALE:GREGORIAN", "END:VCALENDAR"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/ics.test.ts`

Expected: `Error: Failed to load url ./ics`; no test runs.

- [ ] **Step 3: Write the implementation**

Create `src/domain/ics.ts`:

```ts
import { hasStart, type ScheduleData, type Session, type TimedSession } from "../data/types";
import { locationsOf, speakersOf, type DataIndex } from "./lookup";
import { visualEnd } from "./time";

const CRLF = "\r\n";
const LINE_OCTETS = 75;
const MINUTES_PER_DAY = 1440;

/** RFC 5545 TEXT escaping: backslash, semicolon, comma and newline. */
export function escapeIcsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

function utf8Octets(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

/** Folds at 75 octets of UTF-8; iterating by code point means no character is ever split. */
export function foldIcsLine(line: string): string {
  const pieces: string[] = [];
  let piece = "";
  let octets = 0;
  for (const ch of line) {
    const size = utf8Octets(ch);
    if (octets + size > LINE_OCTETS) {
      pieces.push(piece);
      piece = " ";
      octets = 1;
    }
    piece += ch;
    octets += size;
  }
  pieces.push(piece);
  return pieces.join(CRLF);
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** `20260903T125411Z` from an ISO timestamp; an unparseable value falls back to the Unix epoch. */
function utcStamp(iso: string): string {
  const parsed = new Date(iso).getTime();
  const date = new Date(Number.isNaN(parsed) ? 0 : parsed);
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Floating local date-time `20260904T093000` from a `YYYY-MM-DD` day and minutes since its midnight (past 24:00 rolls into the next day). */
function floatingTime(date: string, minutes: number): string {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const dayOffset = Math.floor(minutes / MINUTES_PER_DAY);
  const t = new Date(Date.UTC(year, month - 1, day + dayOffset, 0, minutes % MINUTES_PER_DAY));
  return `${pad(t.getUTCFullYear(), 4)}${pad(t.getUTCMonth() + 1, 2)}${pad(t.getUTCDate(), 2)}T${pad(t.getUTCHours(), 2)}${pad(t.getUTCMinutes(), 2)}00`;
}

function eventLines(s: TimedSession, date: string, stamp: string, index: DataIndex): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${s.id}@swiatlosila-plan`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${floatingTime(date, s.start)}`,
    `DTEND:${floatingTime(date, visualEnd(s))}`,
    `SUMMARY:${escapeIcsText(s.title)}`,
  ];
  const location = locationsOf(s, index)
    .map((l) => l.name)
    .join(", ");
  if (location !== "") lines.push(`LOCATION:${escapeIcsText(location)}`);
  const description: string[] = [];
  const speakers = speakersOf(s, index)
    .map((speaker) => speaker.name)
    .join(", ");
  if (speakers !== "") description.push(speakers);
  if (s.byline !== null && s.byline !== "") description.push(s.byline);
  description.push(s.url);
  lines.push(`DESCRIPTION:${escapeIcsText(description.join("\n"))}`, `URL:${s.url}`, "END:VEVENT");
  return lines;
}

export function buildIcs(sessions: Session[], data: ScheduleData, index: DataIndex): string {
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//swiatlosila-plan//PL", "CALSCALE:GREGORIAN"];
  const stamp = utcStamp(data.meta.fetchedAt);
  for (const s of sessions) {
    if (!hasStart(s)) continue;
    const day = index.dayById.get(s.day);
    if (day === undefined) continue;
    lines.push(...eventLines(s, day.date, stamp, index));
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `npx vitest run src/domain/ics.test.ts`

Expected: 17 tests pass.

Run: `npm run typecheck`

Expected: no errors.

Run: `npm test`

Expected: the whole suite is green (Tasks 14 to 17 add only new files).

- [ ] **Step 5: Commit**

```bash
git add src/domain/ics.ts src/domain/ics.test.ts && git commit -m "feat(domain): add ics export

buildIcs with VCALENDAR header, one floating-time VEVENT per timed
session, RFC 5545 TEXT escaping and UTF-8-safe 75-octet folding per
spec §5.5.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```


### Task 18: URL hash, theme and clipboard helpers

**Files:**
- Create: `src/state/hash.ts`
- Create: `src/state/theme.ts`
- Create: `src/state/clipboard.ts`
- Test: `src/state/hash.test.ts`
- Test: `src/state/theme.test.ts`
- Test: `src/state/clipboard.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (browser globals only: `history`, `location`, `document`, `window.matchMedia`, `navigator.clipboard`).
- Produces:
  - `hash.ts`: `interface HashState { d?: string; v?: string; plan?: string }`, `parseHash(hash: string): HashState`, `buildHash(h: HashState): string` (always `d`, `v`, `plan` order, keys with empty or undefined values omitted, values passed through `encodeURIComponent` so `1~abc.p` stays readable), `writeHash(h: HashState): void` (`history.replaceState(null, "", buildHash(h))`, a no-op outside a browser). Used by Task 19 (`setDay`/`setView`) and Task 20 (`resolveBoot`).
  - `theme.ts`: `applyTheme(theme: "system" | "dark" | "light"): void` sets `document.documentElement.dataset.theme` to `"dark"` or `"light"` (`system` resolves through `matchMedia("(prefers-color-scheme: light)")`; no `matchMedia` means dark). `watchSystemTheme(get: () => "system" | "dark" | "light"): () => void` re-applies on `prefers-color-scheme` change while `get()` returns `"system"`, returns an unsubscribe. The local `ThemeSetting` union is identical to `Settings["theme"]` from Task 19 (`theme.ts` cannot import the store type before the store exists).
  - `clipboard.ts`: `copyText(text: string): Promise<boolean>` resolves `false` when `navigator.clipboard.writeText` is missing or rejects, `true` after a successful write. Used by the plan actions and the copy sheet.

- [ ] **Step 1: Write the failing hash tests**

`src/state/hash.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHash, parseHash, writeHash } from "./hash";

describe("parseHash", () => {
  it("reads d, v and plan from a full hash", () => {
    expect(parseHash("#d=pt&v=grid&plan=1~abc.p")).toEqual({ d: "pt", v: "grid", plan: "1~abc.p" });
  });

  it("accepts a hash without the leading #", () => {
    expect(parseHash("d=sob")).toEqual({ d: "sob" });
  });

  it("returns an empty object for an empty or bare hash", () => {
    expect(parseHash("")).toEqual({});
    expect(parseHash("#")).toEqual({});
  });

  it("drops keys with empty values", () => {
    expect(parseHash("#d=&v=list")).toEqual({ v: "list" });
  });

  it("percent-decodes values", () => {
    expect(parseHash("#plan=1%7Eabc.p")).toEqual({ plan: "1~abc.p" });
  });

  it("ignores unknown keys", () => {
    expect(parseHash("#d=pt&x=1")).toEqual({ d: "pt" });
  });
});

describe("buildHash", () => {
  it("writes d, v then plan regardless of the input order", () => {
    expect(buildHash({ plan: "1~x.p", v: "plan", d: "sob" })).toBe("#d=sob&v=plan&plan=1~x.p");
  });

  it("omits plan when it is absent", () => {
    expect(buildHash({ d: "pt", v: "grid" })).toBe("#d=pt&v=grid");
  });

  it("omits empty strings", () => {
    expect(buildHash({ d: "pt", v: "grid", plan: "" })).toBe("#d=pt&v=grid");
  });

  it("round-trips through parseHash", () => {
    const h = { d: "pt", v: "list", plan: "1~1p.2s" };
    expect(parseHash(buildHash(h))).toEqual(h);
  });
});

describe("writeHash", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    history.replaceState(null, "", "/");
  });

  it("calls history.replaceState with a fragment-only URL", () => {
    const spy = vi.spyOn(history, "replaceState");
    writeHash({ d: "pt", v: "grid" });
    expect(spy).toHaveBeenCalledWith(null, "", "#d=pt&v=grid");
    expect(window.location.hash).toBe("#d=pt&v=grid");
  });

  it("preserves the path and the ?now= query", () => {
    history.replaceState(null, "", "/index.html?now=2026-09-04T10:30");
    writeHash({ d: "sob", v: "plan", plan: "1~1p" });
    expect(window.location.pathname).toBe("/index.html");
    expect(window.location.search).toBe("?now=2026-09-04T10:30");
    expect(window.location.hash).toBe("#d=sob&v=plan&plan=1~1p");
  });
});
```

- [ ] **Step 2: Run the hash test to verify it fails**

Run: `npx vitest run src/state/hash.test.ts`
Expected: the file fails to load with `Failed to resolve import "./hash"` (the module does not exist yet).

- [ ] **Step 3: Write `src/state/hash.ts`**

```ts
export interface HashState {
  d?: string;
  v?: string;
  plan?: string;
}

const KEYS = ["d", "v", "plan"] as const;

/** Reads `#d=pt&v=grid&plan=1~...`; the leading `#` is optional, empty values are dropped. */
export function parseHash(hash: string): HashState {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const out: HashState = {};
  for (const key of KEYS) {
    const value = params.get(key);
    if (value) out[key] = value;
  }
  return out;
}

/** Always `d`, `v`, `plan` order; `encodeURIComponent` leaves `~` and `.` intact so plan payloads stay readable. */
export function buildHash(h: HashState): string {
  const parts: string[] = [];
  for (const key of KEYS) {
    const value = h[key];
    if (value) parts.push(`${key}=${encodeURIComponent(value)}`);
  }
  return "#" + parts.join("&");
}

/** Fragment-only replaceState: the path and `?now=` query survive, Back is not affected. */
export function writeHash(h: HashState): void {
  if (typeof window === "undefined" || typeof history === "undefined") return;
  history.replaceState(null, "", buildHash(h));
}
```

- [ ] **Step 4: Run the hash tests to verify they pass**

Run: `npx vitest run src/state/hash.test.ts`
Expected: 12 tests pass.

- [ ] **Step 5: Write the failing theme tests**

`src/state/theme.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, watchSystemTheme } from "./theme";

type Listener = () => void;

/** Installs a controllable matchMedia: `(prefers-color-scheme: light)` matches while `light` is true. */
function installMatchMedia(initialLight: boolean) {
  const listeners = new Set<Listener>();
  const state = { light: initialLight };
  const mql = {
    get matches() {
      return state.light;
    },
    media: "(prefers-color-scheme: light)",
    onchange: null,
    addEventListener: (_type: string, cb: Listener) => {
      listeners.add(cb);
    },
    removeEventListener: (_type: string, cb: Listener) => {
      listeners.delete(cb);
    },
    addListener: (cb: Listener) => {
      listeners.add(cb);
    },
    removeListener: (cb: Listener) => {
      listeners.delete(cb);
    },
    dispatchEvent: () => true,
  };
  const matchMedia = vi.fn((query: string) => {
    if (query !== "(prefers-color-scheme: light)") {
      return { ...mql, media: query, matches: false } as unknown as MediaQueryList;
    }
    return mql as unknown as MediaQueryList;
  });
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    setLight(value: boolean) {
      state.light = value;
      for (const cb of listeners) cb();
    },
    listeners,
    matchMedia,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});

describe("applyTheme", () => {
  it("writes an explicit dark or light choice to data-theme", () => {
    installMatchMedia(true);
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("resolves system to light when the OS prefers light", () => {
    installMatchMedia(true);
    applyTheme("system");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("resolves system to dark when the OS does not prefer light", () => {
    installMatchMedia(false);
    applyTheme("system");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("resolves system to dark when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    applyTheme("system");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("watchSystemTheme", () => {
  it("re-applies the system theme when the preference changes", () => {
    const mm = installMatchMedia(false);
    applyTheme("system");
    expect(document.documentElement.dataset.theme).toBe("dark");
    const stop = watchSystemTheme(() => "system");
    mm.setLight(true);
    expect(document.documentElement.dataset.theme).toBe("light");
    stop();
  });

  it("ignores preference changes while an explicit theme is chosen", () => {
    const mm = installMatchMedia(false);
    applyTheme("dark");
    const stop = watchSystemTheme(() => "dark");
    mm.setLight(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    stop();
  });

  it("unsubscribes", () => {
    const mm = installMatchMedia(false);
    const stop = watchSystemTheme(() => "system");
    expect(mm.listeners.size).toBe(1);
    stop();
    expect(mm.listeners.size).toBe(0);
  });

  it("returns a no-op unsubscribe when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const stop = watchSystemTheme(() => "system");
    expect(() => stop()).not.toThrow();
  });
});
```

- [ ] **Step 6: Run the theme test to verify it fails**

Run: `npx vitest run src/state/theme.test.ts`
Expected: fails with `Failed to resolve import "./theme"`.

- [ ] **Step 7: Write `src/state/theme.ts`**

```ts
/** Same union as `Settings["theme"]` in `src/state/store.ts`; duplicated here so this module has no store dependency. */
type ThemeSetting = "system" | "dark" | "light";

const LIGHT_QUERY = "(prefers-color-scheme: light)";

function lightQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(LIGHT_QUERY);
}

function systemTheme(): "dark" | "light" {
  return lightQuery()?.matches ? "light" : "dark";
}

/** Sets `data-theme` on `<html>`; `tokens.css` keeps dark values on `:root` and light ones under `[data-theme="light"]`. */
export function applyTheme(theme: ThemeSetting): void {
  const resolved = theme === "system" ? systemTheme() : theme;
  document.documentElement.dataset.theme = resolved;
}

/** Re-applies the system theme on OS changes while `get()` is `"system"`. Returns the unsubscribe function. */
export function watchSystemTheme(get: () => ThemeSetting): () => void {
  const mql = lightQuery();
  if (!mql) return () => {};
  const onChange = () => {
    if (get() === "system") applyTheme("system");
  };
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}
```

- [ ] **Step 8: Run the theme tests to verify they pass**

Run: `npx vitest run src/state/theme.test.ts`
Expected: 8 tests pass.

- [ ] **Step 9: Write the failing clipboard test**

`src/state/clipboard.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value });
}

afterEach(() => {
  setClipboard(undefined);
});

describe("copyText", () => {
  it("writes the text and resolves true", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });
    await expect(copyText("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("resolves false when the clipboard API is missing", async () => {
    setClipboard(undefined);
    await expect(copyText("hello")).resolves.toBe(false);
  });

  it("resolves false when writeText is not a function", async () => {
    setClipboard({});
    await expect(copyText("hello")).resolves.toBe(false);
  });

  it("resolves false when writeText rejects", async () => {
    setClipboard({ writeText: vi.fn(() => Promise.reject(new Error("NotAllowedError"))) });
    await expect(copyText("hello")).resolves.toBe(false);
  });

  it("resolves false when writeText throws synchronously", async () => {
    setClipboard({
      writeText: () => {
        throw new Error("boom");
      },
    });
    await expect(copyText("hello")).resolves.toBe(false);
  });
});
```

- [ ] **Step 10: Run the clipboard test to verify it fails**

Run: `npx vitest run src/state/clipboard.test.ts`
Expected: fails with `Failed to resolve import "./clipboard"`.

- [ ] **Step 11: Write `src/state/clipboard.ts`**

```ts
/**
 * Copies `text` through `navigator.clipboard.writeText`.
 * Resolves `false` (never throws) when the API is missing or the write is refused,
 * so callers can fall back to the "Skopiuj ręcznie" sheet.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  const clipboard: Partial<Clipboard> | undefined = navigator.clipboard;
  if (!clipboard || typeof clipboard.writeText !== "function") return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 12: Run all three test files and the typecheck**

Run: `npx vitest run src/state/hash.test.ts src/state/theme.test.ts src/state/clipboard.test.ts`
Expected: 25 tests pass.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 13: Commit**

```bash
git add src/state/hash.ts src/state/hash.test.ts src/state/theme.ts src/state/theme.test.ts src/state/clipboard.ts src/state/clipboard.test.ts
git commit -m "feat(state): add hash, theme and clipboard helpers

parseHash/buildHash/writeHash keep the d,v,plan order and write a
fragment-only replaceState; applyTheme resolves system through
matchMedia; copyText reports clipboard failure as false.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```

### Task 19: Zustand store with persistence

**Files:**
- Create: `src/state/store.ts`
- Test: `src/state/store.test.ts`

**Interfaces:**
- Consumes:
  - `EMPTY_FILTERS`, `type Facet`, `type Filters` from `src/domain/filters.ts`.
  - `type SignupStatus` from `src/data/types.ts`; `type ColorBy` from `src/domain/colors.ts`.
  - `parseHash(hash: string): HashState`, `writeHash(h: HashState): void` from Task 18.
  - `zustand` (`create`) and `zustand/middleware` (`persist`, `createJSONStorage`, `type StateStorage`).
- Produces (exactly the contract's `src/state/store.ts` block): `View`, `ColumnAxis`, `TimeMode`, `Settings`, `Toast`, `SheetKind`, `SharedPlan`, `State`, `Actions`, `Store`, `STORAGE_KEY = "swiatlosila-2026:v1"`, `MOBILE_BREAKPOINT = 700`, `defaultSettings(viewportWidth)`, `defaultView(viewportWidth)`, `useStore` (created with `create<Store>()(persist(...))`, so its inferred type also carries `useStore.persist`), `planSetOf(state)`, `usePlanSet()`.
  - Action semantics later tasks rely on: `setDay`/`setView` write the hash (`plan` kept verbatim from the current hash only while `sharedPlan` is set); `setView` to anything but `"plan"` clears `previewPlan`; `toggleFavourite` pushes no toast; `resetSettings` keeps `theme` and `planLayout`; `loadSharedPlan` unions into `favourites`, `previewSharedPlan` sets `previewPlan` and `view: "plan"`, `dismissSharedPlan` only clears, and all three clear `sharedPlan` and drop `plan` from the hash; `setSharedPlan` only sets the field (boot writes the hash itself); `savePreview` unions and clears `previewPlan`; `closePreview` clears it; `selectSession(id)` also sets `openSheet` to `"detail"` (or closes a detail sheet when `id` is null); `pushToast` only appends `{ id, text, action? }` with increasing ids and starts no timer (the `Toasts` component in Task 23 owns the display timer: 3000 ms, 6000 ms with an action); `dismissToast(id)` removes one toast; `storageFailed` flips to `true` the first time the storage adapter catches a throw (no toast from the store; `main.tsx` pushes "Nie mogę zapisać ulubionych w tej przeglądarce").
  - The initial `day` is `""` until `main.tsx` applies `resolveBoot` (Task 20).

- [ ] **Step 1: Write the failing store tests**

`src/state/store.test.ts`:

```ts
// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FILTERS } from "../domain/filters";
import {
  STORAGE_KEY,
  defaultSettings,
  defaultView,
  planSetOf,
  usePlanSet,
  useStore,
  type Settings,
} from "./store";

function resetStore() {
  useStore.setState({
    day: "pt",
    view: "grid",
    filters: { ...EMPTY_FILTERS },
    settings: defaultSettings(window.innerWidth),
    favourites: [],
    selectedSessionId: null,
    openSheet: null,
    sharedPlan: null,
    previewPlan: null,
    toasts: [],
    copyText: null,
    storageFailed: false,
  });
}

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/");
  resetStore();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("defaults", () => {
  it("defaultSettings below 700 px uses a single column and zoom 1.6", () => {
    expect(defaultSettings(699)).toEqual({
      columnAxis: "none",
      timeMode: "auto",
      slotTolerance: 15,
      zoom: 1.6,
      density: "comfortable",
      colorBy: "type",
      showAvatars: true,
      allDayStrip: true,
      planLayout: "list",
      theme: "system",
    });
  });

  it("defaultSettings at 700 px and up uses the location axis and zoom 2", () => {
    expect(defaultSettings(700)).toEqual({
      columnAxis: "location",
      timeMode: "auto",
      slotTolerance: 15,
      zoom: 2,
      density: "comfortable",
      colorBy: "type",
      showAvatars: true,
      allDayStrip: true,
      planLayout: "list",
      theme: "system",
    });
  });

  it("defaultView is list below 700 px and grid otherwise", () => {
    expect(defaultView(699)).toBe("list");
    expect(defaultView(700)).toBe("grid");
    expect(defaultView(1440)).toBe("grid");
  });
});

describe("favourites", () => {
  it("toggleFavourite adds and removes an id without pushing a toast", () => {
    useStore.getState().toggleFavourite("1:pt");
    expect(useStore.getState().favourites).toEqual(["1:pt"]);
    useStore.getState().toggleFavourite("2:pt");
    expect(useStore.getState().favourites).toEqual(["1:pt", "2:pt"]);
    useStore.getState().toggleFavourite("1:pt");
    expect(useStore.getState().favourites).toEqual(["2:pt"]);
    expect(useStore.getState().toasts).toEqual([]);
  });

  it("addFavourites unions in order and skips duplicates", () => {
    useStore.getState().addFavourites(["1:pt", "2:pt"]);
    useStore.getState().addFavourites(["2:pt", "3:sob", "1:pt"]);
    expect(useStore.getState().favourites).toEqual(["1:pt", "2:pt", "3:sob"]);
  });

  it("removeFavourite drops one id and tolerates unknown ids", () => {
    useStore.getState().addFavourites(["1:pt", "2:pt"]);
    useStore.getState().removeFavourite("1:pt");
    useStore.getState().removeFavourite("nope");
    expect(useStore.getState().favourites).toEqual(["2:pt"]);
  });
});

describe("persistence", () => {
  it("persists favourites, settings and view under STORAGE_KEY with version 1 and nothing else", () => {
    useStore.getState().toggleFavourite("1:pt");
    useStore.getState().setSettings({ zoom: 2.4 });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw ?? "{}") as { state: Record<string, unknown>; version: number };
    expect(stored.version).toBe(1);
    expect(stored.state.favourites).toEqual(["1:pt"]);
    expect(stored.state.view).toBe("grid");
    expect((stored.state.settings as Settings).zoom).toBe(2.4);
    expect(Object.keys(stored.state).sort()).toEqual(["favourites", "settings", "view"]);
  });

  it("round-trips favourites through localStorage", async () => {
    useStore.getState().toggleFavourite("1:pt");
    useStore.getState().toggleFavourite("2:pt");
    const raw = localStorage.getItem(STORAGE_KEY) ?? "";
    resetStore();
    expect(useStore.getState().favourites).toEqual([]);
    localStorage.setItem(STORAGE_KEY, raw);
    await useStore.persist.rehydrate();
    expect(useStore.getState().favourites).toEqual(["1:pt", "2:pt"]);
  });

  it("merge fills settings missing from storage with the viewport defaults and never touches day", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { favourites: ["2:sob"], settings: { zoom: 3, theme: "dark" }, view: "list" },
        version: 1,
      }),
    );
    await useStore.persist.rehydrate();
    const s = useStore.getState();
    expect(s.favourites).toEqual(["2:sob"]);
    expect(s.view).toBe("list");
    expect(s.settings).toEqual({ ...defaultSettings(window.innerWidth), zoom: 3, theme: "dark" });
    expect(s.day).toBe("pt");
  });

  it("keeps working in memory and sets storageFailed when localStorage.setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => useStore.getState().toggleFavourite("1:pt")).not.toThrow();
    expect(useStore.getState().favourites).toEqual(["1:pt"]);
    expect(useStore.getState().storageFailed).toBe(true);
    expect(useStore.getState().toasts).toEqual([]);
  });
});

describe("filters", () => {
  it("setFilters patches, clearFacet empties one facet and clearFilters resets everything", () => {
    useStore.getState().setFilters({ types: [184], query: "foto", onlyFavourites: true });
    expect(useStore.getState().filters).toEqual({ ...EMPTY_FILTERS, types: [184], query: "foto", onlyFavourites: true });
    useStore.getState().clearFacet("types");
    expect(useStore.getState().filters.types).toEqual([]);
    expect(useStore.getState().filters.query).toBe("foto");
    useStore.getState().clearFilters();
    expect(useStore.getState().filters).toEqual(EMPTY_FILTERS);
  });

  it("toggleFacetValue adds and removes numeric ids and signup statuses", () => {
    useStore.getState().toggleFacetValue("locations", 233);
    useStore.getState().toggleFacetValue("locations", 281);
    expect(useStore.getState().filters.locations).toEqual([233, 281]);
    useStore.getState().toggleFacetValue("locations", 233);
    expect(useStore.getState().filters.locations).toEqual([281]);
    useStore.getState().toggleFacetValue("signup", "open");
    expect(useStore.getState().filters.signup).toEqual(["open"]);
    useStore.getState().toggleFacetValue("signup", "open");
    expect(useStore.getState().filters.signup).toEqual([]);
  });
});

describe("settings", () => {
  it("setSettings patches one field at a time", () => {
    useStore.getState().setSettings({ density: "compact" });
    expect(useStore.getState().settings.density).toBe("compact");
    expect(useStore.getState().settings.zoom).toBe(2);
  });

  it("resetSettings restores the viewport defaults but keeps theme and planLayout", () => {
    useStore.getState().setSettings({ zoom: 3.2, density: "compact", theme: "light", planLayout: "grid", columnAxis: "brand" });
    useStore.getState().resetSettings();
    expect(useStore.getState().settings).toEqual({ ...defaultSettings(window.innerWidth), theme: "light", planLayout: "grid" });
  });
});

describe("day, view and the hash", () => {
  it("setDay writes #d=<day>&v=<view>", () => {
    useStore.getState().setDay("sob");
    expect(useStore.getState().day).toBe("sob");
    expect(window.location.hash).toBe("#d=sob&v=grid");
  });

  it("setView writes the hash and clears previewPlan when leaving the plan view", () => {
    useStore.setState({ previewPlan: ["1:pt"], view: "plan" });
    useStore.getState().setView("plan");
    expect(useStore.getState().previewPlan).toEqual(["1:pt"]);
    useStore.getState().setView("list");
    expect(useStore.getState().previewPlan).toBeNull();
    expect(window.location.hash).toBe("#d=pt&v=list");
  });

  it("keeps the plan parameter verbatim while a shared plan is pending", () => {
    history.replaceState(null, "", "#d=pt&v=grid&plan=1~1p.2p");
    useStore.getState().setSharedPlan({ ids: ["1:pt", "2:pt"], unknown: 0 });
    useStore.getState().setDay("sob");
    expect(window.location.hash).toBe("#d=sob&v=grid&plan=1~1p.2p");
  });
});

describe("share flow", () => {
  it("previewSharedPlan sets previewPlan, switches to the plan view and clears sharedPlan without touching favourites", () => {
    useStore.setState({ favourites: ["1:pt"] });
    useStore.getState().setSharedPlan({ ids: ["2:pt", "1:pt"], unknown: 1 });
    useStore.getState().previewSharedPlan();
    const s = useStore.getState();
    expect(s.previewPlan).toEqual(["2:pt", "1:pt"]);
    expect(s.view).toBe("plan");
    expect(s.sharedPlan).toBeNull();
    expect(s.favourites).toEqual(["1:pt"]);
    expect(planSetOf(s)).toEqual(new Set(["2:pt", "1:pt"]));
    expect(window.location.hash).toBe("#d=pt&v=plan");
  });

  it("savePreview unions the preview into favourites and clears it", () => {
    useStore.setState({ favourites: ["1:pt"], previewPlan: ["2:pt", "1:pt"], view: "plan" });
    useStore.getState().savePreview();
    expect(useStore.getState().favourites).toEqual(["1:pt", "2:pt"]);
    expect(useStore.getState().previewPlan).toBeNull();
  });

  it("closePreview clears the preview and leaves favourites alone", () => {
    useStore.setState({ favourites: ["1:pt"], previewPlan: ["2:pt"], view: "plan" });
    useStore.getState().closePreview();
    expect(useStore.getState().previewPlan).toBeNull();
    expect(useStore.getState().favourites).toEqual(["1:pt"]);
  });

  it("loadSharedPlan unions the ids into favourites, clears sharedPlan and drops plan from the hash", () => {
    history.replaceState(null, "", "#d=pt&v=grid&plan=1~1p.2p");
    useStore.setState({ favourites: ["1:pt"] });
    useStore.getState().setSharedPlan({ ids: ["1:pt", "2:pt"], unknown: 0 });
    useStore.getState().loadSharedPlan();
    expect(useStore.getState().favourites).toEqual(["1:pt", "2:pt"]);
    expect(useStore.getState().sharedPlan).toBeNull();
    expect(window.location.hash).toBe("#d=pt&v=grid");
  });

  it("dismissSharedPlan only clears sharedPlan and the plan parameter", () => {
    history.replaceState(null, "", "#d=pt&v=grid&plan=1~1p");
    useStore.getState().setSharedPlan({ ids: ["1:pt"], unknown: 0 });
    useStore.getState().dismissSharedPlan();
    expect(useStore.getState().sharedPlan).toBeNull();
    expect(useStore.getState().favourites).toEqual([]);
    expect(useStore.getState().previewPlan).toBeNull();
    expect(window.location.hash).toBe("#d=pt&v=grid");
  });

  it("previewSharedPlan and loadSharedPlan are no-ops without a shared plan", () => {
    useStore.getState().previewSharedPlan();
    useStore.getState().loadSharedPlan();
    expect(useStore.getState().view).toBe("grid");
    expect(useStore.getState().previewPlan).toBeNull();
    expect(useStore.getState().favourites).toEqual([]);
  });
});

describe("toasts", () => {
  it("pushToast appends toasts in order with increasing ids and no action by default", () => {
    useStore.getState().pushToast("Skopiowano link do planu");
    useStore.getState().pushToast("Usunięto z planu: Sesja");
    const [a, b] = useStore.getState().toasts;
    expect(useStore.getState().toasts.map((t) => t.text)).toEqual(["Skopiowano link do planu", "Usunięto z planu: Sesja"]);
    expect(a !== undefined && b !== undefined && b.id > a.id).toBe(true);
    expect(a).toEqual({ id: a?.id, text: "Skopiowano link do planu" });
  });

  it("keeps a toast with an action until dismissToast; the store starts no timer", () => {
    vi.useFakeTimers();
    const run = vi.fn();
    useStore.getState().pushToast("Usunięto z planu: Sesja", { label: "Cofnij", run });
    const toast = useStore.getState().toasts[0];
    expect(toast?.action?.label).toBe("Cofnij");
    toast?.action?.run();
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10000);
    expect(useStore.getState().toasts).toHaveLength(1);
    useStore.getState().dismissToast(toast?.id ?? -1);
    expect(useStore.getState().toasts).toHaveLength(0);
  });

  it("dismissToast removes only the given toast and ignores unknown ids", () => {
    useStore.getState().pushToast("a");
    useStore.getState().pushToast("b");
    const [a] = useStore.getState().toasts;
    useStore.getState().dismissToast(a?.id ?? -1);
    expect(useStore.getState().toasts.map((t) => t.text)).toEqual(["b"]);
    useStore.getState().dismissToast(-1);
    expect(useStore.getState().toasts.map((t) => t.text)).toEqual(["b"]);
  });
});

describe("selection, sheets and misc", () => {
  it("selectSession opens the detail sheet and selecting null closes it", () => {
    useStore.getState().selectSession("1:pt");
    expect(useStore.getState()).toMatchObject({ selectedSessionId: "1:pt", openSheet: "detail" });
    useStore.getState().selectSession(null);
    expect(useStore.getState()).toMatchObject({ selectedSessionId: null, openSheet: null });
  });

  it("selectSession(null) leaves another open sheet alone", () => {
    useStore.getState().setSheet("filters");
    useStore.getState().selectSession(null);
    expect(useStore.getState().openSheet).toBe("filters");
  });

  it("setSheet, setCopyText and setNow write their fields", () => {
    useStore.getState().setSheet("copy");
    useStore.getState().setCopyText("tekst");
    const now = new Date(2026, 8, 4, 10, 30);
    useStore.getState().setNow(now);
    expect(useStore.getState()).toMatchObject({ openSheet: "copy", copyText: "tekst", now });
  });
});

describe("plan set", () => {
  it("planSetOf prefers previewPlan and is memoized on array identity", () => {
    useStore.setState({ favourites: ["1:pt"] });
    const first = planSetOf(useStore.getState());
    expect([...first]).toEqual(["1:pt"]);
    useStore.getState().setDay("sob");
    expect(planSetOf(useStore.getState())).toBe(first);
    useStore.setState({ previewPlan: ["9:sob"] });
    expect([...planSetOf(useStore.getState())]).toEqual(["9:sob"]);
  });

  it("usePlanSet follows favourites and previewPlan and keeps its identity across unrelated changes", () => {
    const { result } = renderHook(() => usePlanSet());
    expect(result.current.size).toBe(0);
    act(() => {
      useStore.getState().toggleFavourite("1:pt");
    });
    expect(result.current.has("1:pt")).toBe(true);
    const before = result.current;
    act(() => {
      useStore.getState().setDay("sob");
    });
    expect(result.current).toBe(before);
    act(() => {
      useStore.setState({ previewPlan: ["9:sob"] });
    });
    expect([...result.current]).toEqual(["9:sob"]);
  });
});

describe("storage failure at creation", () => {
  it("sets storageFailed when reading storage throws while the store is created", async () => {
    vi.resetModules();
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    try {
      const fresh = await import("./store");
      expect(fresh.useStore.getState().storageFailed).toBe(true);
      expect(fresh.useStore.getState().favourites).toEqual([]);
    } finally {
      spy.mockRestore();
      vi.resetModules();
    }
  });
});
```

- [ ] **Step 2: Run the store test to verify it fails**

Run: `npx vitest run src/state/store.test.ts`
Expected: fails with `Failed to resolve import "./store"`.

- [ ] **Step 3: Write `src/state/store.ts`**

```ts
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { SignupStatus } from "../data/types";
import type { ColorBy } from "../domain/colors";
import { EMPTY_FILTERS, type Facet, type Filters } from "../domain/filters";
import { parseHash, writeHash } from "./hash";

export type View = "grid" | "list" | "plan";
export type ColumnAxis = "location" | "type" | "brand" | "level" | "none";
export type TimeMode = "auto" | "slots" | "timeline";

export interface Settings {
  columnAxis: ColumnAxis;
  timeMode: TimeMode;
  slotTolerance: number;
  zoom: number;
  density: "compact" | "comfortable";
  colorBy: ColorBy;
  showAvatars: boolean;
  allDayStrip: boolean;
  planLayout: "grid" | "list";
  theme: "system" | "dark" | "light";
}

export interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

export type SheetKind = "filters" | "settings" | "detail" | "copy" | null;

export interface SharedPlan {
  ids: string[];
  unknown: number;
}

export interface State {
  day: string;
  view: View;
  filters: Filters;
  settings: Settings;
  favourites: string[];
  selectedSessionId: string | null;
  openSheet: SheetKind;
  sharedPlan: SharedPlan | null;
  previewPlan: string[] | null;
  now: Date;
  toasts: Toast[];
  copyText: string | null;
  storageFailed: boolean;
}

export interface Actions {
  setDay(day: string): void;
  setView(view: View): void;
  setFilters(patch: Partial<Filters>): void;
  clearFilters(): void;
  clearFacet(facet: Facet): void;
  toggleFacetValue(facet: Facet, value: number | SignupStatus): void;
  setSettings(patch: Partial<Settings>): void;
  resetSettings(): void;
  toggleFavourite(id: string): void;
  addFavourites(ids: string[]): void;
  removeFavourite(id: string): void;
  selectSession(id: string | null): void;
  setSheet(kind: SheetKind): void;
  setSharedPlan(plan: SharedPlan | null): void;
  loadSharedPlan(): void;
  previewSharedPlan(): void;
  dismissSharedPlan(): void;
  savePreview(): void;
  closePreview(): void;
  pushToast(text: string, action?: Toast["action"]): void;
  dismissToast(id: number): void;
  setNow(now: Date): void;
  setCopyText(text: string | null): void;
}

export type Store = State & Actions;

export const STORAGE_KEY = "swiatlosila-2026:v1";
export const MOBILE_BREAKPOINT = 700;

export function defaultSettings(viewportWidth: number): Settings {
  const mobile = viewportWidth < MOBILE_BREAKPOINT;
  return {
    columnAxis: mobile ? "none" : "location",
    timeMode: "auto",
    slotTolerance: 15,
    zoom: mobile ? 1.6 : 2,
    density: "comfortable",
    colorBy: "type",
    showAvatars: true,
    allDayStrip: true,
    planLayout: "list",
    theme: "system",
  };
}

export function defaultView(viewportWidth: number): View {
  return viewportWidth < MOBILE_BREAKPOINT ? "list" : "grid";
}

function viewportWidth(): number {
  return typeof window === "undefined" ? 1024 : window.innerWidth;
}

/** Appends the ids of `extra` that are not already in `base`, keeping order. */
function union(base: string[], extra: string[]): string[] {
  const seen = new Set(base);
  const out = [...base];
  for (const id of extra) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Replaces one facet's values; numbers go to the id facets, statuses to `signup`. */
function setFacet(f: Filters, facet: Facet, values: (number | SignupStatus)[]): Filters {
  const numbers = values.filter((v): v is number => typeof v === "number");
  const statuses = values.filter((v): v is SignupStatus => typeof v === "string");
  switch (facet) {
    case "types":
      return { ...f, types: numbers };
    case "themes":
      return { ...f, themes: numbers };
    case "brands":
      return { ...f, brands: numbers };
    case "locations":
      return { ...f, locations: numbers };
    case "signup":
      return { ...f, signup: statuses };
  }
}

/** Writes `#d=&v=`; the `plan` parameter is kept verbatim only while a shared plan awaits the banner. */
function syncHash(state: State): void {
  const plan =
    state.sharedPlan !== null && typeof window !== "undefined" ? parseHash(window.location.hash).plan : undefined;
  writeHash({ d: state.day, v: state.view, plan });
}

// Storage adapter: every localStorage call is guarded so private mode or a full quota
// degrades to memory. Failures before the store exists are replayed right after creation.
let storageFailedEarly = false;
let reportStorageFailure: () => void = () => {
  storageFailedEarly = true;
};

const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return globalThis.localStorage.getItem(name);
    } catch {
      reportStorageFailure();
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.localStorage.setItem(name, value);
    } catch {
      reportStorageFailure();
    }
  },
  removeItem: (name) => {
    try {
      globalThis.localStorage.removeItem(name);
    } catch {
      reportStorageFailure();
    }
  },
};

type PersistedSlice = Pick<State, "favourites" | "settings" | "view">;

function initialState(): State {
  const width = viewportWidth();
  return {
    day: "",
    view: defaultView(width),
    filters: { ...EMPTY_FILTERS },
    settings: defaultSettings(width),
    favourites: [],
    selectedSessionId: null,
    openSheet: null,
    sharedPlan: null,
    previewPlan: null,
    now: new Date(),
    toasts: [],
    copyText: null,
    storageFailed: false,
  };
}

let toastSeq = 0;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState(),

      setDay: (day) => {
        set({ day });
        syncHash(get());
      },
      setView: (view) => {
        set((s) => ({ view, previewPlan: view === "plan" ? s.previewPlan : null }));
        syncHash(get());
      },

      setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
      clearFilters: () => set({ filters: { ...EMPTY_FILTERS } }),
      clearFacet: (facet) => set((s) => ({ filters: setFacet(s.filters, facet, []) })),
      toggleFacetValue: (facet, value) =>
        set((s) => {
          const current: (number | SignupStatus)[] = s.filters[facet];
          return { filters: setFacet(s.filters, facet, toggleIn(current, value)) };
        }),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetSettings: () =>
        set((s) => ({
          settings: { ...defaultSettings(viewportWidth()), theme: s.settings.theme, planLayout: s.settings.planLayout },
        })),

      toggleFavourite: (id) => set((s) => ({ favourites: toggleIn(s.favourites, id) })),
      addFavourites: (ids) => set((s) => ({ favourites: union(s.favourites, ids) })),
      removeFavourite: (id) => set((s) => ({ favourites: s.favourites.filter((f) => f !== id) })),

      selectSession: (id) =>
        set((s) => ({
          selectedSessionId: id,
          openSheet: id !== null ? "detail" : s.openSheet === "detail" ? null : s.openSheet,
        })),
      setSheet: (kind) => set({ openSheet: kind }),

      setSharedPlan: (plan) => set({ sharedPlan: plan }),
      loadSharedPlan: () => {
        const shared = get().sharedPlan;
        if (shared === null) return;
        set((s) => ({ favourites: union(s.favourites, shared.ids), sharedPlan: null }));
        syncHash(get());
      },
      previewSharedPlan: () => {
        const shared = get().sharedPlan;
        if (shared === null) return;
        set({ previewPlan: shared.ids, view: "plan", sharedPlan: null });
        syncHash(get());
      },
      dismissSharedPlan: () => {
        set({ sharedPlan: null });
        syncHash(get());
      },

      savePreview: () => {
        const preview = get().previewPlan;
        if (preview === null) return;
        set((s) => ({ favourites: union(s.favourites, preview), previewPlan: null }));
      },
      closePreview: () => set({ previewPlan: null }),

      // The Toasts component owns the display timer; the store only queues and removes.
      pushToast: (text, action) => {
        const id = ++toastSeq;
        const toast: Toast = action ? { id, text, action } : { id, text };
        set((s) => ({ toasts: [...s.toasts, toast] }));
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      setNow: (now) => set({ now }),
      setCopyText: (text) => set({ copyText: text }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s): PersistedSlice => ({ favourites: s.favourites, settings: s.settings, view: s.view }),
      // Reserved for future shape changes; version 1 is returned unchanged.
      migrate: (persisted) => persisted as PersistedSlice,
      // Runs on every hydration: a Settings field missing from storage gets its default
      // without a version bump and without wiping the other stored choices.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersistedSlice>;
        return { ...current, ...p, settings: { ...defaultSettings(viewportWidth()), ...p.settings } };
      },
    },
  ),
);

reportStorageFailure = () => {
  if (!useStore.getState().storageFailed) useStore.setState({ storageFailed: true });
};
if (storageFailedEarly) reportStorageFailure();

// The plan set is memoized on the identity of `previewPlan ?? favourites`, so selectors
// built on it return a stable Set until membership actually changes.
let cachedSource: string[] | null = null;
let cachedSet: ReadonlySet<string> = new Set<string>();

export function planSetOf(state: State): ReadonlySet<string> {
  const source = state.previewPlan ?? state.favourites;
  if (source !== cachedSource) {
    cachedSource = source;
    cachedSet = new Set(source);
  }
  return cachedSet;
}

export function usePlanSet(): ReadonlySet<string> {
  return useStore(planSetOf);
}
```

- [ ] **Step 4: Run the store tests to verify they pass**

Run: `npx vitest run src/state/store.test.ts`
Expected: 32 tests pass.

Run: `npm run typecheck`
Expected: no errors. (`useStore` keeps its inferred `persist`-mutated type so `useStore.persist.rehydrate()` type-checks; the contract's `UseBoundStore<StoreApi<Store>>` is its supertype.)

- [ ] **Step 5: Commit**

```bash
git add src/state/store.ts src/state/store.test.ts
git commit -m "feat(state): add persisted Zustand store

Favourites, settings and view persist under swiatlosila-2026:v1 with a
merge that fills missing settings from the viewport defaults; a guarded
storage adapter sets storageFailed instead of throwing; actions cover
filters, settings reset, share/preview flow, toasts and the hash.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```

### Task 20: Boot resolution

**Files:**
- Create: `src/state/boot.ts`
- Test: `src/state/boot.test.ts`

**Interfaces:**
- Consumes:
  - `parseHash(hash: string): HashState` from Task 18.
  - `defaultView(viewportWidth: number): View`, `type View`, `type SharedPlan` from Task 19.
  - `defaultDay(days: Day[], now: Date, sessionsPerDay: Map<string, number>): Day` from `src/domain/now.ts`.
  - `decodePlan(str: string, sessionIds: ReadonlySet<string>): { ids: string[]; unknown: number }` from `src/domain/share.ts`.
  - `DataIndex` (`dayById`, `sessionsByDay`, `sessionIds`) from `src/domain/lookup.ts`; `ScheduleData` from `src/data/types.ts`.
  - Tests: `buildIndex`, `encodePlan`, `makeData`, `makeSession` from the contract.
- Produces: `interface BootResult { day: string; view: View; sharedPlan: SharedPlan | null; favourites: string[]; droppedFavourites: number }` and `resolveBoot(args: { hash; persistedView; persistedFavourites; viewportWidth; data; index; now }): BootResult`. `favourites` is `persistedFavourites` filtered to ids present in `index.sessionIds`, in stored order; `droppedFavourites` is how many were removed (spec §6). `main.tsx` calls it once after rehydration with `persistedFavourites: useStore.getState().favourites`, applies the result through `useStore.setState({ day, view, sharedPlan, favourites })`, pushes the toast "Pominięto N zapisanych wydarzeń, których nie ma w tej wersji harmonogramu" when `droppedFavourites > 0`, then `writeHash({ d: day, v: view, plan: parseHash(location.hash).plan })` so an existing `plan` parameter survives verbatim until the banner is answered. `resolveBoot` is pure: it never writes the hash or the store.

- [ ] **Step 1: Write the failing boot test**

`src/state/boot.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Day } from "../data/types";
import { buildIndex } from "../domain/lookup";
import { encodePlan } from "../domain/share";
import { makeData, makeSession } from "../test/fixtures/build";
import { resolveBoot } from "./boot";

const DAYS: Day[] = [
  { id: "czw", termId: 276, date: "2026-09-03", label: "Czwartek", short: "Czw", labelLong: "Czwartek, 3 września" },
  { id: "pt", termId: 53, date: "2026-09-04", label: "Piątek", short: "Pt", labelLong: "Piątek, 4 września" },
  { id: "sob", termId: 18, date: "2026-09-05", label: "Sobota", short: "Sob", labelLong: "Sobota, 5 września" },
];

function sessionsFor(day: string, count: number, firstEvent: number) {
  return Array.from({ length: count }, (_, i) =>
    makeSession({
      id: `${firstEvent + i}:${day}`,
      eventId: firstEvent + i,
      day,
      start: 570 + i * 60,
      end: 630 + i * 60,
    }),
  );
}

// Thursday holds 1 session, Friday and Saturday 6 each, so defaultDay skips Thursday.
const data = makeData(
  [...sessionsFor("czw", 1, 100), ...sessionsFor("pt", 6, 200), ...sessionsFor("sob", 6, 300)],
  { days: DAYS },
);
const index = buildIndex(data);
const saturday = new Date(2026, 8, 5, 10, 0);
const friday = new Date(2026, 8, 4, 10, 0);

type BootArgs = Parameters<typeof resolveBoot>[0];

function boot(over: Partial<BootArgs> = {}) {
  return resolveBoot({ hash: "", persistedView: null, persistedFavourites: [], viewportWidth: 1200, data, index, now: saturday, ...over });
}

describe("resolveBoot view precedence", () => {
  it("a valid v in the hash wins over storage and the viewport", () => {
    expect(boot({ hash: "#d=pt&v=list", persistedView: "plan", viewportWidth: 1200 })).toEqual({
      day: "pt",
      view: "list",
      sharedPlan: null,
      favourites: [],
      droppedFavourites: 0,
    });
  });

  it("an unknown v is skipped in favour of the persisted view", () => {
    expect(boot({ hash: "#v=foo", persistedView: "plan" }).view).toBe("plan");
  });

  it("the persisted view is used when the hash has none", () => {
    expect(boot({ persistedView: "list", viewportWidth: 1200 }).view).toBe("list");
  });

  it("the viewport decides when neither the hash nor storage has a view", () => {
    expect(boot({ viewportWidth: 699 }).view).toBe("list");
    expect(boot({ viewportWidth: 700 }).view).toBe("grid");
  });
});

describe("resolveBoot day precedence", () => {
  it("a valid d in the hash wins over defaultDay", () => {
    expect(boot({ hash: "#d=czw", now: saturday }).day).toBe("czw");
  });

  it("an unknown d falls back to defaultDay", () => {
    expect(boot({ hash: "#d=nd", now: saturday }).day).toBe("sob");
    expect(boot({ hash: "#d=nd", now: friday }).day).toBe("pt");
  });

  it("defaultDay skips days with 5 sessions or fewer and handles dates outside the festival", () => {
    expect(boot({ now: new Date(2026, 8, 1, 9, 0) }).day).toBe("pt");
    expect(boot({ now: new Date(2026, 8, 20, 9, 0) }).day).toBe("pt");
  });
});

describe("resolveBoot shared plan", () => {
  it("decodes plan into sharedPlan and counts ids missing from the data", () => {
    const hash = `#d=pt&v=grid&plan=${encodePlan(["200:pt", "301:sob"])}.rrp`;
    expect(boot({ hash }).sharedPlan).toEqual({ ids: ["200:pt", "301:sob"], unknown: 1 });
  });

  it("an unknown version prefix yields a shared plan with no ids", () => {
    expect(boot({ hash: "#plan=9~5kp" }).sharedPlan).toEqual({ ids: [], unknown: 0 });
  });

  it("no plan parameter yields null", () => {
    expect(boot({ hash: "#d=pt&v=grid" }).sharedPlan).toBeNull();
    expect(boot({ hash: "#d=pt&v=grid&plan=" }).sharedPlan).toBeNull();
  });
});

describe("resolveBoot favourites", () => {
  it("drops persisted ids the data does not know and counts them", () => {
    const result = boot({ persistedFavourites: ["200:pt", "999:pt", "301:sob", "100:nd"] });
    expect(result.favourites).toEqual(["200:pt", "301:sob"]);
    expect(result.droppedFavourites).toBe(2);
  });

  it("keeps known ids in their stored order and reports zero dropped", () => {
    const result = boot({ persistedFavourites: ["301:sob", "100:czw", "200:pt"] });
    expect(result.favourites).toEqual(["301:sob", "100:czw", "200:pt"]);
    expect(result.droppedFavourites).toBe(0);
    expect(boot()).toMatchObject({ favourites: [], droppedFavourites: 0 });
  });
});
```

- [ ] **Step 2: Run the boot test to verify it fails**

Run: `npx vitest run src/state/boot.test.ts`
Expected: fails with `Failed to resolve import "./boot"`.

- [ ] **Step 3: Write `src/state/boot.ts`**

```ts
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
```

- [ ] **Step 4: Run the boot tests to verify they pass**

Run: `npx vitest run src/state/boot.test.ts`
Expected: 12 tests pass.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/state/boot.ts src/state/boot.test.ts
git commit -m "feat(state): resolve day, view and shared plan at boot

Hash values win when they name a known day or view, storage supplies
the view next, the viewport last; the plan parameter is decoded with
unknown ids counted; persisted favourites are pruned to known session
ids and the dropped count is returned for the boot toast.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```

### Task 21: Derived session sets, columns, time mode and list groups

**Files:**
- Create: `src/state/derive.ts`
- Test: `src/state/derive.test.ts`

**Interfaces:**
- Consumes:
  - `hasStart`, types `Level`, `Location`, `ScheduleData`, `Session`, `Term`, `TimedSession` from `src/data/types.ts`.
  - `applyFilters(sessions, filters, planSet, search, opts?)`, `type Filters`, `type SearchIndex` from `src/domain/filters.ts` (tests also use `EMPTY_FILTERS`, `buildSearchIndex`).
  - `DataIndex`, `locationsOf(s, index)`, `primaryType(s, index)`, `typeRank(name)` from `src/domain/lookup.ts` (tests use `buildIndex`).
  - `maxConcurrency(sessions: TimedSession[])` from `src/domain/overlaps.ts`.
  - `detectSlots`, `slotIndexOf`, `slotRegularity`, types `Slot`, `Regularity` from `src/domain/slots.ts`.
  - `formatRange`, `formatTime` from `src/domain/time.ts`.
  - `type ColumnAxis`, `type Settings` from Task 19 (type-only import, so this module stays free of React and Zustand at runtime and its tests run in the node environment).
  - Tests: `makeData`, `makeLocation`, `makeSession` from `src/test/fixtures/build.ts`.
- Produces (exactly the contract's `src/state/derive.ts` block): `DaySets`, `daySets(args)`, `Column`, `buildColumns(sets, axis, data, index)`, `ResolvedTime`, `resolveTimeMode(settings, layout)`, `ListGroup`, `listGroups(sets, resolved, settings)`.
  - Column keys later tasks may rely on: `loc:<id>`, `type:<id>` / `type:none` ("Bez typu"), `brand:<id>` / `brand:none` ("Bez marki"), `level:<level>` / `level:none` ("Inne"), `all` ("Wszystkie"). Location columns use `short` as the label and `venue` as the sublabel (null when venue equals short). `Column.sessions` is in layout (data) order; the grid engine sorts by start.
  - List group keys: `allday` ("Całodniowe"), `slot:<index>` (label `09:30` or `09:30–09:40` when the cluster has several starts), `hour:<h>` (label `10:00–11:00`), `notime` ("Bez godziny", `parallel` 0). Rows inside a group are sorted by start then title with Polish collation; "Bez godziny" keeps data order.

- [ ] **Step 1: Write the failing derive test**

`src/state/derive.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Location, Session, Term } from "../data/types";
import { EMPTY_FILTERS, buildSearchIndex, type Filters } from "../domain/filters";
import { buildIndex } from "../domain/lookup";
import { makeData, makeLocation, makeSession } from "../test/fixtures/build";
import { buildColumns, daySets, listGroups, resolveTimeMode, type DaySets } from "./derive";
import type { Settings } from "./store";

const SETTINGS: Settings = {
  columnAxis: "location",
  timeMode: "auto",
  slotTolerance: 15,
  zoom: 2,
  density: "comfortable",
  colorBy: "type",
  showAvatars: true,
  allDayStrip: true,
  planLayout: "list",
  theme: "system",
};

const LOCATIONS: Location[] = [
  makeLocation({ id: 308, slug: "stoiska-wystawcow-poziom-i-plenum", name: "Stoiska wystawców - poziom I (PLENUM)", count: 1, venue: "Stoiska wystawców", level: "I", room: "PLENUM", short: "Stoiska · Plenum", order: 0 }),
  makeLocation({ id: 233, slug: "so-salsa-1", name: "So Salsa - poziom II - Sala wykładowa nr 1", count: 1, venue: "So Salsa", level: "II", room: "Sala wykładowa nr 1", short: "Sala wykł. 1", order: 1 }),
  makeLocation({ id: 281, slug: "so-salsa-1-2", name: "SoSalsa - poziom II - Sala wykładowa nr 2", count: 1, venue: "SoSalsa", level: "II", room: "Sala wykładowa nr 2", short: "Sala wykł. 2", order: 2 }),
  makeLocation({ id: 318, slug: "rejestracja", name: "Rejestracja", count: 1, venue: "Rejestracja", level: null, room: null, short: "Rejestracja", order: 3 }),
];

const A = makeSession({ id: "1:pt", eventId: 1, title: "Światło w studio", start: 570, end: 630, locationIds: [233] });
const B = makeSession({ id: "2:pt", eventId: 2, title: "Portret", start: 585, end: 645, locationIds: [281] });
const C = makeSession({ id: "3:pt", eventId: 3, title: "Bez czasu", start: null, end: null, timeText: "", locationIds: [233] });
const D = makeSession({ id: "4:pt", eventId: 4, title: "Strefa sprzętu", start: 540, end: 1080, allDay: true, typeIds: [242], locationIds: [318] });
const E = makeSession({ id: "5:sob", eventId: 5, day: "sob", title: "Sobotnia", start: 600, end: 660, locationIds: [233] });

const ids = (list: Session[]) => list.map((s) => s.id);

interface SetsOverrides {
  dayId?: string;
  filters?: Partial<Filters>;
  settings?: Partial<Settings>;
  planSet?: string[];
  planView?: boolean;
}

function setsFor(sessions: Session[], over: SetsOverrides = {}, dataOverrides: Partial<Parameters<typeof makeData>[1]> = {}): DaySets {
  const data = makeData(sessions, { locations: LOCATIONS, ...dataOverrides });
  const index = buildIndex(data);
  const search = buildSearchIndex(data, index);
  return daySets({
    data,
    index,
    search,
    dayId: over.dayId ?? "pt",
    filters: { ...EMPTY_FILTERS, ...over.filters },
    settings: { ...SETTINGS, ...over.settings },
    planSet: new Set(over.planSet ?? []),
    planView: over.planView ?? false,
  });
}

describe("daySets", () => {
  const day = [A, B, C, D, E];

  it("splits the day into layout, visible, rendered and the two strips", () => {
    const s = setsFor(day);
    expect(ids(s.all)).toEqual(["1:pt", "2:pt", "3:pt", "4:pt"]);
    expect(ids(s.layout)).toEqual(["1:pt", "2:pt"]);
    expect(ids(s.visible)).toEqual(["1:pt", "2:pt", "3:pt", "4:pt"]);
    expect(ids(s.rendered)).toEqual(["1:pt", "2:pt"]);
    expect([...s.renderedIds]).toEqual(["1:pt", "2:pt"]);
    expect(ids(s.stripAllDay)).toEqual(["4:pt"]);
    expect(ids(s.stripNoTime)).toEqual(["3:pt"]);
  });

  it("moves all-day sessions into the layout set when the strip is off", () => {
    const s = setsFor(day, { settings: { allDayStrip: false } });
    expect(ids(s.layout)).toEqual(["1:pt", "2:pt", "4:pt"]);
    expect(ids(s.rendered)).toEqual(["1:pt", "2:pt", "4:pt"]);
    expect(s.stripAllDay).toEqual([]);
  });

  it("hideAllDay removes all-day sessions from every set", () => {
    const s = setsFor(day, { filters: { hideAllDay: true } });
    expect(ids(s.layout)).toEqual(["1:pt", "2:pt"]);
    expect(ids(s.visible)).toEqual(["1:pt", "2:pt", "3:pt"]);
    expect(s.stripAllDay).toEqual([]);
  });

  it("the query narrows visible and rendered but never the layout set", () => {
    const s = setsFor(day, { filters: { query: "swiatlo" } });
    expect(ids(s.layout)).toEqual(["1:pt", "2:pt"]);
    expect(ids(s.visible)).toEqual(["1:pt"]);
    expect(ids(s.rendered)).toEqual(["1:pt"]);
    expect(s.stripAllDay).toEqual([]);
    expect(s.stripNoTime).toEqual([]);
  });

  it("onlyFavourites narrows visible against the plan set and leaves the layout set alone", () => {
    const s = setsFor(day, { filters: { onlyFavourites: true }, planSet: ["2:pt"] });
    expect(ids(s.layout)).toEqual(["1:pt", "2:pt"]);
    expect(ids(s.visible)).toEqual(["2:pt"]);
    expect(ids(s.rendered)).toEqual(["2:pt"]);
  });

  it("facets narrow the layout set", () => {
    const s = setsFor(day, { filters: { locations: [281] } });
    expect(ids(s.layout)).toEqual(["2:pt"]);
    expect(ids(s.visible)).toEqual(["2:pt"]);
  });

  it("the plan view restricts every set to the plan set first", () => {
    const s = setsFor(day, { planView: true, planSet: ["1:pt", "3:pt", "5:sob"] });
    expect(ids(s.all)).toEqual(["1:pt", "3:pt"]);
    expect(ids(s.layout)).toEqual(["1:pt"]);
    expect(ids(s.visible)).toEqual(["1:pt", "3:pt"]);
    expect(ids(s.stripNoTime)).toEqual(["3:pt"]);
    expect(s.stripAllDay).toEqual([]);
  });

  it("a facet that leaves only strip sessions gives an empty rendered set while the strip keeps them", () => {
    const s = setsFor(day, { filters: { locations: [318] } });
    expect(s.layout).toEqual([]);
    expect(ids(s.visible)).toEqual(["4:pt"]);
    expect(s.rendered).toEqual([]);
    expect(ids(s.stripAllDay)).toEqual(["4:pt"]);
    const data = makeData(day, { locations: LOCATIONS });
    expect(buildColumns(s, "location", data, buildIndex(data))).toEqual([]);
  });

  it("an unknown day yields empty sets", () => {
    const s = setsFor(day, { dayId: "nd" });
    expect(s.all).toEqual([]);
    expect(s.layout).toEqual([]);
    expect(s.visible).toEqual([]);
  });
});

describe("buildColumns by location", () => {
  const F = makeSession({ id: "6:pt", eventId: 6, title: "Makro", start: 700, end: 760, locationIds: [233, 308] });
  const sessions = [A, B, F];
  const data = makeData(sessions, { locations: LOCATIONS });
  const index = buildIndex(data);

  it("orders columns by Location.order, labels with short and venue, and repeats multi-location sessions", () => {
    const columns = buildColumns(setsFor(sessions), "location", data, index);
    expect(columns.map((c) => c.key)).toEqual(["loc:308", "loc:233", "loc:281"]);
    expect(columns.map((c) => c.label)).toEqual(["Stoiska · Plenum", "Sala wykł. 1", "Sala wykł. 2"]);
    expect(columns.map((c) => c.sublabel)).toEqual(["Stoiska wystawców", "So Salsa", "SoSalsa"]);
    expect(columns.map((c) => ids(c.sessions))).toEqual([["6:pt"], ["1:pt", "6:pt"], ["2:pt"]]);
    expect(columns.map((c) => c.count)).toEqual([1, 2, 1]);
  });

  it("a search keeps every layout session in the column but drops columns without rendered sessions", () => {
    const columns = buildColumns(setsFor(sessions, { filters: { query: "makro" } }), "location", data, index);
    expect(columns.map((c) => c.key)).toEqual(["loc:308", "loc:233"]);
    const sala1 = columns[1];
    expect(sala1 && ids(sala1.sessions)).toEqual(["1:pt", "6:pt"]);
    expect(sala1 && [...sala1.renderedIds]).toEqual(["6:pt"]);
    expect(sala1?.count).toBe(1);
  });

  it("omits the venue sublabel when it equals the short label", () => {
    const R = makeSession({ id: "7:pt", eventId: 7, title: "Odbiór akredytacji", start: 540, end: 600, locationIds: [318] });
    const d = makeData([R], { locations: LOCATIONS });
    const columns = buildColumns(setsFor([R]), "location", d, buildIndex(d));
    expect(columns).toHaveLength(1);
    expect(columns[0]?.label).toBe("Rejestracja");
    expect(columns[0]?.sublabel).toBeNull();
  });
});

describe("buildColumns by type", () => {
  const TYPES: Term[] = [
    { id: 184, slug: "prelekcja", name: "Prelekcja", count: 1 },
    { id: 278, slug: "prelekcja-z-sesja", name: "Prelekcja z sesją", count: 1 },
    { id: 5, slug: "warsztaty", name: "Warsztaty", count: 1 },
    { id: 242, slug: "ogolne", name: "Ogólne", count: 1 },
    { id: 900, slug: "dyskusja", name: "Dyskusja", count: 1 },
    { id: 901, slug: "cwiczenia", name: "Ćwiczenia", count: 1 },
  ];
  const t1 = makeSession({ id: "1:pt", eventId: 1, title: "Punkt info", typeIds: [242] });
  const t2 = makeSession({ id: "2:pt", eventId: 2, title: "Warsztat", typeIds: [5] });
  const t3 = makeSession({ id: "3:pt", eventId: 3, title: "Wykład z warsztatem", typeIds: [5, 184] });
  const t4 = makeSession({ id: "4:pt", eventId: 4, title: "Panel", typeIds: [900] });
  const t5 = makeSession({ id: "5:pt", eventId: 5, title: "Trening", typeIds: [901] });
  const t6 = makeSession({ id: "6:pt", eventId: 6, title: "Bez typu", typeIds: [] });
  const sessions = [t1, t2, t3, t4, t5, t6];
  const data = makeData(sessions, { locations: LOCATIONS, types: TYPES });
  const index = buildIndex(data);

  it("groups by primary type in priority order, then Polish collation, with a trailing Bez typu", () => {
    const columns = buildColumns(setsFor(sessions, {}, { types: TYPES }), "type", data, index);
    expect(columns.map((c) => c.key)).toEqual(["type:184", "type:5", "type:242", "type:901", "type:900", "type:none"]);
    expect(columns.map((c) => c.label)).toEqual(["Prelekcja", "Warsztaty", "Ogólne", "Ćwiczenia", "Dyskusja", "Bez typu"]);
    expect(columns.map((c) => ids(c.sessions))).toEqual([["3:pt"], ["2:pt"], ["1:pt"], ["5:pt"], ["4:pt"], ["6:pt"]]);
    expect(columns.every((c) => c.sublabel === null)).toBe(true);
  });
});

describe("buildColumns by brand", () => {
  const BRANDS: Term[] = [
    { id: 10, slug: "canon", name: "Canon", count: 1 },
    { id: 12, slug: "nikon", name: "Nikon", count: 1 },
    { id: 11, slug: "sony", name: "Sony", count: 1 },
  ];
  const b1 = makeSession({ id: "1:pt", eventId: 1, title: "Sony show", brandIds: [11] });
  const b2 = makeSession({ id: "2:pt", eventId: 2, title: "Canon i Sony", brandIds: [10, 11] });
  const b3 = makeSession({ id: "3:pt", eventId: 3, title: "Niezależna", brandIds: [] });
  const b4 = makeSession({ id: "4:pt", eventId: 4, title: "Nikon show", brandIds: [12] });
  const sessions = [b1, b2, b3, b4];
  const data = makeData(sessions, { locations: LOCATIONS, brands: BRANDS });
  const index = buildIndex(data);

  it("uses the first brand, brands array order and a trailing Bez marki", () => {
    const columns = buildColumns(setsFor(sessions, {}, { brands: BRANDS }), "brand", data, index);
    expect(columns.map((c) => c.key)).toEqual(["brand:10", "brand:12", "brand:11", "brand:none"]);
    expect(columns.map((c) => c.label)).toEqual(["Canon", "Nikon", "Sony", "Bez marki"]);
    expect(columns.map((c) => ids(c.sessions))).toEqual([["2:pt"], ["4:pt"], ["1:pt"], ["3:pt"]]);
  });
});

describe("buildColumns by level", () => {
  const LEVEL_LOCATIONS: Location[] = [
    makeLocation({ id: 282, slug: "drizzly-grizzly", name: "Drizzly Grizzly - poziom 0 - Sala wykładowa nr 3", count: 1, venue: "Drizzly Grizzly", level: "0", room: "Sala wykładowa nr 3", short: "Sala wykł. 3", order: 0 }),
    makeLocation({ id: 308, slug: "stoiska-wystawcow-poziom-i-plenum", name: "Stoiska wystawców - poziom I (PLENUM)", count: 1, venue: "Stoiska wystawców", level: "I", room: "PLENUM", short: "Stoiska · Plenum", order: 1 }),
    makeLocation({ id: 307, slug: "stoiska-wystawcow-poziom-i-plenum-i-poziom-ii-sosalsa", name: "Stoiska wystawców - poziom I (PLENUM) i poziom II (SOSALSA)", count: 1, venue: "Stoiska wystawców", level: "I+II", room: "PLENUM · SOSALSA", short: "Stoiska · Plenum i SoSalsa", order: 2 }),
    makeLocation({ id: 233, slug: "so-salsa-1", name: "So Salsa - poziom II - Sala wykładowa nr 1", count: 1, venue: "So Salsa", level: "II", room: "Sala wykładowa nr 1", short: "Sala wykł. 1", order: 3 }),
    makeLocation({ id: 999, slug: "dach", name: "Dach - poziom III", count: 1, venue: "Dach", level: "III", room: null, short: "Dach III", order: 4 }),
    makeLocation({ id: 318, slug: "rejestracja", name: "Rejestracja", count: 1, venue: "Rejestracja", level: null, room: null, short: "Rejestracja", order: 5 }),
  ];
  const l1 = makeSession({ id: "1:pt", eventId: 1, title: "Zero", locationIds: [282] });
  const l2 = makeSession({ id: "2:pt", eventId: 2, title: "Jeden", locationIds: [308] });
  const l3 = makeSession({ id: "3:pt", eventId: 3, title: "Jeden i dwa", locationIds: [307] });
  const l4 = makeSession({ id: "4:pt", eventId: 4, title: "Dwa poziomy", locationIds: [233, 308] });
  const l5 = makeSession({ id: "5:pt", eventId: 5, title: "Trzy", locationIds: [999] });
  const l6 = makeSession({ id: "6:pt", eventId: 6, title: "Bez poziomu", locationIds: [318] });
  const l7 = makeSession({ id: "7:pt", eventId: 7, title: "Bez miejsca", locationIds: [] });
  const sessions = [l1, l2, l3, l4, l5, l6, l7];
  const data = makeData(sessions, { locations: LEVEL_LOCATIONS });
  const index = buildIndex(data);

  it("labels every level in order sequence and repeats sessions spanning several levels", () => {
    const columns = buildColumns(setsFor(sessions, {}, { locations: LEVEL_LOCATIONS }), "level", data, index);
    expect(columns.map((c) => c.key)).toEqual(["level:0", "level:I", "level:I+II", "level:II", "level:III", "level:none"]);
    expect(columns.map((c) => c.label)).toEqual(["Poziom 0", "Poziom I", "Poziom I i II", "Poziom II", "Poziom III", "Inne"]);
    expect(columns.map((c) => ids(c.sessions))).toEqual([["1:pt"], ["2:pt", "4:pt"], ["3:pt"], ["4:pt"], ["5:pt"], ["6:pt", "7:pt"]]);
  });
});

describe("buildColumns with no axis", () => {
  const sessions = [A, B];
  const data = makeData(sessions, { locations: LOCATIONS });
  const index = buildIndex(data);

  it("returns one Wszystkie column holding every layout session", () => {
    const columns = buildColumns(setsFor(sessions), "none", data, index);
    expect(columns).toHaveLength(1);
    expect(columns[0]).toMatchObject({ key: "all", label: "Wszystkie", sublabel: null, count: 2 });
    expect(columns[0] && ids(columns[0].sessions)).toEqual(["1:pt", "2:pt"]);
  });

  it("returns no column when nothing is rendered", () => {
    const columns = buildColumns(setsFor(sessions, { filters: { query: "brak takiego" } }), "none", data, index);
    expect(columns).toEqual([]);
  });
});

const S1 = makeSession({ id: "11:pt", eventId: 11, title: "Pierwsza", start: 570, end: 645, locationIds: [233] });
const S2 = makeSession({ id: "12:pt", eventId: 12, title: "Druga", start: 615, end: 690, locationIds: [281] });
const S3 = makeSession({ id: "13:pt", eventId: 13, title: "Trzecia", start: 660, end: 735, locationIds: [308] });
const STAGGERED = [S1, S2, S3];

const R1 = makeSession({ id: "21:pt", eventId: 21, title: "Rano A", start: 570, end: 630, locationIds: [233] });
const R2 = makeSession({ id: "22:pt", eventId: 22, title: "Rano B", start: 570, end: 630, locationIds: [281] });
const R3 = makeSession({ id: "23:pt", eventId: 23, title: "Unikat", start: 645, end: 705, locationIds: [233] });
const R4 = makeSession({ id: "24:pt", eventId: 24, title: "Później B", start: 645, end: 705, locationIds: [281] });
const REGULAR = [R1, R2, R3, R4];

describe("resolveTimeMode", () => {
  it("auto resolves to timeline when the layout set is not distinguishable and forced modes win", () => {
    const layout = setsFor(STAGGERED).layout;
    const auto = resolveTimeMode(SETTINGS, layout);
    expect(auto.mode).toBe("timeline");
    expect(auto.auto).toBe(true);
    expect(auto.slots.map((s) => s.start)).toEqual([570, 615, 660]);
    expect(auto.regularity.distinguishable).toBe(false);

    const forced = resolveTimeMode({ ...SETTINGS, timeMode: "slots" }, layout);
    expect(forced.mode).toBe("slots");
    expect(forced.auto).toBe(false);
    expect(forced.slots).toHaveLength(3);

    expect(resolveTimeMode({ ...SETTINGS, timeMode: "timeline" }, layout).mode).toBe("timeline");
  });

  it("auto resolves to slots for a regular, shared layout set", () => {
    const resolved = resolveTimeMode(SETTINGS, setsFor(REGULAR).layout);
    expect(resolved.mode).toBe("slots");
    expect(resolved.auto).toBe(true);
    expect(resolved.slots.map((s) => s.start)).toEqual([570, 645]);
    expect(resolved.regularity).toEqual({ medianGap: 75, sharedRatio: 1, distinguishable: true });
  });

  it("an empty layout set gives no slots and the timeline", () => {
    const resolved = resolveTimeMode(SETTINGS, []);
    expect(resolved.slots).toEqual([]);
    expect(resolved.mode).toBe("timeline");
  });
});

describe("listGroups", () => {
  const C2 = makeSession({ id: "8:pt", eventId: 8, title: "Makro", start: 615, end: 660, locationIds: [308] });
  const P = makeSession({ id: "9:pt", eventId: 9, title: "Wyniki", start: 810, end: null, timeText: "13:30", locationIds: [233] });
  const day = [A, B, C, D, C2, P];

  it("in timeline mode buckets rows by hour with Całodniowe first and Bez godziny last", () => {
    const sets = setsFor(day, { settings: { timeMode: "timeline" } });
    const groups = listGroups(sets, resolveTimeMode({ ...SETTINGS, timeMode: "timeline" }, sets.layout), SETTINGS);
    expect(groups.map((g) => [g.key, g.label, ids(g.sessions), g.total, g.parallel])).toEqual([
      ["allday", "Całodniowe", ["4:pt"], 1, 1],
      ["hour:9", "09:00–10:00", ["1:pt", "2:pt"], 2, 2],
      ["hour:10", "10:00–11:00", ["8:pt"], 1, 1],
      ["hour:13", "13:00–14:00", ["9:pt"], 1, 1],
      ["notime", "Bez godziny", ["3:pt"], 1, 0],
    ]);
  });

  it("with the strip off, all-day sessions sit in their start group", () => {
    const settings: Settings = { ...SETTINGS, timeMode: "timeline", allDayStrip: false };
    const sets = setsFor(day, { settings });
    const groups = listGroups(sets, resolveTimeMode(settings, sets.layout), settings);
    expect(groups.map((g) => g.key)).toEqual(["hour:9", "hour:10", "hour:13", "notime"]);
    expect(groups[0] && ids(groups[0].sessions)).toEqual(["4:pt", "1:pt", "2:pt"]);
    expect(groups[0]?.parallel).toBe(3);
  });

  it("in forced slot mode the groups are the detected slots", () => {
    const settings: Settings = { ...SETTINGS, timeMode: "slots" };
    const sets = setsFor(STAGGERED, { settings });
    const groups = listGroups(sets, resolveTimeMode(settings, sets.layout), settings);
    expect(groups.map((g) => [g.key, g.label, ids(g.sessions), g.total, g.parallel])).toEqual([
      ["slot:0", "09:30", ["11:pt"], 1, 1],
      ["slot:1", "10:15", ["12:pt"], 1, 1],
      ["slot:2", "11:00", ["13:pt"], 1, 1],
    ]);
  });

  it("labels a slot with several starts as a range", () => {
    const X1 = makeSession({ id: "31:pt", eventId: 31, title: "Start 09:30", start: 570, end: 630, locationIds: [233] });
    const X2 = makeSession({ id: "32:pt", eventId: 32, title: "Start 09:40", start: 580, end: 640, locationIds: [281] });
    const settings: Settings = { ...SETTINGS, timeMode: "slots" };
    const sets = setsFor([X1, X2], { settings });
    const groups = listGroups(sets, resolveTimeMode(settings, sets.layout), settings);
    expect(groups.map((g) => [g.key, g.label, g.total, g.parallel])).toEqual([["slot:0", "09:30–09:40", 2, 2]]);
  });

  it("a search omits groups without visible rows but keeps the slot rows of the layout set", () => {
    const sets = setsFor(REGULAR, { filters: { query: "unikat" } });
    const resolved = resolveTimeMode(SETTINGS, sets.layout);
    expect(resolved.mode).toBe("slots");
    expect(resolved.slots).toHaveLength(2);
    const groups = listGroups(sets, resolved, SETTINGS);
    expect(groups.map((g) => [g.key, g.label, ids(g.sessions)])).toEqual([["slot:1", "10:45", ["23:pt"]]]);
  });
});
```

- [ ] **Step 2: Run the derive test to verify it fails**

Run: `npx vitest run src/state/derive.test.ts`
Expected: fails with `Failed to resolve import "./derive"`.

- [ ] **Step 3: Write `src/state/derive.ts`**

```ts
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
```

- [ ] **Step 4: Run the derive tests to verify they pass**

Run: `npx vitest run src/state/derive.test.ts`
Expected: 25 tests pass.

Run: `npm run typecheck`
Expected: no errors.

Run: `npm test`
Expected: the whole suite is green.

- [ ] **Step 5: Commit**

```bash
git add src/state/derive.ts src/state/derive.test.ts
git commit -m "feat(state): derive layout, visible and rendered sets, columns and list groups

daySets builds the spec 7.2 session sets (plan-restricted in the plan
view), buildColumns covers the five axes with their labels and ordering,
resolveTimeMode applies auto/forced modes and listGroups produces slot or
hourly groups with Całodniowe first and Bez godziny last.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```


### Task 22: UI primitives (`src/components/ui/*`)

**Files:**
- Create: `src/state/useMediaQuery.ts` (needed here by `CopySheet`; consumed again by Task 23)
- Create: `src/components/ui/cx.ts` (internal class-name joiner)
- Create: `src/components/ui/focus.ts` (internal focus trap / restore hook shared by `Sheet` and `Popover`)
- Create: `src/components/ui/Burst.tsx` (internal orange burst glyph, used by `EmptyState` and Task 23's `TopBar`)
- Create: `src/components/ui/Sheet.tsx`, `src/components/ui/Sheet.module.css`
- Create: `src/components/ui/Popover.tsx`, `src/components/ui/Popover.module.css`
- Create: `src/components/ui/Chip.tsx`, `src/components/ui/Chip.module.css`
- Create: `src/components/ui/Avatar.tsx`, `src/components/ui/Avatar.module.css`
- Create: `src/components/ui/Segmented.tsx`, `src/components/ui/Segmented.module.css`
- Create: `src/components/ui/Slider.tsx`, `src/components/ui/Slider.module.css`
- Create: `src/components/ui/Toggle.tsx`, `src/components/ui/Toggle.module.css`
- Create: `src/components/ui/EmptyState.tsx`, `src/components/ui/EmptyState.module.css`
- Create: `src/components/ui/CopySheet.tsx`, `src/components/ui/CopySheet.module.css`
- Create: `src/components/ui/Star.tsx`, `src/components/ui/Star.module.css`
- Modify: `src/styles/tokens.css` (replace with the complete spec §8 token set below; every component in this task and Task 23 uses these names)
- Modify: `src/styles/base.css` (replace with the complete file below; it supersedes the Task 1 version)
- Test: `src/test/ui.test.tsx`

**Interfaces:**
- Consumes: `useStore` (`copyText`, `openSheet`, `setSheet`, `setCopyText`) from `src/state/store.ts`; `lucide-react` icons `X`, `Star`.
- Produces (contract props, all named exports):
  - `Sheet({ open: boolean; side: "left" | "right" | "bottom"; title: string; onClose(): void; children: ReactNode; labelledBy?: string })` — `role="dialog"`, `aria-modal="true"`, focus trap, Escape / backdrop / close-button close, focus restore; the backdrop carries `data-sheet-backdrop` and the root carries `data-side`. `left` is a 320 px panel anchored to the left edge (the medium tier's filters sheet), `right` a 420 px panel on the right edge, `bottom` a 90 % tall panel rising from the bottom edge; focus and close behaviour are identical for all three.
  - `Popover({ open: boolean; anchorRef: RefObject<HTMLElement | null>; onClose(): void; children: ReactNode; title: string })` — positioned under the anchor, closes on Escape, outside mousedown and focus leaving.
  - `Chip({ children: ReactNode; onRemove?(): void; tone?: "default" | "accent" })` — remove button labelled `Usuń filtr: <text>`.
  - `Avatar({ name: string; src: string | null; size?: number; hue?: number })` — `role="img"` wrapper, `img` with `onError` → initials fallback.
  - `Segmented<T extends string>({ value: T; options: { value: T; label: string; hint?: string }[]; onChange(v: T): void; ariaLabel: string })` — `role="radiogroup"` of `role="radio"` buttons.
  - `Slider({ value; min; max; step; onChange(v: number): void; label: string; format?(v: number): string })` — `input[type=range]` with a visible `<output>`.
  - `Toggle({ checked: boolean; onChange(v: boolean): void; label: string; hint?: string })` — `role="switch"` button.
  - `EmptyState({ title: string; text?: string; actions?: ReactNode; illustration?: boolean })`.
  - `CopySheet()` — reads `store.copyText`; `Sheet` titled "Skopiuj ręcznie" with a read-only, auto-selected textarea.
  - `Star({ pressed: boolean; onToggle(): void; size?: number })` — `<button aria-pressed aria-label="Do planu">`.
  - Internal helpers (exported, used only inside `src/components`): `cx()`, `focusables()`, `useDialogFocus()`, `Burst`, `initials()`.
  - `src/state/useMediaQuery.ts`: `useMediaQuery(query: string): boolean`, `useTier(): "wide" | "medium" | "mobile"`, `matchesMedia(query): boolean`, `prefersReducedMotion(): boolean`, `MOBILE_QUERY`, `WIDE_QUERY`, `COARSE_QUERY`.

Steps:

- [ ] 1. Write the failing test file `src/test/ui.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { useRef, useState } from "react";
import { fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet } from "../components/ui/Sheet";
import { Popover } from "../components/ui/Popover";
import { Chip } from "../components/ui/Chip";
import { Avatar, initials } from "../components/ui/Avatar";
import { Segmented } from "../components/ui/Segmented";
import { Slider } from "../components/ui/Slider";
import { Toggle } from "../components/ui/Toggle";
import { EmptyState } from "../components/ui/EmptyState";
import { CopySheet } from "../components/ui/CopySheet";
import { Star } from "../components/ui/Star";
import { useMediaQuery, useTier } from "../state/useMediaQuery";
import { useStore } from "../state/store";

function active(): Element | null {
  return document.activeElement;
}

function pressTab(shift = false): void {
  fireEvent.keyDown(active() ?? document.body, { key: "Tab", shiftKey: shift });
}

function SheetHarness({ side = "right" }: { side?: "left" | "right" | "bottom" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Otwórz
      </button>
      <Sheet open={open} side={side} title="Szczegóły" onClose={() => setOpen(false)}>
        <button type="button">Pierwszy</button>
        <button type="button">Drugi</button>
      </Sheet>
    </>
  );
}

describe("Sheet", () => {
  it("renders a modal dialog named by its title and moves focus inside it", async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    await user.click(screen.getByRole("button", { name: "Otwórz" }));
    const dialog = screen.getByRole("dialog", { name: "Szczegóły" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.contains(active())).toBe(true);
  });

  it("traps Tab and Shift+Tab inside the panel", async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    await user.click(screen.getByRole("button", { name: "Otwórz" }));
    const dialog = screen.getByRole("dialog", { name: "Szczegóły" });
    const close = within(dialog).getByRole("button", { name: "Zamknij" });
    const first = within(dialog).getByRole("button", { name: "Pierwszy" });
    const second = within(dialog).getByRole("button", { name: "Drugi" });
    pressTab();
    expect(active()).toBe(close);
    pressTab();
    expect(active()).toBe(first);
    pressTab();
    expect(active()).toBe(second);
    pressTab();
    expect(active()).toBe(close);
    pressTab(true);
    expect(active()).toBe(second);
  });

  it("closes on Escape and restores focus to the opener", async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    const opener = screen.getByRole("button", { name: "Otwórz" });
    await user.click(opener);
    screen.getByRole("dialog", { name: "Szczegóły" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(active()).toBe(opener);
  });

  it("closes on backdrop click and on the close button", async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    await user.click(screen.getByRole("button", { name: "Otwórz" }));
    const backdrop = document.querySelector("[data-sheet-backdrop]");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Otwórz" }));
    await user.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("marks the bottom variant on its root", async () => {
    const user = userEvent.setup();
    render(<SheetHarness side="bottom" />);
    await user.click(screen.getByRole("button", { name: "Otwórz" }));
    expect(document.querySelector('[data-side="bottom"]')).not.toBeNull();
  });

  it("renders a left-side sheet with the left class", async () => {
    const user = userEvent.setup();
    render(<SheetHarness side="left" />);
    await user.click(screen.getByRole("button", { name: "Otwórz" }));
    const root = document.querySelector('[data-side="left"]');
    expect(root).not.toBeNull();
    const dialog = screen.getByRole("dialog", { name: "Szczegóły" });
    expect((root as Element).contains(dialog)).toBe(true);
    expect(dialog.contains(active())).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

function PopoverHarness() {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button ref={anchor} type="button" onClick={() => setOpen((o) => !o)}>
        Widok
      </button>
      <Popover open={open} anchorRef={anchor} onClose={() => setOpen(false)} title="Ustawienia">
        <button type="button">Opcja</button>
      </Popover>
    </>
  );
}

describe("Popover", () => {
  it("opens as a dialog named by its title and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<PopoverHarness />);
    await user.click(screen.getByRole("button", { name: "Widok" }));
    screen.getByRole("dialog", { name: "Ustawienia" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(active()).toBe(screen.getByRole("button", { name: "Widok" }));
  });

  it("closes on an outside mousedown but not on one inside", async () => {
    const user = userEvent.setup();
    render(<PopoverHarness />);
    await user.click(screen.getByRole("button", { name: "Widok" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Opcja" }));
    expect(screen.queryByRole("dialog")).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Star", () => {
  it("is a toggle button named Do planu that reports aria-pressed", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(<Star pressed={false} onToggle={onToggle} />);
    const star = screen.getByRole("button", { name: "Do planu" });
    expect(star.getAttribute("aria-pressed")).toBe("false");
    await user.click(star);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<Star pressed={true} onToggle={onToggle} />);
    expect(screen.getByRole("button", { name: "Do planu" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("Avatar", () => {
  it("computes initials from the first and last word", () => {
    expect(initials("Emil Biliński")).toBe("EB");
    expect(initials("Madonna")).toBe("M");
    expect(initials("  ")).toBe("?");
  });

  it("falls back to initials when the image fails to load", () => {
    const { container } = render(<Avatar name="Emil Biliński" src="https://example.invalid/emil.jpg" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(screen.queryByText("EB")).toBeNull();
    fireEvent.error(img as Element);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("EB")).not.toBeNull();
    expect(screen.getByRole("img", { name: "Emil Biliński" })).not.toBeNull();
  });

  it("renders initials directly when there is no photo", () => {
    render(<Avatar name="Karol Bartnik" src={null} hue={120} />);
    expect(screen.getByText("KB")).not.toBeNull();
  });
});

describe("Chip", () => {
  it("renders a remove button labelled with the chip text", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<Chip onRemove={onRemove}>Prelekcja</Chip>);
    await user.click(screen.getByRole("button", { name: "Usuń filtr: Prelekcja" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("has no button without onRemove", () => {
    render(<Chip tone="accent">Tylko ulubione</Chip>);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Tylko ulubione")).not.toBeNull();
  });
});

describe("Segmented", () => {
  it("is a radiogroup whose arrow keys move the selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Segmented
        value="grid"
        options={[
          { value: "grid", label: "Siatka" },
          { value: "list", label: "Lista" },
        ]}
        onChange={onChange}
        ariaLabel="Układ"
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Układ" });
    const grid = within(group).getByRole("radio", { name: "Siatka" });
    expect(grid.getAttribute("aria-checked")).toBe("true");
    grid.focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("list");
    await user.click(within(group).getByRole("radio", { name: "Lista" }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe("Slider", () => {
  it("shows the formatted value and reports numeric changes", () => {
    const onChange = vi.fn();
    render(<Slider value={15} min={5} max={45} step={5} onChange={onChange} label="Tolerancja" format={(v) => `${v} min`} />);
    expect(screen.getByText("15 min")).not.toBeNull();
    const input = screen.getByRole("slider", { name: "Tolerancja" });
    fireEvent.change(input, { target: { value: "20" } });
    expect(onChange).toHaveBeenCalledWith(20);
  });
});

describe("Toggle", () => {
  it("is a switch that reports the flipped value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Tylko ulubione" hint="Pokazuje tylko plan" />);
    const sw = screen.getByRole("switch", { name: "Tylko ulubione" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    await user.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("EmptyState", () => {
  it("renders title, text and actions", () => {
    render(
      <EmptyState title="Brak wydarzeń dla tych filtrów" text="Spróbuj inne" actions={<button type="button">Wyczyść filtry</button>} illustration />,
    );
    expect(screen.getByRole("status")).not.toBeNull();
    expect(screen.getByText("Brak wydarzeń dla tych filtrów")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Wyczyść filtry" })).not.toBeNull();
  });
});

describe("CopySheet", () => {
  afterEach(() => {
    useStore.setState({ openSheet: null, copyText: null });
  });

  it("shows the copy text in a read-only, pre-selected textarea and clears it on close", async () => {
    const user = userEvent.setup();
    const text = "Piątek, 4 września\n09:30–10:30 · Sesja · Sala wykł. 1";
    useStore.setState({ openSheet: "copy", copyText: text });
    render(<CopySheet />);
    screen.getByRole("dialog", { name: "Skopiuj ręcznie" });
    const textarea = screen.getByRole("textbox", { name: "Tekst do skopiowania" }) as HTMLTextAreaElement;
    expect(textarea.readOnly).toBe(true);
    expect(textarea.value).toBe(text);
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(text.length);
    await user.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(useStore.getState().openSheet).toBeNull();
    expect(useStore.getState().copyText).toBeNull();
  });

  it("renders nothing while no copy text is pending", () => {
    useStore.setState({ openSheet: null, copyText: null });
    render(<CopySheet />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("useMediaQuery", () => {
  it("reads matchMedia and resolves the tier", () => {
    const original = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query === "(min-width: 1100px)",
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    try {
      const wide = renderHook(() => useMediaQuery("(min-width: 1100px)"));
      expect(wide.result.current).toBe(true);
      const tier = renderHook(() => useTier());
      expect(tier.result.current).toBe("wide");
    } finally {
      Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: original });
    }
  });
});
```

- [ ] 2. Run `npx vitest run src/test/ui.test.tsx` and confirm it fails with `Error: Failed to resolve import "../components/ui/Sheet" from "src/test/ui.test.tsx"`.

- [ ] 3. Replace `src/styles/tokens.css` with the complete token set (spec §8):

```css
:root {
  color-scheme: dark;

  --bg: oklch(14% 0.01 60);
  --surface-1: oklch(19% 0.012 60);
  --surface-2: oklch(24% 0.014 60);
  --surface-glass: oklch(19% 0.012 60 / 0.82);
  --border: oklch(32% 0.02 60);
  --text: oklch(96% 0.01 80);
  --text-muted: oklch(72% 0.02 80);
  --accent: oklch(70% 0.2 45);
  --accent-hover: oklch(76% 0.2 45);
  --on-accent: oklch(14% 0.02 45);
  --success: oklch(75% 0.17 150);
  --danger: oklch(68% 0.2 25);
  --warning: oklch(80% 0.16 85);

  /* type / location / brand hues: lightness and chroma per spec §8 */
  --hue-l: 72%;
  --hue-c: 0.16;
  --chroma-neutral: 0;
  --hue-prelekcja: 45;
  --hue-prelekcja-z-sesja: 25;
  --hue-warsztaty: 340;
  --hue-fotospacer: 95;
  --hue-fotogra: 95;
  --hue-playground: 175;
  --hue-strefa-sprzetu: 240;
  --hue-teleobiektywy: 260;
  --hue-ogolne: 0;
  --hue-other: 300;

  --text-base: 15px;
  --text-card: 13px;
  --text-min: 12px;

  --radius-card: 8px;
  --radius-sheet: 12px;
  --radius-chip: 999px;

  --shadow-1: 0 1px 2px oklch(0% 0 0 / 0.4), 0 4px 12px oklch(0% 0 0 / 0.3);
  --shadow-2: 0 2px 4px oklch(0% 0 0 / 0.5), 0 12px 32px oklch(0% 0 0 / 0.45);

  --font-display: "Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-body: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  --rail-width: 56px;
  --topbar-height: 56px;
  --bottombar-height: 60px;
  --sidebar-width: 280px;
  --glow-opacity: 0.3;
  --grain-opacity: 0.04;
}

[data-theme="light"] {
  color-scheme: light;

  --bg: oklch(98% 0.005 80);
  --surface-1: oklch(100% 0 0);
  --surface-2: oklch(95% 0.01 80);
  --surface-glass: oklch(100% 0 0 / 0.82);
  --border: oklch(86% 0.015 80);
  --text: oklch(20% 0.02 60);
  --text-muted: oklch(45% 0.02 60);
  --accent: oklch(60% 0.2 45);
  --accent-hover: oklch(54% 0.2 45);
  --on-accent: oklch(98% 0.01 45);
  --success: oklch(45% 0.17 150);
  --danger: oklch(45% 0.2 25);
  --warning: oklch(45% 0.16 85);

  --hue-l: 55%;

  --shadow-1: 0 1px 2px oklch(0% 0 0 / 0.08), 0 4px 12px oklch(0% 0 0 / 0.08);
  --shadow-2: 0 2px 4px oklch(0% 0 0 / 0.1), 0 12px 32px oklch(0% 0 0 / 0.14);

  --glow-opacity: 0.12;
}
```

- [ ] 4. Replace `src/styles/base.css` with this complete file (it supersedes the Task 1 version; sizes and colours come from `tokens.css`):

```css
/* Global reset and base styles. Component styles live in CSS Modules next to each component. */
*,
*::before,
*::after {
  box-sizing: border-box;
}

* {
  margin: 0;
}

html,
body,
#root {
  height: 100%;
}

html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

body {
  font-family: var(--font-body);
  font-size: var(--text-base);
  line-height: 1.4;
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

h1,
h2,
h3,
h4 {
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1.15;
}

img,
svg {
  display: block;
  max-width: 100%;
}

button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
}

button {
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  touch-action: manipulation;
}

a {
  color: var(--accent);
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

:focus:not(:focus-visible) {
  outline: none;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] 5. Create `src/state/useMediaQuery.ts`:

```ts
import { useCallback, useSyncExternalStore } from "react";

export type Tier = "wide" | "medium" | "mobile";

export const MOBILE_QUERY = "(max-width: 699.98px)";
export const WIDE_QUERY = "(min-width: 1100px)";
export const COARSE_QUERY = "(pointer: coarse)";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function mediaList(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  const list = window.matchMedia(query);
  return list ?? null;
}

/** `true` only when matchMedia exists and reports a match (false in jsdom). */
export function matchesMedia(query: string): boolean {
  return mediaList(query)?.matches === true;
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = mediaList(query);
      if (!list || typeof list.addEventListener !== "function") return () => undefined;
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => matchesMedia(query), [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Spec §7.10: wide ≥ 1100 px, mobile < 700 px, medium in between. jsdom resolves to "medium". */
export function useTier(): Tier {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const wide = useMediaQuery(WIDE_QUERY);
  if (mobile) return "mobile";
  if (wide) return "wide";
  return "medium";
}

export function prefersReducedMotion(): boolean {
  return matchesMedia(REDUCED_MOTION_QUERY);
}
```

- [ ] 6. Create the internal helpers `src/components/ui/cx.ts` and `src/components/ui/focus.ts`:

`src/components/ui/cx.ts`
```ts
/** Internal, used only by components under src/components. Joins truthy class names. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(" ");
}
```

`src/components/ui/focus.ts`
```ts
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Internal, used only by Sheet and Popover. Tabbable descendants of `root` in DOM order. */
export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true",
  );
}

/**
 * Internal, used only by Sheet and Popover.
 * While `open`: remembers the element focused before opening, focuses the panel unless a child
 * already took focus (CopySheet's textarea does), closes on Escape and, when `trap` is true, keeps
 * Tab / Shift+Tab cycling inside the panel. When `open` turns false (or the component unmounts) it
 * restores focus to the remembered element.
 */
export function useDialogFocus(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  trap: boolean,
): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    return () => {
      if (previous && previous.isConnected) previous.focus();
    };
  }, [open, panelRef]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !trap) return;
      const panel = panelRef.current;
      if (!panel) return;
      e.preventDefault();
      const items = focusables(panel);
      if (items.length === 0) {
        panel.focus();
        return;
      }
      const last = items.length - 1;
      const current = items.findIndex((el) => el === document.activeElement);
      const next = e.shiftKey
        ? current <= 0
          ? last
          : current - 1
        : current === -1 || current === last
          ? 0
          : current + 1;
      items[next]?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, trap, panelRef]);
}
```

- [ ] 7. Create `src/components/ui/Sheet.tsx` and `src/components/ui/Sheet.module.css`:

`src/components/ui/Sheet.tsx`
```tsx
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./Sheet.module.css";
import { useDialogFocus } from "./focus";

export interface SheetProps {
  open: boolean;
  side: "left" | "right" | "bottom";
  title: string;
  onClose(): void;
  children: ReactNode;
  labelledBy?: string;
}

export function Sheet({ open, side, title, onClose, children, labelledBy }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFocus(open, panelRef, onClose, true);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className={styles.root} data-side={side}>
      <div className={styles.backdrop} data-sheet-backdrop="" onClick={onClose} />
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? titleId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.close} aria-label="Zamknij" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
```

`src/components/ui/Sheet.module.css`
```css
.root {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
}

.backdrop {
  position: absolute;
  inset: 0;
  background: oklch(0% 0 0 / 0.55);
}

.panel {
  position: relative;
  display: flex;
  flex-direction: column;
  max-width: 100%;
  background: var(--surface-1);
  color: var(--text);
  box-shadow: var(--shadow-2);
  outline: none;
}

.root[data-side="left"] {
  justify-content: flex-start;
}

.root[data-side="left"] .panel {
  width: 320px;
  height: 100%;
  border-right: 1px solid var(--border);
}

.root[data-side="right"] {
  justify-content: flex-end;
}

.root[data-side="right"] .panel {
  width: 420px;
  height: 100%;
  border-left: 1px solid var(--border);
}

.root[data-side="bottom"] {
  align-items: flex-end;
}

.root[data-side="bottom"] .panel {
  width: 100%;
  height: 90%;
  border-top: 1px solid var(--border);
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}

.title {
  flex: 1;
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 18px;
}

.close {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  color: var(--text-muted);
}

.close:hover {
  background: var(--surface-2);
  color: var(--text);
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
}

@media (pointer: coarse) {
  .close {
    width: 44px;
    height: 44px;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .backdrop {
    animation: sheetFade 160ms ease-out;
  }

  .root[data-side="left"] .panel {
    animation: sheetSlideLeft 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .root[data-side="right"] .panel {
    animation: sheetSlideRight 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .root[data-side="bottom"] .panel {
    animation: sheetSlideUp 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
}

@keyframes sheetFade {
  from {
    opacity: 0;
  }
}

@keyframes sheetSlideLeft {
  from {
    transform: translateX(-24px);
    opacity: 0;
  }
}

@keyframes sheetSlideRight {
  from {
    transform: translateX(24px);
    opacity: 0;
  }
}

@keyframes sheetSlideUp {
  from {
    transform: translateY(24px);
    opacity: 0;
  }
}
```

- [ ] 8. Create `src/components/ui/Popover.tsx` and `src/components/ui/Popover.module.css`:

`src/components/ui/Popover.tsx`
```tsx
import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./Popover.module.css";
import { useDialogFocus } from "./focus";

export interface PopoverProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose(): void;
  children: ReactNode;
  title: string;
}

interface Position {
  top: number;
  right: number;
}

const GAP = 8;
const EDGE = 8;

export function Popover({ open, anchorRef, onClose, children, title }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [position, setPosition] = useState<Position | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useDialogFocus(open, panelRef, onClose, false);

  useLayoutEffect(() => {
    if (!open) return;
    const place = (): void => {
      const anchor = anchorRef.current;
      if (!anchor) {
        setPosition({ top: 64, right: EDGE });
        return;
      }
      const rect = anchor.getBoundingClientRect();
      setPosition({ top: rect.bottom + GAP, right: Math.max(EDGE, window.innerWidth - rect.right) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent): void => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onCloseRef.current();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, anchorRef]);

  const onBlur = (e: FocusEvent<HTMLDivElement>): void => {
    const next = e.relatedTarget;
    if (!(next instanceof Node)) return;
    if (panelRef.current?.contains(next) || anchorRef.current?.contains(next)) return;
    onCloseRef.current();
  };

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      className={styles.panel}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      style={position ? { top: position.top, right: position.right } : undefined}
      onBlur={onBlur}
    >
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <button type="button" className={styles.close} aria-label="Zamknij" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className={styles.content}>{children}</div>
    </div>,
    document.body,
  );
}
```

`src/components/ui/Popover.module.css`
```css
.panel {
  position: fixed;
  z-index: 90;
  width: 360px;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  background: var(--surface-1);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-sheet);
  box-shadow: var(--shadow-2);
  outline: none;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 12px 8px 16px;
}

.title {
  flex: 1;
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 16px;
}

.close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  color: var(--text-muted);
}

.close:hover {
  background: var(--surface-2);
  color: var(--text);
}

.content {
  padding: 4px 16px 16px;
}

@media (prefers-reduced-motion: no-preference) {
  .panel {
    animation: popoverIn 140ms ease-out;
  }
}

@keyframes popoverIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
```

- [ ] 9. Create `src/components/ui/Chip.tsx` and `src/components/ui/Chip.module.css`:

`src/components/ui/Chip.tsx`
```tsx
import { isValidElement, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./Chip.module.css";
import { cx } from "./cx";

export interface ChipProps {
  children: ReactNode;
  onRemove?(): void;
  tone?: "default" | "accent";
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

export function Chip({ children, onRemove, tone = "default" }: ChipProps) {
  const label = textOf(children);
  return (
    <span className={cx(styles.chip, tone === "accent" && styles.accent, onRemove !== undefined && styles.hasRemove)}>
      <span className={styles.text}>{children}</span>
      {onRemove && (
        <button type="button" className={styles.remove} aria-label={`Usuń filtr: ${label}`} onClick={onRemove}>
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
```

`src/components/ui/Chip.module.css`
```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--radius-chip);
  background: var(--surface-2);
  border: 1px solid var(--border);
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
}

.accent {
  background: color-mix(in oklch, var(--accent) 18%, var(--surface-2));
  border-color: color-mix(in oklch, var(--accent) 40%, var(--border));
}

.hasRemove {
  padding-right: 4px;
}

.text {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 24ch;
}

.remove {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  color: var(--text-muted);
}

.remove:hover {
  background: var(--surface-1);
  color: var(--text);
}

@media (pointer: coarse) {
  .chip {
    height: 36px;
  }

  .remove {
    width: 32px;
    height: 32px;
  }
}
```

- [ ] 10. Create `src/components/ui/Avatar.tsx` and `src/components/ui/Avatar.module.css`:

`src/components/ui/Avatar.tsx`
```tsx
import { useState, type CSSProperties } from "react";
import styles from "./Avatar.module.css";

export interface AvatarProps {
  name: string;
  src: string | null;
  size?: number;
  hue?: number;
}

/** Internal, used only here and in tests. First letter of the first and last word, uppercased. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w.length > 0);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  const result = (first + last).toUpperCase();
  return result.length > 0 ? result : "?";
}

export function Avatar({ name, src, size = 28, hue }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src !== null && failedSrc !== src;
  const style = {
    width: size,
    height: size,
    fontSize: size,
    "--avatar-hue": hue === undefined ? "60" : String(hue),
    "--avatar-chroma": hue === undefined ? "0" : "0.08",
  } as CSSProperties;

  return (
    <span className={styles.avatar} role="img" aria-label={name} title={name} style={style}>
      {showImage ? (
        <img className={styles.img} src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} />
      ) : (
        <span className={styles.initials} aria-hidden="true">
          {initials(name)}
        </span>
      )}
    </span>
  );
}
```

`src/components/ui/Avatar.module.css`
```css
.avatar {
  --avatar-hue: 60;
  --avatar-chroma: 0;
  display: inline-grid;
  place-items: center;
  flex: none;
  overflow: hidden;
  border-radius: 999px;
  background: oklch(35% var(--avatar-chroma) var(--avatar-hue));
  color: oklch(92% 0.02 var(--avatar-hue));
  box-shadow: 0 0 0 2px var(--surface-1);
  font-family: var(--font-body);
  font-weight: 600;
  line-height: 1;
}

[data-theme="light"] .avatar {
  background: oklch(88% var(--avatar-chroma) var(--avatar-hue));
  color: oklch(35% 0.04 var(--avatar-hue));
}

.img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.initials {
  font-size: 0.4em;
  letter-spacing: 0.02em;
}
```

- [ ] 11. Create `src/components/ui/Segmented.tsx` and `src/components/ui/Segmented.module.css`:

`src/components/ui/Segmented.tsx`
```tsx
import { useRef, type KeyboardEvent } from "react";
import styles from "./Segmented.module.css";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange(v: T): void;
  ariaLabel: string;
}

export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: SegmentedProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    const delta =
      e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (delta === 0 || options.length === 0) return;
    e.preventDefault();
    const current = options.findIndex((o) => o.value === value);
    const next = (current + delta + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    buttons.current[next]?.focus();
  };

  return (
    <div className={styles.group} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option, i) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            title={option.hint}
            className={styles.option}
            onClick={() => onChange(option.value)}
            onKeyDown={onKeyDown}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
```

`src/components/ui/Segmented.module.css`
```css
.group {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  max-width: 100%;
  flex-wrap: wrap;
}

.option {
  flex: 1 0 auto;
  min-height: 32px;
  padding: 6px 12px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  white-space: nowrap;
}

.option:hover {
  color: var(--text);
}

.option[aria-checked="true"] {
  background: var(--surface-1);
  color: var(--text);
  box-shadow: var(--shadow-1);
}

@media (pointer: coarse) {
  .option {
    min-height: 44px;
  }
}
```

- [ ] 12. Create `src/components/ui/Slider.tsx` and `src/components/ui/Slider.module.css`:

`src/components/ui/Slider.tsx`
```tsx
import { useId } from "react";
import styles from "./Slider.module.css";

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(v: number): void;
  label: string;
  format?(v: number): string;
}

export function Slider({ value, min, max, step, onChange, label, format }: SliderProps) {
  const id = useId();
  const shown = format ? format(value) : String(value);
  return (
    <div className={styles.field}>
      <div className={styles.row}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        <output htmlFor={id} className={styles.value}>
          {shown}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className={styles.input}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={shown}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
    </div>
  );
}
```

`src/components/ui/Slider.module.css`
```css
.field {
  display: grid;
  gap: 6px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  font-size: 13px;
}

.label {
  font-weight: 500;
}

.value {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.input {
  width: 100%;
  margin: 0;
  accent-color: var(--accent);
}

@media (pointer: coarse) {
  .input {
    min-height: 44px;
  }
}
```

- [ ] 13. Create `src/components/ui/Toggle.tsx` and `src/components/ui/Toggle.module.css`:

`src/components/ui/Toggle.tsx`
```tsx
import { useId } from "react";
import styles from "./Toggle.module.css";

export interface ToggleProps {
  checked: boolean;
  onChange(v: boolean): void;
  label: string;
  hint?: string;
}

export function Toggle({ checked, onChange, label, hint }: ToggleProps) {
  const labelId = useId();
  const hintId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={hint ? hintId : undefined}
      className={styles.row}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.text}>
        <span id={labelId} className={styles.label}>
          {label}
        </span>
        {hint && (
          <span id={hintId} className={styles.hint}>
            {hint}
          </span>
        )}
      </span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </button>
  );
}
```

`src/components/ui/Toggle.module.css`
```css
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 6px 0;
  text-align: left;
}

.text {
  flex: 1;
  display: grid;
  gap: 2px;
}

.label {
  font-size: 14px;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
}

.track {
  position: relative;
  flex: none;
  width: 40px;
  height: 24px;
  border-radius: 999px;
  background: var(--border);
}

.thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--text);
}

.row[aria-checked="true"] .track {
  background: var(--accent);
}

.row[aria-checked="true"] .thumb {
  transform: translateX(16px);
  background: var(--on-accent);
}

@media (prefers-reduced-motion: no-preference) {
  .track {
    transition: background 160ms ease;
  }

  .thumb {
    transition: transform 160ms ease, background 160ms ease;
  }
}
```

- [ ] 14. Create `src/components/ui/Burst.tsx`, `src/components/ui/EmptyState.tsx` and `src/components/ui/EmptyState.module.css`:

`src/components/ui/Burst.tsx`
```tsx
/** Internal, used only by EmptyState and the shell's TopBar. The festival's orange burst glyph. */
export interface BurstProps {
  size?: number;
  className?: string;
}

const RAY_COUNT = 16;

export function Burst({ size = 28, className }: BurstProps) {
  const rays = Array.from({ length: RAY_COUNT }, (_, i) => (360 / RAY_COUNT) * i);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="#ff6600">
        {rays.map((deg) => (
          <polygon key={deg} points="50,2 56,30 44,30" transform={`rotate(${deg} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="22" />
      </g>
    </svg>
  );
}
```

`src/components/ui/EmptyState.tsx`
```tsx
import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";
import { Burst } from "./Burst";

export interface EmptyStateProps {
  title: string;
  text?: string;
  actions?: ReactNode;
  illustration?: boolean;
}

export function EmptyState({ title, text, actions, illustration = false }: EmptyStateProps) {
  return (
    <div className={styles.empty} role="status">
      {illustration && <Burst size={96} className={styles.burst} />}
      <h2 className={styles.title}>{title}</h2>
      {text && <p className={styles.text}>{text}</p>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
```

`src/components/ui/EmptyState.module.css`
```css
.empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 48px 24px;
  text-align: center;
  color: var(--text-muted);
}

.burst {
  width: 96px;
  height: 96px;
  opacity: 0.9;
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 20px;
  color: var(--text);
}

.text {
  margin: 0;
  max-width: 44ch;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}

@media (prefers-reduced-motion: no-preference) {
  .burst {
    animation: burstIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

@keyframes burstIn {
  from {
    transform: scale(0.6) rotate(-20deg);
    opacity: 0;
  }
}
```

- [ ] 15. Create `src/components/ui/CopySheet.tsx` and `src/components/ui/CopySheet.module.css`:

`src/components/ui/CopySheet.tsx`
```tsx
import { useEffect, useRef } from "react";
import styles from "./CopySheet.module.css";
import { Sheet } from "./Sheet";
import { useStore } from "../../state/store";
import { useTier } from "../../state/useMediaQuery";

function SelectedTextarea({ text }: { text: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [text]);
  return (
    <textarea ref={ref} className={styles.textarea} readOnly value={text} rows={12} aria-label="Tekst do skopiowania" />
  );
}

export function CopySheet() {
  const copyText = useStore((s) => s.copyText);
  const openSheet = useStore((s) => s.openSheet);
  const setSheet = useStore((s) => s.setSheet);
  const setCopyText = useStore((s) => s.setCopyText);
  const mobile = useTier() === "mobile";
  const open = openSheet === "copy" && copyText !== null;

  const close = (): void => {
    setSheet(null);
    setCopyText(null);
  };

  return (
    <Sheet open={open} side={mobile ? "bottom" : "right"} title="Skopiuj ręcznie" onClose={close}>
      <p className={styles.hint}>Schowek jest niedostępny w tej przeglądarce. Tekst poniżej jest zaznaczony, skopiuj go skrótem klawiszowym.</p>
      <SelectedTextarea text={copyText ?? ""} />
    </Sheet>
  );
}
```

`src/components/ui/CopySheet.module.css`
```css
.hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-muted);
}

.textarea {
  width: 100%;
  min-height: 240px;
  padding: 12px;
  resize: vertical;
  background: var(--surface-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
}
```

- [ ] 16. Create `src/components/ui/Star.tsx` and `src/components/ui/Star.module.css`:

`src/components/ui/Star.tsx`
```tsx
import { useEffect, useState } from "react";
import { Star as StarIcon } from "lucide-react";
import styles from "./Star.module.css";
import { cx } from "./cx";

export interface StarProps {
  pressed: boolean;
  onToggle(): void;
  size?: number;
}

const POP_MS = 250;

export function Star({ pressed, onToggle, size = 18 }: StarProps) {
  const [popping, setPopping] = useState(false);

  useEffect(() => {
    if (!popping) return;
    const timer = window.setTimeout(() => setPopping(false), POP_MS);
    return () => window.clearTimeout(timer);
  }, [popping]);

  return (
    <button
      type="button"
      className={cx(styles.star, popping && styles.pop)}
      aria-pressed={pressed}
      aria-label="Do planu"
      onClick={() => {
        setPopping(true);
        onToggle();
      }}
    >
      <StarIcon size={size} fill={pressed ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}
```

`src/components/ui/Star.module.css`
```css
.star {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  color: var(--text-muted);
}

.star:hover {
  color: var(--accent);
  background: var(--surface-2);
}

.star[aria-pressed="true"] {
  color: var(--accent);
}

.star svg {
  display: block;
}

@media (pointer: coarse) {
  .star {
    min-width: 44px;
    min-height: 44px;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .pop svg {
    animation: starPop 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

@keyframes starPop {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.3);
  }

  100% {
    transform: scale(1);
  }
}
```

- [ ] 17. Run `npx vitest run src/test/ui.test.tsx` and confirm every test passes: 21 tests (6 Sheet, 2 Popover, 1 Star, 3 Avatar, 2 Chip, 1 Segmented, 1 Slider, 1 Toggle, 1 EmptyState, 2 CopySheet, 1 useMediaQuery).

- [ ] 18. Run `npm run typecheck` and confirm it reports no errors.

- [ ] 19. Commit:

```bash
git add -A && git commit -F - <<'EOF'
feat(ui): add shared UI primitives and media-query hook

Sheet (focus trap, Escape/backdrop close, focus restore), Popover, Chip,
Avatar with initials fallback, Segmented, Slider, Toggle, EmptyState,
CopySheet, Star, the Burst glyph, complete tokens.css and base.css resets,
plus useMediaQuery/useTier in src/state.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2
EOF
```

---

### Task 23: Shell components, `App.tsx` and `main.tsx`

**Files:**
- Create: `src/components/shell/TopBar.tsx`, `src/components/shell/TopBar.module.css`
- Create: `src/components/shell/DayTabs.tsx`, `src/components/shell/DayTabs.module.css`
- Create: `src/components/shell/ViewSwitcher.tsx`, `src/components/shell/ViewSwitcher.module.css`
- Create: `src/components/shell/BottomBar.tsx`, `src/components/shell/BottomBar.module.css`
- Create: `src/components/shell/LiveChip.tsx`, `src/components/shell/LiveChip.module.css`
- Create: `src/components/shell/ShareBanner.tsx`, `src/components/shell/ShareBanner.module.css`
- Create: `src/components/shell/FilterChips.tsx`, `src/components/shell/FilterChips.module.css`
- Create: `src/components/shell/Toasts.tsx`, `src/components/shell/Toasts.module.css`
- Create: `src/App.tsx`, `src/App.module.css`
- Create: `src/main.tsx` (replace the setup task's placeholder if one exists)
- Create: `src/state/clock.ts` (the app-wide `Clock`, imported by both `src/main.tsx` and `src/App.tsx`)
- Create (only if an earlier task has not already created it): `src/data/index.tsx`
- Create (only if an earlier task has not already created it): `src/styles/print.css`
- Create (placeholder, replaced in Task 26): `src/components/grid/ScheduleGrid.tsx`
- Create (placeholder, replaced in Task 29): `src/components/list/ScheduleList.tsx`
- Create (placeholder, replaced in Task 33): `src/components/plan/PlanView.tsx`
- Create (placeholder, replaced in Task 33): `src/components/plan/PrintPlan.tsx`
- Create (placeholder, replaced in Task 32): `src/components/detail/DetailSheet.tsx`
- Create (placeholder, replaced in Task 30): `src/components/filters/FiltersPanel.tsx`
- Create (placeholder, replaced in Task 31): `src/components/settings/SettingsPanel.tsx`
- Delete: `src/test/App.test.tsx` (Task 1's smoke test looked for a heading named "ŚwiatłoSiła 2026"; the new top bar renders the wordmark as a span, and the `App` case in `src/test/shell.test.tsx` takes over that coverage)
- Test: `src/test/shell.test.tsx`

**Interfaces:**
- Consumes:
  - `useStore`, `usePlanSet`, `defaultSettings`, `STORAGE_KEY`, types `View`, `Settings`, `SharedPlan` from `src/state/store.ts`; actions `setDay`, `setView`, `setFilters`, `clearFilters`, `toggleFacetValue`, `setSettings`, `setSheet`, `loadSharedPlan`, `previewSharedPlan`, `dismissSharedPlan`, `pushToast`, `dismissToast`, `setNow`.
  - `daySets`, `buildColumns`, `resolveTimeMode`, `listGroups` from `src/state/derive.ts`.
  - `resolveBoot` from `src/state/boot.ts` (takes `persistedFavourites: string[]` and returns `favourites` and `droppedFavourites` next to `day`, `view`, `sharedPlan`); `parseHash`, `writeHash` from `src/state/hash.ts`; `applyTheme`, `watchSystemTheme` from `src/state/theme.ts`.
  - `createClock` from `src/domain/now.ts` (called exactly once, in `src/state/clock.ts`); `isToday`, `isTomorrow`, `nowFor`, `liveState`; `formatTime` from `src/domain/time.ts`; `activeFilterCount`, `signupLabel`, `EMPTY_FILTERS` from `src/domain/filters.ts`.
  - `useData()` from `src/data/index.tsx` in every component that reads the schedule (`DayTabs`, `LiveChip`, `FilterChips`, `App`); `DataProvider` and `buildAppData` from the same module in `src/test/shell.test.tsx` (fixtures are injected through the provider, never by mocking the module). Only the non-component entry `src/main.tsx` imports the module-level `data`, `index`, `search` and hands them to `<DataProvider>`.
  - Components that later tasks implement, imported as named exports: `ScheduleGrid` (`src/components/grid/ScheduleGrid`, Task 26), `ScheduleList` (`src/components/list/ScheduleList`, Task 29), `PlanView` (`src/components/plan/PlanView`, Task 33) and `PrintPlan` (`src/components/plan/PrintPlan`, Task 33), `DetailSheet` (`src/components/detail/DetailSheet`, Task 32), `FiltersPanel` (`src/components/filters/FiltersPanel`, Task 30), `SettingsPanel` (`src/components/settings/SettingsPanel`, Task 31). Step 12b creates each of them as a placeholder with the contract props so that typecheck, tests and the build stay green; the later task overwrites the file in place and keeps the same named export and props.
  - Task 22: `Sheet`, `Chip`, `Burst`, `cx`, `CopySheet`, `useTier`, `prefersReducedMotion`.
- Produces:
  - `TopBar()`, `DayTabs()`, `ViewSwitcher()`, `BottomBar()`, `LiveChip()`, `ShareBanner()`, `FilterChips()`, `Toasts()` — no props, named exports.
  - `VIEW_OPTIONS: { value: View; label: string }[]` (internal, exported from `ViewSwitcher.tsx` for `BottomBar`).
  - `App` (default export) and the entry `src/main.tsx`.
  - DOM hooks the grid and list must provide for the live chip: the grid's now line element carries `data-now-line`; a list group containing a `live` or `soon` session carries `data-live-group`.
  - `src/state/clock.ts`: `clock: Clock`, created once with `createClock(window.location.search)`; `main.tsx` reads the boot `now` from it and `App` advances the store's `now` from it every 30 s.
  - Placeholder named exports with the contract props (step 12b), each returning `null` except `PrintPlan`, which renders `<section className="print-plan" aria-hidden="true" />`; `ScheduleList.tsx` also exports `LIVE_GROUP_ID = "list-live"`.

Steps:

- [ ] 1. Write the failing test file `src/test/shell.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { makeData, makeSession } from "./fixtures/build";
import { DataProvider, buildAppData } from "../data/index";
import { useStore, defaultSettings } from "../state/store";
import { EMPTY_FILTERS } from "../domain/filters";
import { DayTabs } from "../components/shell/DayTabs";
import { ViewSwitcher } from "../components/shell/ViewSwitcher";
import { BottomBar } from "../components/shell/BottomBar";
import { LiveChip } from "../components/shell/LiveChip";
import { ShareBanner } from "../components/shell/ShareBanner";
import { FilterChips } from "../components/shell/FilterChips";
import { Toasts } from "../components/shell/Toasts";
import App from "../App";

const fixture = makeData([
  makeSession({ id: "1:pt", eventId: 1, day: "pt", title: "Światło w studiu", start: 600, end: 660 }),
  makeSession({ id: "2:pt", eventId: 2, day: "pt", title: "Krótka sesja", start: 630, end: 640 }),
  makeSession({ id: "3:pt", eventId: 3, day: "pt", title: "Otwarcie strefy", start: 650, end: null }),
  makeSession({ id: "4:pt", eventId: 4, day: "pt", title: "Później", start: 660, end: 720 }),
  makeSession({ id: "5:sob", eventId: 5, day: "sob", title: "Sobota rano", start: 540, end: 600 }),
  makeSession({ id: "6:sob", eventId: 6, day: "sob", title: "Sobota później", start: 600, end: 660 }),
  makeSession({ id: "7:czw", eventId: 7, day: "czw", title: "Czwartek", start: 1080, end: 1140 }),
]);
const appData = buildAppData(fixture);

/** Every component under test reads the schedule through `useData()`, so the tree is always mounted inside the provider. */
function renderWithData(ui: ReactNode) {
  return render(<DataProvider value={appData}>{ui}</DataProvider>);
}

function resetStore(day = "pt"): void {
  localStorage.clear();
  useStore.setState({
    day,
    view: "grid",
    filters: EMPTY_FILTERS,
    settings: defaultSettings(1280),
    favourites: [],
    selectedSessionId: null,
    openSheet: null,
    sharedPlan: null,
    previewPlan: null,
    toasts: [],
    copyText: null,
    now: new Date(2026, 8, 4, 10, 42),
  });
}

function dayLabel(id: string): string {
  const day = fixture.days.find((d) => d.id === id);
  if (!day) throw new Error(`Brak dnia ${id} w fixture`);
  return day.label;
}

beforeEach(() => {
  resetStore();
});

describe("DayTabs", () => {
  it("selects the store day and moves selection with arrow keys, wrapping around", async () => {
    const user = userEvent.setup();
    renderWithData(<DayTabs />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(fixture.days.length);
    const friday = screen.getByRole("tab", { name: new RegExp(dayLabel("pt")) });
    const saturday = screen.getByRole("tab", { name: new RegExp(dayLabel("sob")) });
    const thursday = screen.getByRole("tab", { name: new RegExp(dayLabel("czw")) });
    expect(friday.getAttribute("aria-selected")).toBe("true");
    expect(friday.tabIndex).toBe(0);
    expect(saturday.tabIndex).toBe(-1);

    friday.focus();
    await user.keyboard("{ArrowRight}");
    expect(useStore.getState().day).toBe("sob");
    expect(document.activeElement).toBe(saturday);
    expect(saturday.getAttribute("aria-selected")).toBe("true");

    await user.keyboard("{ArrowRight}");
    expect(useStore.getState().day).toBe("czw");
    expect(document.activeElement).toBe(thursday);

    await user.keyboard("{End}");
    expect(useStore.getState().day).toBe("sob");
    await user.keyboard("{Home}");
    expect(useStore.getState().day).toBe("czw");
  });

  it("switches the day on click", async () => {
    const user = userEvent.setup();
    renderWithData(<DayTabs />);
    await user.click(screen.getByRole("tab", { name: new RegExp(dayLabel("sob")) }));
    expect(useStore.getState().day).toBe("sob");
  });
});

describe("ViewSwitcher", () => {
  it("hides the plan badge at zero and shows the favourite count otherwise", () => {
    const { rerender } = renderWithData(<ViewSwitcher />);
    const plan = screen.getByRole("button", { name: /Mój plan/ });
    expect(within(plan).queryByText(/^\d+$/)).toBeNull();
    useStore.setState({ favourites: ["1:pt", "5:sob"] });
    rerender(
      <DataProvider value={appData}>
        <ViewSwitcher />
      </DataProvider>,
    );
    expect(within(screen.getByRole("button", { name: /Mój plan/ })).getByText("2")).not.toBeNull();
  });

  it("marks the current view and switches on click", async () => {
    const user = userEvent.setup();
    renderWithData(<ViewSwitcher />);
    expect(screen.getByRole("button", { name: "Siatka" }).getAttribute("aria-current")).toBe("page");
    await user.click(screen.getByRole("button", { name: "Lista" }));
    expect(useStore.getState().view).toBe("list");
  });
});

describe("BottomBar", () => {
  it("shows the plan badge, the active filter count and opens the filters sheet", async () => {
    const user = userEvent.setup();
    useStore.setState({ favourites: ["1:pt", "2:pt", "5:sob"], filters: { ...EMPTY_FILTERS, query: "sob" } });
    renderWithData(<BottomBar />);
    expect(within(screen.getByRole("button", { name: /Mój plan/ })).getByText("3")).not.toBeNull();
    const filters = screen.getByRole("button", { name: /Filtry/ });
    expect(within(filters).getByText("1")).not.toBeNull();
    await user.click(filters);
    expect(useStore.getState().openSheet).toBe("filters");
  });
});

describe("LiveChip", () => {
  it("shows Teraz with the live count when the selected day is today", () => {
    renderWithData(<LiveChip />);
    expect(screen.getByRole("button", { name: "Teraz 10:42 · trwa 1" })).not.toBeNull();
  });

  it("shows Jutro od with the earliest start when the selected day is tomorrow", () => {
    resetStore("sob");
    renderWithData(<LiveChip />);
    expect(screen.getByText("Jutro od 09:00")).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing for other days", () => {
    resetStore("czw");
    const { container } = renderWithData(<LiveChip />);
    expect(container.textContent).toBe("");
  });

  it("scrolls to the now line in grid view when clicked", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    renderWithData(
      <>
        <div
          data-now-line=""
          ref={(el) => {
            if (el) el.scrollIntoView = scrollIntoView;
          }}
        />
        <LiveChip />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Teraz 10:42 · trwa 1" }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

describe("ShareBanner", () => {
  it("offers load and preview and reports unknown ids", async () => {
    const user = userEvent.setup();
    useStore.setState({ sharedPlan: { ids: ["1:pt", "5:sob"], unknown: 1 } });
    renderWithData(<ShareBanner />);
    expect(screen.getByText("Ktoś udostępnił Ci plan: 2 wydarzeń")).not.toBeNull();
    expect(screen.getByText(/1 nie pasuje do tej wersji harmonogramu/)).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Wczytaj" }));
    expect(new Set(useStore.getState().favourites)).toEqual(new Set(["1:pt", "5:sob"]));
    expect(useStore.getState().sharedPlan).toBeNull();
  });

  it("preview sets previewPlan, opens the plan view and leaves favourites alone", async () => {
    const user = userEvent.setup();
    useStore.setState({ sharedPlan: { ids: ["1:pt", "5:sob"], unknown: 0 } });
    renderWithData(<ShareBanner />);
    expect(screen.queryByText(/nie pasuje do tej wersji/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Tylko podgląd" }));
    expect(useStore.getState().previewPlan).toEqual(["1:pt", "5:sob"]);
    expect(useStore.getState().view).toBe("plan");
    expect(useStore.getState().favourites).toEqual([]);
    expect(useStore.getState().sharedPlan).toBeNull();
  });

  it("with no usable ids explains the mismatch and only offers close", async () => {
    const user = userEvent.setup();
    useStore.setState({ sharedPlan: { ids: [], unknown: 3 } });
    renderWithData(<ShareBanner />);
    expect(screen.queryByRole("button", { name: "Wczytaj" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tylko podgląd" })).toBeNull();
    expect(screen.getByText(/nie pasuje/)).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(useStore.getState().sharedPlan).toBeNull();
  });

  it("renders nothing without a shared plan", () => {
    const { container } = renderWithData(<ShareBanner />);
    expect(container.textContent).toBe("");
  });
});

describe("FilterChips", () => {
  it("lists active filters as removable chips and clears everything", async () => {
    const user = userEvent.setup();
    useStore.setState({ filters: { ...EMPTY_FILTERS, types: [184], query: "abc", onlyFavourites: true } });
    renderWithData(<FilterChips />);
    expect(screen.getByText("Tylko ulubione")).not.toBeNull();
    expect(screen.getByText("Szukaj: „abc”")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Usuń filtr: Prelekcja" }));
    expect(useStore.getState().filters.types).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Wyczyść wszystko" }));
    expect(useStore.getState().filters).toEqual(EMPTY_FILTERS);
  });

  it("renders nothing when no filter is active", () => {
    const { container } = renderWithData(<FilterChips />);
    expect(container.textContent).toBe("");
  });
});

describe("Toasts", () => {
  it("shows one toast at a time and runs its action", async () => {
    const user = userEvent.setup();
    const run = vi.fn();
    renderWithData(<Toasts />);
    act(() => {
      useStore.getState().pushToast("Usunięto z planu: Sesja", { label: "Cofnij", run });
      useStore.getState().pushToast("Drugi komunikat");
    });
    expect(await screen.findByText("Usunięto z planu: Sesja")).not.toBeNull();
    expect(screen.queryByText("Drugi komunikat")).toBeNull();
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(run).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Drugi komunikat")).not.toBeNull();
    expect(screen.queryByText("Usunięto z planu: Sesja")).toBeNull();
  });
});

describe("App", () => {
  it("renders the shell with the mark, the tabs, the main area and the print section", () => {
    renderWithData(<App />);
    expect(screen.getByText("ŚwiatłoSiła 2026")).not.toBeNull();
    expect(screen.getAllByRole("tab")).toHaveLength(fixture.days.length);
    expect(screen.getByRole("main")).not.toBeNull();
    expect(document.querySelector(".print-plan")).not.toBeNull();
  });
});
```

- [ ] 2. Run `npx vitest run src/test/shell.test.tsx` and confirm it fails with `Error: Failed to resolve import "../components/shell/DayTabs" from "src/test/shell.test.tsx"`.

- [ ] 3. Create `src/data/index.tsx` (the single data entry point: module-level snapshot plus a React context so tests can inject fixtures):

```tsx
import { createContext, useContext, type ReactNode } from "react";
import schedule from "./schedule.json";
import type { ScheduleData } from "./types";
import { buildIndex, type DataIndex } from "../domain/lookup";
import { buildSearchIndex, type SearchIndex } from "../domain/filters";

export interface AppData {
  data: ScheduleData;
  index: DataIndex;
  search: SearchIndex;
}

export function buildAppData(data: ScheduleData): AppData {
  const index = buildIndex(data);
  return { data, index, search: buildSearchIndex(data, index) };
}

export const data = schedule as unknown as ScheduleData;
export const index = buildIndex(data);
export const search = buildSearchIndex(data, index);

const DataContext = createContext<AppData>({ data, index, search });

export function DataProvider({ value, children }: { value: AppData; children: ReactNode }) {
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): AppData {
  return useContext(DataContext);
}
```

- [ ] 4. If `src/styles/print.css` does not exist yet, create it (spec §7.5):

```css
@media print {
  body > * {
    display: none !important;
  }

  .print-plan {
    display: block !important;
    color: #000;
    background: #fff;
    font: 12pt/1.4 Georgia, "Times New Roman", serif;
  }

  .print-plan h2 {
    margin: 16pt 0 6pt;
    font-size: 14pt;
    page-break-after: avoid;
  }

  .print-plan ul {
    margin: 0;
    padding-left: 16pt;
  }
}

@media screen {
  .print-plan {
    display: none;
  }
}
```

- [ ] 5. Create `src/components/shell/DayTabs.tsx` and `src/components/shell/DayTabs.module.css`:

`src/components/shell/DayTabs.tsx`
```tsx
import { useRef, type KeyboardEvent } from "react";
import styles from "./DayTabs.module.css";
import { useData } from "../../data/index";
import type { Day } from "../../data/types";
import { useStore } from "../../state/store";

function dateOf(day: Day): string {
  const prefix = `${day.label}, `;
  return day.labelLong.startsWith(prefix) ? day.labelLong.slice(prefix.length) : day.labelLong;
}

export function DayTabs() {
  const { data } = useData();
  const current = useStore((s) => s.day);
  const setDay = useStore((s) => s.setDay);
  const buttons = useRef<Map<string, HTMLButtonElement>>(new Map());
  const days = data.days;

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number): void => {
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % days.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + days.length) % days.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = days.length - 1;
    if (next === null) return;
    e.preventDefault();
    const target = days[next];
    if (!target) return;
    setDay(target.id);
    buttons.current.get(target.id)?.focus();
  };

  return (
    <div className={styles.tabs} role="tablist" aria-label="Dzień festiwalu">
      {days.map((day, i) => {
        const selected = day.id === current;
        return (
          <button
            key={day.id}
            ref={(el) => {
              if (el) buttons.current.set(day.id, el);
              else buttons.current.delete(day.id);
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={styles.tab}
            data-day={day.id}
            onClick={() => setDay(day.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <span className={styles.label}>{day.label}</span>
            <span className={styles.short}>{day.short}</span>
            <span className={styles.date}>{dateOf(day)}</span>
          </button>
        );
      })}
    </div>
  );
}
```

`src/components/shell/DayTabs.module.css`
```css
.tabs {
  display: flex;
  gap: 4px;
  flex: none;
}

.tab {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 15px;
  color: var(--text-muted);
  white-space: nowrap;
}

.tab:hover {
  color: var(--text);
  background: var(--surface-2);
}

.tab[aria-selected="true"] {
  color: var(--on-accent);
  background: var(--accent);
}

.short {
  display: none;
}

.date {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 12px;
  opacity: 0.85;
}

@media (max-width: 699.98px) {
  .tabs {
    overflow-x: auto;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border);
    scrollbar-width: none;
  }

  .tabs::-webkit-scrollbar {
    display: none;
  }

  .tab {
    min-height: 44px;
  }

  .label {
    display: none;
  }

  .short {
    display: inline;
  }
}
```

- [ ] 6. Create `src/components/shell/ViewSwitcher.tsx` and `src/components/shell/ViewSwitcher.module.css`:

`src/components/shell/ViewSwitcher.tsx`
```tsx
import styles from "./ViewSwitcher.module.css";
import { useStore, type View } from "../../state/store";

/** Internal, used only by ViewSwitcher and BottomBar. */
export const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "grid", label: "Siatka" },
  { value: "list", label: "Lista" },
  { value: "plan", label: "Mój plan" },
];

export function ViewSwitcher() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const count = useStore((s) => s.favourites.length);

  return (
    <nav className={styles.switcher} aria-label="Widok">
      {VIEW_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.item}
          aria-current={view === option.value ? "page" : undefined}
          onClick={() => setView(option.value)}
        >
          {option.label}
          {option.value === "plan" && count > 0 && <span className={styles.badge}>{count}</span>}
        </button>
      ))}
    </nav>
  );
}
```

`src/components/shell/ViewSwitcher.module.css`
```css
.switcher {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  flex: none;
}

.item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  white-space: nowrap;
}

.item:hover {
  color: var(--text);
}

.item[aria-current="page"] {
  background: var(--surface-1);
  color: var(--text);
  box-shadow: var(--shadow-1);
}

.badge {
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: var(--text-min);
  font-weight: 700;
}
```

- [ ] 7. Create `src/components/shell/BottomBar.tsx` and `src/components/shell/BottomBar.module.css`:

`src/components/shell/BottomBar.tsx`
```tsx
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
```

`src/components/shell/BottomBar.module.css`
```css
.bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  height: calc(var(--bottombar-height) + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: var(--surface-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--border);
}

.item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 44px;
  font-size: var(--text-min);
  color: var(--text-muted);
}

.item[aria-current="page"],
.item[aria-expanded="true"] {
  color: var(--accent);
}

.badge {
  position: absolute;
  top: 6px;
  left: calc(50% + 6px);
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: var(--text-min);
  font-weight: 700;
}
```

- [ ] 8. Create `src/components/shell/LiveChip.tsx` and `src/components/shell/LiveChip.module.css`:

`src/components/shell/LiveChip.tsx`
```tsx
import { useState } from "react";
import styles from "./LiveChip.module.css";
import { useData } from "../../data/index";
import { useStore } from "../../state/store";
import { prefersReducedMotion, useTier } from "../../state/useMediaQuery";
import { isToday, isTomorrow, liveState, nowFor } from "../../domain/now";
import { formatTime } from "../../domain/time";

/**
 * Grid view: the grid's now line carries `data-now-line`.
 * List view: a group holding a live or soon session carries `data-live-group`.
 */
function scrollToNow(layout: "grid" | "list"): void {
  const selector = layout === "grid" ? "[data-now-line]" : "[data-live-group]";
  const target = document.querySelector<HTMLElement>(selector);
  if (!target || typeof target.scrollIntoView !== "function") return;
  target.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

export function LiveChip() {
  const { data, index } = useData();
  const dayId = useStore((s) => s.day);
  const now = useStore((s) => s.now);
  const view = useStore((s) => s.view);
  const planLayout = useStore((s) => s.settings.planLayout);
  const mobile = useTier() === "mobile";
  const [expanded, setExpanded] = useState(false);

  const day = index.dayById.get(dayId) ?? data.days.find((d) => d.id === dayId);
  if (!day) return null;
  const sessions = index.sessionsByDay.get(day.id) ?? [];

  if (isToday(day, now)) {
    const nowMinutes = nowFor(day, now);
    if (nowMinutes === null) return null;
    const live = sessions.filter((s) => liveState(s, nowMinutes) === "live").length;
    const text = `Teraz ${formatTime(nowMinutes)} · trwa ${live}`;
    const collapsed = mobile && !expanded;
    const layout = view === "plan" ? planLayout : view;
    const onClick = (): void => {
      if (collapsed) {
        setExpanded(true);
        return;
      }
      scrollToNow(layout);
    };
    return (
      <button
        type="button"
        className={styles.chip}
        data-live="true"
        aria-label={collapsed ? text : undefined}
        title={collapsed ? text : undefined}
        onClick={onClick}
      >
        <span className={styles.dot} aria-hidden="true" />
        {collapsed ? `· ${live}` : text}
      </button>
    );
  }

  if (isTomorrow(day, now)) {
    const starts = sessions.map((s) => s.start).filter((start): start is number => start !== null);
    if (starts.length === 0) return null;
    return <span className={styles.chip}>{`Jutro od ${formatTime(Math.min(...starts))}`}</span>;
  }

  return null;
}
```

`src/components/shell/LiveChip.module.css`
```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.chip[data-live="true"] {
  color: var(--text);
  border-color: color-mix(in oklch, var(--accent) 50%, var(--border));
}

.chip[data-live="true"]:hover {
  background: color-mix(in oklch, var(--accent) 12%, var(--surface-2));
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--accent);
}

@media (pointer: coarse) {
  .chip {
    min-height: 44px;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .dot {
    animation: livePulse 2s ease-in-out infinite;
  }
}

@keyframes livePulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in oklch, var(--accent) 60%, transparent);
  }

  50% {
    box-shadow: 0 0 0 5px transparent;
  }
}
```

- [ ] 9. Create `src/components/shell/ShareBanner.tsx` and `src/components/shell/ShareBanner.module.css`:

`src/components/shell/ShareBanner.tsx`
```tsx
import { Share2, X } from "lucide-react";
import styles from "./ShareBanner.module.css";
import { useStore } from "../../state/store";

export function ShareBanner() {
  const shared = useStore((s) => s.sharedPlan);
  const load = useStore((s) => s.loadSharedPlan);
  const preview = useStore((s) => s.previewSharedPlan);
  const dismiss = useStore((s) => s.dismissSharedPlan);

  if (!shared) return null;
  const count = shared.ids.length;

  return (
    <section className={styles.banner} aria-label="Udostępniony plan">
      <Share2 size={18} aria-hidden="true" className={styles.icon} />
      <p className={styles.text}>
        {count === 0 ? (
          <span>Ten link wskazuje na wersję harmonogramu, która już nie pasuje do tej. Nie udało się wczytać żadnego wydarzenia.</span>
        ) : (
          <>
            <strong>{`Ktoś udostępnił Ci plan: ${count} wydarzeń`}</strong>
            {shared.unknown > 0 && (
              <span className={styles.muted}>{` · ${shared.unknown} nie pasuje do tej wersji harmonogramu`}</span>
            )}
          </>
        )}
      </p>
      {count > 0 && (
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={load}>
            Wczytaj
          </button>
          <button type="button" className={styles.secondary} onClick={preview}>
            Tylko podgląd
          </button>
        </div>
      )}
      <button type="button" className={styles.close} aria-label="Zamknij" onClick={dismiss}>
        <X size={18} aria-hidden="true" />
      </button>
    </section>
  );
}
```

`src/components/shell/ShareBanner.module.css`
```css
.banner {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 10px 16px;
  background: color-mix(in oklch, var(--accent) 14%, var(--surface-1));
  border-bottom: 1px solid color-mix(in oklch, var(--accent) 40%, var(--border));
}

.icon {
  flex: none;
  color: var(--accent);
}

.text {
  flex: 1 1 240px;
  margin: 0;
  font-size: 14px;
}

.muted {
  color: var(--text-muted);
}

.actions {
  display: flex;
  gap: 8px;
}

.primary,
.secondary {
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}

.primary {
  background: var(--accent);
  color: var(--on-accent);
}

.primary:hover {
  background: var(--accent-hover);
}

.secondary {
  border: 1px solid var(--border);
  background: var(--surface-2);
}

.close {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  color: var(--text-muted);
}

.close:hover {
  background: var(--surface-2);
  color: var(--text);
}

@media (pointer: coarse) {
  .primary,
  .secondary,
  .close {
    min-height: 44px;
  }
}
```

- [ ] 10. Create `src/components/shell/FilterChips.tsx` and `src/components/shell/FilterChips.module.css`:

`src/components/shell/FilterChips.tsx`
```tsx
import styles from "./FilterChips.module.css";
import { useData } from "../../data/index";
import { useStore } from "../../state/store";
import { activeFilterCount, signupLabel } from "../../domain/filters";
import { Chip } from "../ui/Chip";

interface ActiveChip {
  key: string;
  label: string;
  remove(): void;
}

export function FilterChips() {
  const { data, index } = useData();
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const clearFilters = useStore((s) => s.clearFilters);
  const toggleFacetValue = useStore((s) => s.toggleFacetValue);

  if (activeFilterCount(filters) === 0) return null;

  const chips: ActiveChip[] = [];
  for (const id of filters.types) {
    chips.push({ key: `types-${id}`, label: index.typeById.get(id)?.name ?? String(id), remove: () => toggleFacetValue("types", id) });
  }
  for (const id of filters.locations) {
    chips.push({ key: `locations-${id}`, label: index.locationById.get(id)?.short ?? String(id), remove: () => toggleFacetValue("locations", id) });
  }
  for (const id of filters.themes) {
    chips.push({ key: `themes-${id}`, label: index.themeById.get(id)?.name ?? String(id), remove: () => toggleFacetValue("themes", id) });
  }
  for (const id of filters.brands) {
    chips.push({ key: `brands-${id}`, label: index.brandById.get(id)?.name ?? String(id), remove: () => toggleFacetValue("brands", id) });
  }
  for (const status of filters.signup) {
    chips.push({ key: `signup-${status}`, label: signupLabel(status, data), remove: () => toggleFacetValue("signup", status) });
  }
  if (filters.query.trim().length > 0) {
    chips.push({ key: "query", label: `Szukaj: „${filters.query}”`, remove: () => setFilters({ query: "" }) });
  }
  if (filters.onlyFavourites) {
    chips.push({ key: "onlyFavourites", label: "Tylko ulubione", remove: () => setFilters({ onlyFavourites: false }) });
  }
  if (filters.hideAllDay) {
    chips.push({ key: "hideAllDay", label: "Ukryj strefy całodniowe", remove: () => setFilters({ hideAllDay: false }) });
  }

  return (
    <div className={styles.row} role="group" aria-label="Aktywne filtry">
      {chips.map((chip) => (
        <Chip key={chip.key} tone="accent" onRemove={chip.remove}>
          {chip.label}
        </Chip>
      ))}
      <button type="button" className={styles.clear} onClick={clearFilters}>
        Wyczyść wszystko
      </button>
    </div>
  );
}
```

`src/components/shell/FilterChips.module.css`
```css
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  scrollbar-width: none;
}

.row::-webkit-scrollbar {
  display: none;
}

.clear {
  flex: none;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  white-space: nowrap;
}

.clear:hover {
  color: var(--text);
  background: var(--surface-2);
}

@media (max-width: 699.98px) {
  .row {
    padding: 8px 12px;
  }
}

@media (pointer: coarse) {
  .clear {
    min-height: 36px;
  }
}
```

- [ ] 11. Create `src/components/shell/Toasts.tsx` and `src/components/shell/Toasts.module.css`:

`src/components/shell/Toasts.tsx`
```tsx
import { useEffect } from "react";
import { X } from "lucide-react";
import styles from "./Toasts.module.css";
import { useStore } from "../../state/store";

const PLAIN_MS = 3000;
const WITH_ACTION_MS = 6000;

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismissToast = useStore((s) => s.dismissToast);
  const current = toasts[0];
  const currentId = current?.id;
  const hasAction = current?.action !== undefined;

  useEffect(() => {
    if (currentId === undefined) return;
    const timer = window.setTimeout(() => dismissToast(currentId), hasAction ? WITH_ACTION_MS : PLAIN_MS);
    return () => window.clearTimeout(timer);
  }, [currentId, hasAction, dismissToast]);

  return (
    <div className={styles.region} role="status" aria-live="polite">
      {current && (
        <div className={styles.toast} key={current.id}>
          <span className={styles.text}>{current.text}</span>
          {current.action && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                current.action?.run();
                dismissToast(current.id);
              }}
            >
              {current.action.label}
            </button>
          )}
          <button type="button" className={styles.close} aria-label="Zamknij powiadomienie" onClick={() => dismissToast(current.id)}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
```

`src/components/shell/Toasts.module.css`
```css
.region {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  z-index: 120;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(480px, calc(100vw - 32px));
  padding: 10px 10px 10px 16px;
  border-radius: var(--radius-sheet);
  background: var(--surface-2);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-2);
  font-size: 14px;
  pointer-events: auto;
}

.text {
  flex: 1;
}

.action {
  flex: none;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 13px;
  font-weight: 600;
}

.action:hover {
  background: var(--accent-hover);
}

.close {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  color: var(--text-muted);
}

.close:hover {
  color: var(--text);
  background: var(--surface-1);
}

[data-tier="mobile"] .region {
  bottom: calc(var(--bottombar-height) + 12px + env(safe-area-inset-bottom, 0px));
}

@media (prefers-reduced-motion: no-preference) {
  .toast {
    animation: toastIn 180ms ease-out;
  }
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
```

- [ ] 12. Create `src/components/shell/TopBar.tsx` and `src/components/shell/TopBar.module.css`:

`src/components/shell/TopBar.tsx`
```tsx
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
```

`src/components/shell/TopBar.module.css`
```css
.bar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: var(--topbar-height);
  padding: 8px 16px;
  background: var(--surface-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  isolation: isolate;
}

.bar::before {
  content: "";
  position: absolute;
  inset: -40px 0 0;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(60% 140% at 18% 0%, oklch(70% 0.2 45 / var(--glow-opacity)), transparent 70%);
}

.mark {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

.wordmark {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 18px;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.spacer {
  flex: 1;
}

.search {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 1 260px;
  min-width: 120px;
  height: 36px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-muted);
}

.search:focus-within {
  border-color: var(--accent);
  color: var(--text);
}

.input {
  flex: 1;
  min-width: 0;
  background: none;
  border: 0;
  outline: none;
  color: var(--text);
  font-size: 14px;
}

.input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}

.inputClose {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  color: var(--text-muted);
}

.button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  height: 36px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.button:hover {
  border-color: var(--text-muted);
}

.icon {
  width: 36px;
  padding: 0;
  justify-content: center;
}

.badge {
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: var(--text-min);
  font-weight: 700;
}

.live {
  flex: none;
  display: flex;
}

.live:empty {
  display: none;
}

@media (max-width: 1099.98px) {
  .bar {
    flex-wrap: wrap;
  }
}

@media (max-width: 699.98px) {
  .bar {
    flex-wrap: nowrap;
    gap: 8px;
    padding: 8px 12px;
  }

  .wordmark {
    display: none;
  }

  .search {
    flex: 1 1 auto;
  }

  .button {
    min-height: 44px;
  }

  .bar[data-search-open="true"] .mark,
  .bar[data-search-open="true"] .widok,
  .bar[data-search-open="true"] .live {
    display: none;
  }
}
```

- [ ] 12a. Create `src/state/clock.ts` (the one place `createClock` is called; `main.tsx` and `App` share it):

```ts
import { createClock, type Clock } from "../domain/now";

/** App-wide clock: honours a `?now=` override through createClock and keeps ticking from that base. */
export const clock: Clock = createClock(window.location.search);
```

- [ ] 12b. Create seven placeholder modules so that typecheck, tests and the build stay green until Tasks 26–33 replace each file in place. Every placeholder is a named export that takes the contract props as a single `_props` parameter and returns `null`, except `PrintPlan`, which renders the `.print-plan` section that `src/test/shell.test.tsx` and `print.css` look for. The underscore prefix is what TypeScript exempts from `noUnusedParameters`, so the files compile whether or not that flag is on (Task 1's `tsconfig.json` sets only `strict`).

`src/components/grid/ScheduleGrid.tsx`
```tsx
import type { Column, DaySets, ResolvedTime } from "../../state/derive";

/** Placeholder, replaced in Task 26. */
export function ScheduleGrid(_props: { sets: DaySets; columns: Column[]; resolved: ResolvedTime; dayId: string }) {
  return null;
}
```

`src/components/list/ScheduleList.tsx`
```tsx
import type { ListGroup } from "../../state/derive";

/** The id the LiveChip scrolls to in list view; Task 29 places it on the first live or soon group. */
export const LIVE_GROUP_ID = "list-live";

/** Placeholder, replaced in Task 29. */
export function ScheduleList(_props: { groups: ListGroup[] }) {
  return null;
}
```

`src/components/plan/PlanView.tsx`
```tsx
/** Placeholder, replaced in Task 33. */
export function PlanView() {
  return null;
}
```

`src/components/plan/PrintPlan.tsx`
```tsx
/** Placeholder, replaced in Task 33. Keeps the `.print-plan` section that print.css and the App test rely on. */
export function PrintPlan() {
  return <section className="print-plan" aria-hidden="true" />;
}
```

`src/components/detail/DetailSheet.tsx`
```tsx
/** Placeholder, replaced in Task 32. */
export function DetailSheet() {
  return null;
}
```

`src/components/filters/FiltersPanel.tsx`
```tsx
/** Placeholder, replaced in Task 30. */
export function FiltersPanel(_props: { variant: "sidebar" | "sheet" }) {
  return null;
}
```

`src/components/settings/SettingsPanel.tsx`
```tsx
import type { RefObject } from "react";

/** Placeholder, replaced in Task 31. */
export function SettingsPanel(_props: {
  variant: "popover" | "sheet";
  anchorRef?: RefObject<HTMLElement | null>;
  open: boolean;
  onClose(): void;
}) {
  return null;
}
```

- [ ] 13. Create `src/App.tsx` and `src/App.module.css`:

`src/App.tsx`
```tsx
import { useEffect, useMemo } from "react";
import styles from "./App.module.css";
import { useData } from "./data/index";
import { usePlanSet, useStore } from "./state/store";
import { clock } from "./state/clock";
import { buildColumns, daySets, listGroups, resolveTimeMode } from "./state/derive";
import { useTier } from "./state/useMediaQuery";
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

/** Spec §8: fixed full-page feTurbulence grain at 4 % opacity, skipped on mobile by the caller. */
function Grain() {
  return (
    <svg className={styles.grain} aria-hidden="true" focusable="false">
      <filter id="app-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#app-grain)" />
    </svg>
  );
}

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
      {tier !== "mobile" && <Grain />}
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
```

`src/App.module.css`
```css
.app {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
}

.app[data-tier="mobile"] {
  padding-bottom: calc(var(--bottombar-height) + env(safe-area-inset-bottom, 0px));
}

.grain {
  position: fixed;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  opacity: 0.04;
  pointer-events: none;
}

.body {
  position: relative;
  z-index: 2;
  display: flex;
  flex: 1;
  min-height: 0;
}

.sidebar {
  flex: none;
  width: var(--sidebar-width);
  min-height: 0;
  overflow-y: auto;
  border-right: 1px solid var(--border);
  background: var(--surface-1);
}

.main {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.fade {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

@media (prefers-reduced-motion: no-preference) {
  .fade {
    animation: viewFade 160ms ease-out;
  }
}

@keyframes viewFade {
  from {
    opacity: 0;
  }
}
```

- [ ] 14. Create `src/main.tsx` (replacing any placeholder entry from the setup task):

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/print.css";
import App from "./App";
import { DataProvider, data, index, search } from "./data/index";
import { STORAGE_KEY, useStore, type SharedPlan, type View } from "./state/store";
import { resolveBoot } from "./state/boot";
import { clock } from "./state/clock";
import { parseHash, writeHash, type HashState } from "./state/hash";
import { applyTheme, watchSystemTheme } from "./state/theme";

const STORAGE_TOAST = "Nie mogę zapisać ulubionych w tej przeglądarce";

function isView(v: string | undefined): v is View {
  return v === "grid" || v === "list" || v === "plan";
}

/** The view persisted by Zustand's persist middleware, or null when nothing usable is stored. */
function readPersistedView(): View | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const state = (parsed as { state?: { view?: unknown } }).state;
    const view = state?.view;
    return typeof view === "string" && isView(view) ? view : null;
  } catch {
    return null;
  }
}

function boot(): void {
  const now = clock.now();
  const planParam = parseHash(window.location.hash).plan;
  const initial = useStore.getState();

  // resolveBoot keeps only the persisted favourites that exist in this snapshot and counts the rest.
  const resolved = resolveBoot({
    hash: window.location.hash,
    persistedView: readPersistedView(),
    persistedFavourites: initial.favourites,
    viewportWidth: window.innerWidth,
    data,
    index,
    now,
  });

  useStore.setState({
    day: resolved.day,
    view: resolved.view,
    sharedPlan: resolved.sharedPlan,
    favourites: resolved.favourites,
    now,
  });
  if (resolved.droppedFavourites > 0) {
    initial.pushToast(`Pominięto ${resolved.droppedFavourites} zapisanych wydarzeń, których nie ma w tej wersji harmonogramu`);
  }
  if (initial.storageFailed) initial.pushToast(STORAGE_TOAST);
  useStore.subscribe((state, previous) => {
    if (state.storageFailed && !previous.storageFailed) state.pushToast(STORAGE_TOAST);
  });

  // URL hash: written on every day / view / sharedPlan change; `plan` survives until the banner is answered.
  const hashFor = (state: { day: string; view: View; sharedPlan: SharedPlan | null }): HashState => ({
    d: state.day,
    v: state.view,
    plan: state.sharedPlan !== null && planParam !== undefined ? planParam : undefined,
  });
  writeHash(hashFor(useStore.getState()));
  useStore.subscribe((state, previous) => {
    if (state.day !== previous.day || state.view !== previous.view || state.sharedPlan !== previous.sharedPlan) {
      writeHash(hashFor(state));
    }
  });
  window.addEventListener("hashchange", () => {
    const hash = parseHash(window.location.hash);
    const state = useStore.getState();
    if (hash.d !== undefined && index.dayById.has(hash.d) && hash.d !== state.day) state.setDay(hash.d);
    if (isView(hash.v) && hash.v !== state.view) state.setView(hash.v);
  });

  // Theme: apply at boot, follow the system while "system" is selected, re-apply on every change.
  applyTheme(useStore.getState().settings.theme);
  watchSystemTheme(() => useStore.getState().settings.theme);
  useStore.subscribe((state, previous) => {
    if (state.settings.theme !== previous.settings.theme) applyTheme(state.settings.theme);
  });

  // Clock: `now` was set once above from the shared clock; App's effect advances it every 30 s.

  const root = document.getElementById("root");
  if (!root) throw new Error("Brak elementu #root w index.html");
  createRoot(root).render(
    <StrictMode>
      <DataProvider value={{ data, index, search }}>
        <App />
      </DataProvider>
    </StrictMode>,
  );
}

boot();
```

- [ ] 14a. Delete Task 1's smoke test, whose heading assertion no longer matches the shell (the `App` case in `src/test/shell.test.tsx` covers the mark, tabs, main area and print section instead):

```bash
git rm src/test/App.test.tsx
```

- [ ] 15. Run `npx vitest run src/test/shell.test.tsx` and confirm every test passes: 17 tests (2 DayTabs, 2 ViewSwitcher, 1 BottomBar, 4 LiveChip, 4 ShareBanner, 2 FilterChips, 1 Toasts, 1 App). The `App` case passes against the step 12b placeholders: the placeholder `PrintPlan` renders the `.print-plan` section it looks for, and every other placeholder renders nothing. If the `App` test fails with an import error, a placeholder from step 12b is missing or its named export does not match the import in `App.tsx` / `TopBar.tsx`; fix the placeholder.

- [ ] 16. Run the whole suite and the type check: `npm test` and `npm run typecheck`; both must be clean.

- [ ] 17. Run `npm run build` and open `dist/index.html` in a browser: the top bar shows the burst, "ŚwiatłoSiła 2026", the day tabs, Siatka/Lista/Mój plan, the search box, "Widok", the theme toggle; between 700 and 1100 px the Filtry button opens a 320 px sheet anchored to the left edge; narrowing the window under 700 px moves the day tabs to a second row and shows the bottom bar with Filtry, whose sheet rises from the bottom; `?now=2026-09-04T10:30` shows the "Teraz 10:30 · trwa N" chip on Friday and "Jutro od 09:00" on Saturday. The main area stays empty until Tasks 26–33 replace the placeholders.

- [ ] 18. Commit (`git add -A` stages the `App.test.tsx` deletion from step 14a together with the new files):

```bash
git add -A && git commit -F - <<'EOF'
feat(shell): add top bar, day tabs, view switcher, banners, toasts, App and entry point

TopBar with search, Widok and theme cycling; DayTabs with roving tabindex;
ViewSwitcher and BottomBar with plan and filter badges; LiveChip per spec
§7.1; ShareBanner with load / preview / dismiss; FilterChips with
"Wyczyść wszystko"; Toasts (aria-live, one at a time). App wires derive()
sets into the grid, list and plan views by tier and ticks the shared
clock; main.tsx boots data, hash, theme and storage toasts through the
new resolveBoot contract. Placeholder grid, list, plan, detail, filters
and settings modules keep the build green until their tasks land; the
Task 1 App smoke test is replaced by the shell App case.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2
EOF
```


### Task 24: Pure grid geometry (`gridLayout.ts`)

**Files:**
- Create: `src/components/grid/gridLayout.ts`
- Test: `src/components/grid/gridLayout.test.ts`

**Interfaces:**
- Consumes:
  - `src/data/types.ts`: `Session`, `TimedSession`, `hasStart(s: Session): s is TimedSession`, `ScheduleData`
  - `src/domain/time.ts`: `visualEnd(s: TimedSession): number`, `roundDown(m: number, step: number): number`, `roundUp(m: number, step: number): number`
  - `src/domain/slots.ts`: `Slot`, `detectSlots(sessions: TimedSession[], opts?: { tolerance?: number }): Slot[]`, `rowInterval(s: TimedSession, slots: Slot[], tolerance: number): [number, number]`, `spanAllowed(s: TimedSession, columnSessions: TimedSession[], slots: Slot[], tolerance: number): boolean`
  - `src/domain/overlaps.ts`: `packLanes(sessions: TimedSession[], minMinutes: number): Map<string, LaneInfo>`
  - `src/domain/lookup.ts`: `buildIndex(data)`, `primaryType(s, index)` (test only)
  - `src/state/store.ts`: `Settings` (type only)
  - `src/state/derive.ts`: `Column` (type only)
  - `src/test/fixtures/build.ts`: `makeSession`; `src/test/fixtures/fri-lectures.json`
- Produces (all from `src/components/grid/gridLayout.ts`):
  - `RAIL_WIDTH = 56`
  - `interface Density { minColumnWidth: number; laneMin: number; rowMin: number; minCardHeight: number }`
  - `densityFor(density: Settings["density"], coarsePointer: boolean): Density`
  - `interface TimelineRange { start: number; end: number }`, `timelineRange(layout: TimedSession[]): TimelineRange`
  - `interface CardGeometry { top: number; height: number; lane: number; lanes: number }`
  - `timelineGeometry(column: Column, range: TimelineRange, zoom: number, density: Density): { columnWidth: number; columnLanes: number; cards: Map<string, CardGeometry> }` — `columnWidth = max(density.minColumnWidth, columnLanes × density.laneMin)`; cards shorter than `density.minCardHeight` are stretched to it. Only Task 26 calls this function.
  - `cardStyle(g: CardGeometry): { top: string; height: string; left: string; width: string }`
  - `interface SlotPlacement { kind: "card" | "span" | "stub"; sessionId: string; column: number; row: number; span: number }`
  - `slotPlacements(column: Column, columnIndex: number, slots: Slot[], tolerance: number, renderedIds: Set<string>): SlotPlacement[]`
  - `gridArea(p: SlotPlacement): { gridColumn: string; gridRow: string }`
  - Internal helpers, exported for the grid components only: `MAX_STUBS = 3`, `interface SlotCell { column: number; row: number; stubs: SlotPlacement[]; overflow: number; cards: SlotPlacement[] }`, `slotCells(placements: SlotPlacement[]): SlotCell[]`, `sortByStartTitle(a: TimedSession, b: TimedSession): number`, `nowScrollTop(lineTop: number, viewportHeight: number): number`, `coarsePointer(): boolean`, `prefersReducedMotion(): boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/components/grid/gridLayout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ScheduleData, Session, TimedSession } from "../../data/types";
import { hasStart } from "../../data/types";
import { detectSlots } from "../../domain/slots";
import { buildIndex, primaryType } from "../../domain/lookup";
import type { Column } from "../../state/derive";
import { makeSession } from "../../test/fixtures/build";
import friLecturesJson from "../../test/fixtures/fri-lectures.json";
import {
  RAIL_WIDTH,
  MAX_STUBS,
  cardStyle,
  densityFor,
  gridArea,
  nowScrollTop,
  slotCells,
  slotPlacements,
  sortByStartTitle,
  timelineGeometry,
  timelineRange,
} from "./gridLayout";

const friLectures = friLecturesJson as unknown as ScheduleData;

function timed(overrides: Partial<Session>): TimedSession {
  const s = makeSession(overrides);
  if (!hasStart(s)) throw new Error("test session needs a start");
  return s;
}

function column(key: string, sessions: TimedSession[], rendered?: string[]): Column {
  return {
    key,
    label: key,
    sublabel: null,
    sessions,
    renderedIds: new Set(rendered ?? sessions.map((s) => s.id)),
    count: sessions.length,
  };
}

function columnsBy(sessions: TimedSession[], keyOf: (s: TimedSession) => string[]): Column[] {
  const map = new Map<string, TimedSession[]>();
  for (const s of sessions) {
    for (const k of keyOf(s)) {
      const list = map.get(k) ?? [];
      list.push(s);
      map.set(k, list);
    }
  }
  return [...map.entries()].map(([key, list]) => column(key, list));
}

describe("densityFor", () => {
  it("returns the comfortable numbers", () => {
    expect(densityFor("comfortable", false)).toEqual({ minColumnWidth: 200, laneMin: 180, rowMin: 88, minCardHeight: 44 });
  });
  it("returns the compact numbers", () => {
    expect(densityFor("compact", false)).toEqual({ minColumnWidth: 160, laneMin: 150, rowMin: 64, minCardHeight: 28 });
  });
  it("raises minCardHeight to 44 on a coarse pointer, keeping the other compact numbers", () => {
    expect(densityFor("compact", true)).toEqual({ minColumnWidth: 160, laneMin: 150, rowMin: 64, minCardHeight: 44 });
    expect(densityFor("comfortable", true).minCardHeight).toBe(44);
  });
  it("exposes the rail width", () => {
    expect(RAIL_WIDTH).toBe(56);
  });
});

describe("timelineRange", () => {
  it("rounds the earliest start down and the latest visual end up to the half hour, then pads 15 minutes", () => {
    const layout = [timed({ id: "1:pt", start: 575, end: 645 }), timed({ id: "2:pt", eventId: 2, start: 615, end: 680 })];
    expect(timelineRange(layout)).toEqual({ start: 555, end: 705 });
  });
  it("keeps exact half hours and still pads", () => {
    expect(timelineRange([timed({ start: 570, end: 630 })])).toEqual({ start: 555, end: 645 });
  });
  it("uses the 20-minute visual end of a point session", () => {
    expect(timelineRange([timed({ start: 570, end: null })])).toEqual({ start: 555, end: 615 });
  });
  it("returns an empty range for an empty layout", () => {
    expect(timelineRange([])).toEqual({ start: 0, end: 0 });
  });
});

describe("timelineGeometry", () => {
  const comfortable = densityFor("comfortable", false);
  const compact = densityFor("compact", false);

  it("gives a 60-minute card a height of 60 × zoom and a top relative to the range start", () => {
    const s = timed({ id: "1:pt", start: 600, end: 660 });
    const g = timelineGeometry(column("c", [s]), { start: 585, end: 705 }, 2, comfortable);
    expect(g.cards.get("1:pt")).toEqual({ top: 30, height: 120, lane: 0, lanes: 1 });
    expect(g.columnLanes).toBe(1);
    expect(g.columnWidth).toBe(200);
  });

  it("uses minColumnWidth for a one-lane column in compact density", () => {
    const s = timed({ id: "1:pt", start: 600, end: 660 });
    expect(timelineGeometry(column("c", [s]), { start: 585, end: 705 }, 2, compact).columnWidth).toBe(160);
  });

  it("gives an 8-lane column a width of 8 × laneMin and 1/8 widths, while a 2-lane component in the same column keeps lanes = 2", () => {
    const eight = Array.from({ length: 8 }, (_, i) => timed({ id: `${i + 1}:pt`, eventId: i + 1, title: `S${i}`, start: 600, end: 660 }));
    const two = [timed({ id: "21:pt", eventId: 21, start: 840, end: 900 }), timed({ id: "22:pt", eventId: 22, start: 840, end: 900 })];
    const g = timelineGeometry(column("c", [...eight, ...two]), { start: 585, end: 915 }, 2, comfortable);
    expect(g.columnLanes).toBe(8);
    expect(g.columnWidth).toBe(1440);
    expect(timelineGeometry(column("c", [...eight, ...two]), { start: 585, end: 915 }, 2, compact).columnWidth).toBe(1200);
    for (const s of eight) expect(g.cards.get(s.id)?.lanes).toBe(8);
    expect(new Set(eight.map((s) => g.cards.get(s.id)?.lane)).size).toBe(8);
    expect(g.cards.get("21:pt")?.lanes).toBe(2);
    expect(g.cards.get("22:pt")?.lanes).toBe(2);
    expect(new Set([g.cards.get("21:pt")?.lane, g.cards.get("22:pt")?.lane])).toEqual(new Set([0, 1]));
  });

  it("stretches short cards to minCardHeight and packs with minMinutes = ceil(minCardHeight / zoom)", () => {
    const point = timed({ id: "1:pt", start: 600, end: null });
    const next = timed({ id: "2:pt", eventId: 2, start: 630, end: 700 });
    const slow = timelineGeometry(column("c", [point, next]), { start: 585, end: 735 }, 1.2, comfortable);
    // ceil(44 / 1.2) = 37 → the point's packing end 637 collides with 630, so both share a two-lane component
    expect(slow.cards.get("1:pt")).toEqual({ top: 18, height: 44, lane: 0, lanes: 2 });
    expect(slow.cards.get("2:pt")?.lanes).toBe(2);
    expect(slow.columnWidth).toBe(360);
    const fast = timelineGeometry(column("c", [point, next]), { start: 585, end: 735 }, 4, comfortable);
    // ceil(44 / 4) = 11 → packing end 620 < 630, separate components
    expect(fast.cards.get("1:pt")).toEqual({ top: 60, height: 80, lane: 0, lanes: 1 });
    expect(fast.cards.get("2:pt")?.lanes).toBe(1);
  });
});

describe("cardStyle", () => {
  it("writes px offsets and calc() lane fractions exactly as spec §7.2", () => {
    expect(cardStyle({ top: 90, height: 120, lane: 3, lanes: 8 })).toEqual({
      top: "90px",
      height: "120px",
      left: "calc(3 * 100% / 8)",
      width: "calc(100% / 8)",
    });
    expect(cardStyle({ top: 0, height: 44, lane: 0, lanes: 1 })).toEqual({
      top: "0px",
      height: "44px",
      left: "calc(0 * 100% / 1)",
      width: "calc(100% / 1)",
    });
  });
});

describe("slotPlacements on the synthetic spec §10 case", () => {
  const A = timed({ id: "1:pt", eventId: 1, title: "A", start: 570, end: 645 }); // 09:30–10:45
  const B = timed({ id: "2:pt", eventId: 2, title: "B", start: 615, end: 690 }); // 10:15–11:30
  const C = timed({ id: "3:pt", eventId: 3, title: "C", start: 660, end: 735 }); // 11:00–12:15
  const slots = detectSlots([A, B, C], { tolerance: 15 });

  it("detects three rows", () => {
    expect(slots.map((s) => s.start)).toEqual([570, 615, 660]);
  });

  it("confines the first two with one stub each and gives the third a bare card", () => {
    const col = column("all", [A, B, C]);
    expect(slotPlacements(col, 0, slots, 15, col.renderedIds)).toEqual([
      { kind: "card", sessionId: "1:pt", column: 0, row: 0, span: 1 },
      { kind: "stub", sessionId: "1:pt", column: 0, row: 1, span: 1 },
      { kind: "card", sessionId: "2:pt", column: 0, row: 1, span: 1 },
      { kind: "stub", sessionId: "2:pt", column: 0, row: 2, span: 1 },
      { kind: "card", sessionId: "3:pt", column: 0, row: 2, span: 1 },
    ]);
  });

  it("emits nothing for layout-set sessions outside the rendered set but lets them block spanning", () => {
    const col = column("all", [A, B, C], ["1:pt"]);
    expect(slotPlacements(col, 0, slots, 15, col.renderedIds)).toEqual([
      { kind: "card", sessionId: "1:pt", column: 0, row: 0, span: 1 },
      { kind: "stub", sessionId: "1:pt", column: 0, row: 1, span: 1 },
    ]);
  });

  it("spans when the column holds no intersecting interval", () => {
    const col = column("solo", [A]);
    expect(slotPlacements(col, 2, slots, 15, col.renderedIds)).toEqual([
      { kind: "span", sessionId: "1:pt", column: 2, row: 0, span: 2 },
    ]);
  });

  it("groups placements per cell with stubs before cards and caps stubs at three", () => {
    const long = Array.from({ length: 5 }, (_, i) => timed({ id: `${10 + i}:pt`, eventId: 10 + i, title: `L${i}`, start: 600, end: 690 }));
    const D = timed({ id: "20:pt", eventId: 20, title: "D", start: 630, end: 645 });
    const E = timed({ id: "21:pt", eventId: 21, title: "E", start: 660, end: 675 });
    const all = [...long, D, E];
    const rows = detectSlots(all, { tolerance: 15 });
    expect(rows.map((r) => r.start)).toEqual([600, 630, 660]);
    const cells = slotCells(slotPlacements(column("all", all), 0, rows, 15, new Set(all.map((s) => s.id))));
    expect(cells.map((c) => [c.column, c.row])).toEqual([[0, 0], [0, 1], [0, 2]]);
    expect(cells[0]).toMatchObject({ overflow: 0, stubs: [] });
    expect(cells[0].cards.map((p) => p.sessionId)).toEqual(["10:pt", "11:pt", "12:pt", "13:pt", "14:pt"]);
    expect(cells[1].stubs).toHaveLength(MAX_STUBS);
    expect(cells[1].stubs.map((p) => p.sessionId)).toEqual(["10:pt", "11:pt", "12:pt"]);
    expect(cells[1].overflow).toBe(2);
    expect(cells[1].cards.map((p) => p.sessionId)).toEqual(["20:pt"]);
    expect(cells[2]).toMatchObject({ overflow: 2 });
    expect(cells[2].cards.map((p) => p.sessionId)).toEqual(["21:pt"]);
  });

  it("orders sessions by start then title with Polish collation", () => {
    const x = timed({ id: "1:pt", title: "Światło", start: 600, end: 660 });
    const y = timed({ id: "2:pt", eventId: 2, title: "Zima", start: 600, end: 660 });
    const z = timed({ id: "3:pt", eventId: 3, title: "Anatomia", start: 590, end: 660 });
    expect([y, x, z].sort(sortByStartTitle).map((s) => s.id)).toEqual(["3:pt", "1:pt", "2:pt"]);
  });
});

describe("slotPlacements on the fri-lectures fixture", () => {
  const index = buildIndex(friLectures);
  const layout = friLectures.sessions.filter(hasStart).filter((s) => !s.allDay);
  const slots = detectSlots(layout, { tolerance: 15 });

  it("has 13 rows with 13:20 at row 3 and 13:40 at row 4", () => {
    expect(layout).toHaveLength(27);
    expect(slots).toHaveLength(13);
    expect(slots[3]).toMatchObject({ start: 800, lastStart: 800 });
    expect(slots[4]).toMatchObject({ start: 820, lastStart: 830 });
  });

  it("confines the 13:20–14:20 lecture under the type axis with a stub in the 13:40 row", () => {
    const columns = columnsBy(layout, (s) => [primaryType(s, index)?.name ?? "?"]);
    const prelekcja = columns.findIndex((c) => c.key === "Prelekcja");
    expect(prelekcja).toBeGreaterThanOrEqual(0);
    const placements = slotPlacements(columns[prelekcja], prelekcja, slots, 15, columns[prelekcja].renderedIds);
    const mine = placements.filter((p) => p.sessionId === "39564:pt");
    expect(mine).toEqual([
      { kind: "card", sessionId: "39564:pt", column: prelekcja, row: 3, span: 1 },
      { kind: "stub", sessionId: "39564:pt", column: prelekcja, row: 4, span: 1 },
    ]);
  });

  it("lets every spanning session span under the location axis, including 13:20–14:20 over two rows", () => {
    const columns = columnsBy(layout, (s) => s.locationIds.map(String));
    const all = columns.flatMap((c, i) => slotPlacements(c, i, slots, 15, c.renderedIds));
    expect(all.filter((p) => p.kind === "stub")).toHaveLength(0);
    const room = columns.findIndex((c) => c.key === "279");
    expect(all.find((p) => p.sessionId === "39564:pt")).toEqual({ kind: "span", sessionId: "39564:pt", column: room, row: 3, span: 2 });
    expect(all.filter((p) => p.kind === "span")).toHaveLength(9);
  });

  it("keeps the confinement when only that card is rendered", () => {
    const columns = columnsBy(layout, (s) => [primaryType(s, index)?.name ?? "?"]);
    const col = columns.find((c) => c.key === "Prelekcja");
    if (!col) throw new Error("missing Prelekcja column");
    const placements = slotPlacements(col, 0, slots, 15, new Set(["39564:pt"]));
    expect(placements).toEqual([
      { kind: "card", sessionId: "39564:pt", column: 0, row: 3, span: 1 },
      { kind: "stub", sessionId: "39564:pt", column: 0, row: 4, span: 1 },
    ]);
  });

  it("places each session at most once per column as a card", () => {
    const columns = columnsBy(layout, () => ["all"]);
    const placements = slotPlacements(columns[0], 0, slots, 15, columns[0].renderedIds);
    const cards = placements.filter((p) => p.kind !== "stub").map((p) => p.sessionId);
    expect(new Set(cards).size).toBe(cards.length);
    expect(cards).toHaveLength(27);
  });
});

describe("gridArea", () => {
  it("offsets column and row by two", () => {
    expect(gridArea({ kind: "card", sessionId: "x", column: 1, row: 2, span: 1 })).toEqual({ gridColumn: "3", gridRow: "4" });
    expect(gridArea({ kind: "stub", sessionId: "x", column: 0, row: 0, span: 1 })).toEqual({ gridColumn: "2", gridRow: "2" });
  });
  it("writes 'r / span k' for spanning cards", () => {
    expect(gridArea({ kind: "span", sessionId: "x", column: 0, row: 3, span: 2 })).toEqual({ gridColumn: "2", gridRow: "5 / span 2" });
  });
});

describe("nowScrollTop", () => {
  it("puts the line a third of the way down the viewport, never above zero", () => {
    expect(nowScrollTop(600, 900)).toBe(300);
    expect(nowScrollTop(100, 900)).toBe(0);
    expect(nowScrollTop(0, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/grid/gridLayout.test.ts`

Expected: the run fails with `Error: Failed to resolve import "./gridLayout"` (the module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/components/grid/gridLayout.ts`:

```ts
import type { TimedSession } from "../../data/types";
import type { Slot } from "../../domain/slots";
import { rowInterval, spanAllowed } from "../../domain/slots";
import { packLanes } from "../../domain/overlaps";
import { roundDown, roundUp, visualEnd } from "../../domain/time";
import type { Settings } from "../../state/store";
import type { Column } from "../../state/derive";

export const RAIL_WIDTH = 56;

/** Internal: padding added on both sides of the timeline range (spec §7.2). */
const RANGE_PADDING = 15;
/** Internal: rounding step of the timeline range, in minutes. */
const RANGE_STEP = 30;
/** Internal, used by SlotBody: stubs shown per cell before "+N w trakcie". */
export const MAX_STUBS = 3;

export interface Density {
  minColumnWidth: number;
  laneMin: number;
  rowMin: number;
  minCardHeight: number;
}

const COMFORTABLE: Density = { minColumnWidth: 200, laneMin: 180, rowMin: 88, minCardHeight: 44 };
const COMPACT: Density = { minColumnWidth: 160, laneMin: 150, rowMin: 64, minCardHeight: 28 };

export function densityFor(density: Settings["density"], coarsePointer: boolean): Density {
  const base = density === "compact" ? COMPACT : COMFORTABLE;
  return coarsePointer ? { ...base, minCardHeight: 44 } : { ...base };
}

/** Internal: true when the primary pointer is coarse; false when matchMedia is unavailable (jsdom). */
export function coarsePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

/** Internal: true when the user asked for reduced motion; false when matchMedia is unavailable. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface TimelineRange {
  start: number;
  end: number;
}

export function timelineRange(layout: TimedSession[]): TimelineRange {
  if (layout.length === 0) return { start: 0, end: 0 };
  let earliest = Number.POSITIVE_INFINITY;
  let latest = Number.NEGATIVE_INFINITY;
  for (const s of layout) {
    earliest = Math.min(earliest, s.start);
    latest = Math.max(latest, visualEnd(s));
  }
  return {
    start: roundDown(earliest, RANGE_STEP) - RANGE_PADDING,
    end: roundUp(latest, RANGE_STEP) + RANGE_PADDING,
  };
}

export interface CardGeometry {
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

export function timelineGeometry(
  column: Column,
  range: TimelineRange,
  zoom: number,
  density: Density,
): { columnWidth: number; columnLanes: number; cards: Map<string, CardGeometry> } {
  const minMinutes = Math.ceil(density.minCardHeight / zoom);
  const lanes = packLanes(column.sessions, minMinutes);
  const cards = new Map<string, CardGeometry>();
  let columnLanes = 0;
  for (const s of column.sessions) {
    const info = lanes.get(s.id) ?? { lane: 0, lanes: 1 };
    columnLanes = Math.max(columnLanes, info.lanes);
    cards.set(s.id, {
      top: (s.start - range.start) * zoom,
      height: Math.max((visualEnd(s) - s.start) * zoom, density.minCardHeight),
      lane: info.lane,
      lanes: info.lanes,
    });
  }
  const columnWidth = Math.max(density.minColumnWidth, columnLanes * density.laneMin);
  return { columnWidth, columnLanes, cards };
}

export function cardStyle(g: CardGeometry): { top: string; height: string; left: string; width: string } {
  return {
    top: `${g.top}px`,
    height: `${g.height}px`,
    left: `calc(${g.lane} * 100% / ${g.lanes})`,
    width: `calc(100% / ${g.lanes})`,
  };
}

/** Internal, used by TimelineBody and SlotBody: DOM order inside a column follows start time, then title. */
export function sortByStartTitle(a: TimedSession, b: TimedSession): number {
  return a.start - b.start || a.title.localeCompare(b.title, "pl");
}

export interface SlotPlacement {
  kind: "card" | "span" | "stub";
  sessionId: string;
  column: number;
  row: number;
  span: number;
}

export function slotPlacements(
  column: Column,
  columnIndex: number,
  slots: Slot[],
  tolerance: number,
  renderedIds: Set<string>,
): SlotPlacement[] {
  const out: SlotPlacement[] = [];
  const ordered = [...column.sessions].sort(sortByStartTitle);
  for (const s of ordered) {
    if (!renderedIds.has(s.id)) continue;
    const [startRow, endRow] = rowInterval(s, slots, tolerance);
    if (startRow < 0) continue;
    const span = endRow - startRow;
    if (span > 1 && spanAllowed(s, column.sessions, slots, tolerance)) {
      out.push({ kind: "span", sessionId: s.id, column: columnIndex, row: startRow, span });
      continue;
    }
    out.push({ kind: "card", sessionId: s.id, column: columnIndex, row: startRow, span: 1 });
    for (let row = startRow + 1; row < endRow; row += 1) {
      out.push({ kind: "stub", sessionId: s.id, column: columnIndex, row, span: 1 });
    }
  }
  return out;
}

/** Internal, used by SlotBody: one entry per (column, row) wrapper with content; spans are not cells. */
export interface SlotCell {
  column: number;
  row: number;
  stubs: SlotPlacement[];
  overflow: number;
  cards: SlotPlacement[];
}

export function slotCells(placements: SlotPlacement[]): SlotCell[] {
  const byKey = new Map<string, SlotCell>();
  const allStubs = new Map<string, number>();
  for (const p of placements) {
    if (p.kind === "span") continue;
    const key = `${p.column}:${p.row}`;
    let cell = byKey.get(key);
    if (!cell) {
      cell = { column: p.column, row: p.row, stubs: [], overflow: 0, cards: [] };
      byKey.set(key, cell);
    }
    if (p.kind === "stub") {
      const seen = (allStubs.get(key) ?? 0) + 1;
      allStubs.set(key, seen);
      if (seen <= MAX_STUBS) cell.stubs.push(p);
      else cell.overflow += 1;
    } else {
      cell.cards.push(p);
    }
  }
  return [...byKey.values()].sort((a, b) => a.column - b.column || a.row - b.row);
}

export function gridArea(p: SlotPlacement): { gridColumn: string; gridRow: string } {
  const gridColumn = String(p.column + 2);
  const startRow = p.row + 2;
  const gridRow = p.kind === "span" ? `${startRow} / span ${p.span}` : String(startRow);
  return { gridColumn, gridRow };
}

/** Internal, used by ScheduleGrid: scrollTop that puts the now line a third of the way down the viewport. */
export function nowScrollTop(lineTop: number, viewportHeight: number): number {
  return Math.max(0, Math.round(lineTop - viewportHeight / 3));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/grid/gridLayout.test.ts` — expected: all 27 tests pass.

Run: `npm run typecheck` — expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/grid/gridLayout.ts src/components/grid/gridLayout.test.ts
git commit -m "feat(grid): add pure timeline and slot geometry" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```


### Task 25: SessionCard and ContinuationStub

**Files:**
- Create: `src/components/grid/SessionCard.tsx`
- Create: `src/components/grid/SessionCard.module.css`
- Create: `src/components/grid/ContinuationStub.tsx`
- Create: `src/components/grid/ContinuationStub.module.css`
- Test: `src/test/SessionCard.test.tsx`

**Interfaces:**
- Consumes:
  - `src/data/index.tsx`: `useData(): AppData` (`{ data, index, search }`), and in tests `DataProvider({ value, children })`, `buildAppData(data: ScheduleData): AppData`.
  - `src/data/types.ts`: `Session`, `TimedSession`, `hasStart(s)`.
  - `src/domain/colors.ts`: `hueFor(s: Session, colorBy: ColorBy, index: DataIndex): Hue` (`{ hue, chroma }`, chroma `0` = neutral, `0.16` chromatic).
  - `src/domain/lookup.ts`: `locationLabel(s, index): string`, `speakersOf(s, index): Speaker[]`.
  - `src/domain/now.ts`: `nowFor(day: Day, now: Date): number | null`, `liveState(s, nowMinutes): "past" | "live" | "soon" | "upcoming"`.
  - `src/domain/overlaps.ts`: `conflictCount(s: Session, planSessions: Session[]): number`.
  - `src/domain/plan.ts`: `planSessions(planSet: ReadonlySet<string>, sessions: Session[]): Session[]`.
  - `src/domain/time.ts`: `formatRange(start, end)`, `formatTime(m)`, `isPoint(s)`, `visualEnd(s: TimedSession)`.
  - `src/state/store.ts`: `useStore` (`settings.colorBy`, `settings.showAvatars`, `now`, `previewPlan`, `toggleFavourite(id)`, `selectSession(id)` — which itself sets `openSheet` to `"detail"`), `usePlanSet()`, `defaultSettings(width)`; in tests also `STORAGE_KEY` and `useStore.persist.rehydrate()`.
  - `src/components/ui/Star.tsx`: `Star({ pressed, onToggle, size? })`; `src/components/ui/Avatar.tsx`: `Avatar({ name, src, size?, hue? })`; `src/components/ui/cx.ts`: `cx(...)`.
  - `src/test/fixtures/build.ts`: `makeSession`, `makeData`, `makeSpeaker`.
  - `src/components/shell/ViewSwitcher.tsx` (Task 23): `ViewSwitcher()` — rendered in tests next to a card to check the Mój plan badge.
- Produces:
  - `SessionCard({ session: Session; compact?: boolean; showLocation: boolean; style?: CSSProperties; variant: "grid" | "row" | "chip" })` — an `<article data-session-id data-size="xs"|"sm"|"md" data-live=<LiveState> data-in-plan?="true" data-point?="true">` holding exactly two sibling controls: `<button class="card__main …">` (phrasing content only) and, unless a shared plan is previewed, the `Star` inside a positioning `<span class="starSlot">`. The primary button's `aria-label` and `title` are `"title, time, location[, Zapisy|Brak miejsc]"` with empty parts omitted. The colour edge comes from inline `--card-h` / `--card-c`. The conflict badge carries `data-conflicts=<n>`. Speakers: up to three avatars while `settings.showAvatars` is on; when it is off the `row` variant shows the names joined by `", "` in a muted `span.speakerNames` (spec §7.4) and the other variants show no speakers.
  - `ContinuationStub({ session: TimedSession })` — `<div aria-hidden="true" data-stub data-session-id>` with the colour edge, a one-line muted title and `"do HH:MM"`; click opens the detail.

- [ ] **Step 1: Write the failing test**

Create `src/test/SessionCard.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataProvider, buildAppData } from "../data/index";
import type { Session, TimedSession } from "../data/types";
import { hasStart } from "../data/types";
import { EMPTY_FILTERS } from "../domain/filters";
import { STORAGE_KEY, defaultSettings, useStore } from "../state/store";
import { SessionCard } from "../components/grid/SessionCard";
import { ContinuationStub } from "../components/grid/ContinuationStub";
import { ViewSwitcher } from "../components/shell/ViewSwitcher";
import { makeData, makeSession, makeSpeaker } from "./fixtures/build";

const talk = makeSession({
  id: "1:pt",
  eventId: 1,
  title: "Światło w studiu",
  start: 600,
  end: 660,
  speakerIds: [100, 101, 102, 103],
  signup: { status: "open", url: "https://www.cyfrowe.pl/zapisy", label: "Zapisy" },
});
const second = makeSession({ id: "2:pt", eventId: 2, title: "Druga", start: 630, end: 690 });
const third = makeSession({ id: "3:pt", eventId: 3, title: "Trzecia", start: 645, end: 675 });
const noTime = makeSession({ id: "4:pt", eventId: 4, title: "Bez godziny sesja", start: null, end: null });
const full = makeSession({
  id: "5:pt",
  eventId: 5,
  title: "Pełne",
  start: 720,
  end: 780,
  signup: { status: "full", url: null, label: "Brak miejsc" },
});
const earlier = makeSession({ id: "6:pt", eventId: 6, title: "Wcześniej", start: 540, end: 570 });
const soon = makeSession({ id: "7:pt", eventId: 7, title: "Zaraz", start: 640, end: 700 });
const point = makeSession({ id: "8:pt", eventId: 8, title: "Otwarcie", start: 570, end: null });

const speakers = [100, 101, 102, 103].map((id) => makeSpeaker({ id, slug: `osoba-${id}`, name: `Anna Nr${id}` }));
const appData = buildAppData(makeData([talk, second, third, noTime, full, earlier, soon, point], { speakers }));

function wrap(node: ReactNode) {
  return <DataProvider value={appData}>{node}</DataProvider>;
}

function timed(s: Session): TimedSession {
  if (!hasStart(s)) throw new Error("test session needs a start");
  return s;
}

function article(id: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`article[data-session-id="${id}"]`);
  if (!el) throw new Error(`missing card ${id}`);
  return el;
}

beforeEach(() => {
  // persistence starts clean for every test; the store's persist middleware writes through setState
  localStorage.clear();
  useStore.setState({
    day: "pt",
    view: "grid",
    filters: { ...EMPTY_FILTERS },
    settings: defaultSettings(1024),
    favourites: [],
    selectedSessionId: null,
    openSheet: null,
    sharedPlan: null,
    previewPlan: null,
    now: new Date(2026, 8, 4, 10, 30),
    toasts: [],
    copyText: null,
  });
});

describe("SessionCard", () => {
  it("is an article with a primary button that nests no other control and a sibling star", () => {
    render(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    const main = screen.getByRole("button", { name: "Światło w studiu, 10:00–11:00, Sala wykł. 1, Zapisy" });
    expect(main.classList.contains("card__main")).toBe(true);
    expect(main.getAttribute("title")).toBe("Światło w studiu, 10:00–11:00, Sala wykł. 1, Zapisy");
    expect(within(main).queryAllByRole("button")).toHaveLength(0);
    const card = article("1:pt");
    expect(main.parentElement).toBe(card);
    expect(card.querySelectorAll("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Do planu" }).closest("article")).toBe(card);
  });

  it("shows the location, at most three avatars and the Zapisy badge", () => {
    render(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    expect(screen.getByText("Sala wykł. 1")).not.toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.getByText("Zapisy")).not.toBeNull();
  });

  it("shows Brak miejsc for a full session", () => {
    render(wrap(<SessionCard session={full} variant="grid" showLocation />));
    expect(screen.getByRole("button", { name: "Pełne, 12:00–13:00, Sala wykł. 1, Brak miejsc" })).not.toBeNull();
    expect(screen.getByText("Brak miejsc")).not.toBeNull();
  });

  it("adds no badge for the other signup statuses", () => {
    render(wrap(<SessionCard session={second} variant="grid" showLocation />));
    expect(screen.getByRole("button", { name: "Druga, 10:30–11:30, Sala wykł. 1" })).not.toBeNull();
    expect(screen.queryByText("Zapisy")).toBeNull();
    expect(screen.queryByText("Brak miejsc")).toBeNull();
  });

  it("hides the location under the location axis and the avatars when the setting is off", () => {
    useStore.setState({ settings: { ...defaultSettings(1024), showAvatars: false } });
    render(wrap(<SessionCard session={talk} variant="grid" showLocation={false} />));
    expect(screen.queryByText("Sala wykł. 1")).toBeNull();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    // the accessible name keeps the location even when it is not painted
    expect(screen.getByRole("button", { name: "Światło w studiu, 10:00–11:00, Sala wykł. 1, Zapisy" })).not.toBeNull();
  });

  it("row variant shows speaker names when avatars are off", () => {
    useStore.setState({ settings: { ...defaultSettings(1024), showAvatars: false } });
    const { rerender } = render(wrap(<SessionCard session={talk} variant="row" showLocation />));
    expect(screen.getByText("Anna Nr100, Anna Nr101, Anna Nr102, Anna Nr103")).not.toBeNull();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(document.querySelector("img")).toBeNull();
    // the other variants keep showing no speakers while avatars are off
    rerender(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    expect(screen.queryByText("Anna Nr100, Anna Nr101, Anna Nr102, Anna Nr103")).toBeNull();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("toggles the favourite through the store and flips aria-pressed", async () => {
    const user = userEvent.setup();
    render(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    const star = screen.getByRole("button", { name: "Do planu" });
    expect(star.getAttribute("aria-pressed")).toBe("false");
    expect(article("1:pt").getAttribute("data-in-plan")).toBeNull();
    await user.click(star);
    expect(useStore.getState().favourites).toEqual(["1:pt"]);
    expect(screen.getByRole("button", { name: "Do planu" }).getAttribute("aria-pressed")).toBe("true");
    expect(article("1:pt").getAttribute("data-in-plan")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Do planu" }));
    expect(useStore.getState().favourites).toEqual([]);
  });

  it("star toggle updates the Mój plan badge and persists across rehydrate", async () => {
    const user = userEvent.setup();
    render(
      wrap(
        <>
          <ViewSwitcher />
          <SessionCard session={talk} variant="grid" showLocation />
        </>,
      ),
    );
    const planButton = () => screen.getByRole("button", { name: /Mój plan/ });
    expect(within(planButton()).queryByText(/^\d+$/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Do planu" }));
    expect(within(planButton()).getByText("1")).not.toBeNull();
    // The persist middleware writes through every setState (the reset below included), so the
    // slice the click stored is captured first and put back before rehydrating, as in store.test.ts.
    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toContain('"1:pt"');
    act(() => useStore.setState({ favourites: [] }));
    expect(within(planButton()).queryByText("1")).toBeNull();
    localStorage.setItem(STORAGE_KEY, stored ?? "");
    await act(async () => {
      await useStore.persist.rehydrate();
    });
    expect(useStore.getState().favourites).toEqual(["1:pt"]);
    expect(within(planButton()).getByText("1")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Do planu" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("opens the detail panel from the primary button", async () => {
    const user = userEvent.setup();
    render(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    await user.click(screen.getByRole("button", { name: /^Światło w studiu/ }));
    expect(useStore.getState().selectedSessionId).toBe("1:pt");
    expect(useStore.getState().openSheet).toBe("detail");
  });

  it("shows the conflict badge with the number of overlapping plan sessions", () => {
    useStore.setState({ favourites: ["1:pt", "2:pt", "3:pt"] });
    render(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    const badge = article("1:pt").querySelector("[data-conflicts]");
    expect(badge?.textContent).toBe("2");
    expect(badge?.getAttribute("data-conflicts")).toBe("2");
  });

  it("shows no conflict badge when the card itself is not in the plan", () => {
    useStore.setState({ favourites: ["2:pt", "3:pt"] });
    render(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    expect(article("1:pt").querySelector("[data-conflicts]")).toBeNull();
  });

  it("hides the star while a shared plan is previewed but still tints preview members", () => {
    useStore.setState({ previewPlan: ["1:pt"] });
    render(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    expect(screen.queryByRole("button", { name: "Do planu" })).toBeNull();
    expect(article("1:pt").querySelectorAll("button")).toHaveLength(1);
    expect(article("1:pt").getAttribute("data-in-plan")).toBe("true");
  });

  it("marks live, soon, past and upcoming cards from the store clock", () => {
    render(
      wrap(
        <>
          <SessionCard session={talk} variant="grid" showLocation />
          <SessionCard session={soon} variant="grid" showLocation />
          <SessionCard session={earlier} variant="grid" showLocation />
          <SessionCard session={noTime} variant="grid" showLocation />
        </>,
      ),
    );
    expect(article("1:pt").getAttribute("data-live")).toBe("live");
    expect(within(article("1:pt")).getByText("Teraz")).not.toBeNull();
    expect(article("7:pt").getAttribute("data-live")).toBe("soon");
    expect(article("6:pt").getAttribute("data-live")).toBe("past");
    expect(article("4:pt").getAttribute("data-live")).toBe("upcoming");
    expect(within(article("6:pt")).queryByText("Teraz")).toBeNull();
  });

  it("treats every card as upcoming on another day", () => {
    useStore.setState({ now: new Date(2026, 8, 5, 10, 30) });
    render(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    expect(article("1:pt").getAttribute("data-live")).toBe("upcoming");
    expect(screen.queryByText("Teraz")).toBeNull();
  });

  it("derives data-size from the inline height", () => {
    const { rerender } = render(wrap(<SessionCard session={talk} variant="grid" showLocation style={{ height: "36px" }} />));
    expect(article("1:pt").getAttribute("data-size")).toBe("xs");
    expect(article("1:pt").style.height).toBe("36px");
    rerender(wrap(<SessionCard session={talk} variant="grid" showLocation style={{ height: "50px" }} />));
    expect(article("1:pt").getAttribute("data-size")).toBe("sm");
    rerender(wrap(<SessionCard session={talk} variant="grid" showLocation style={{ height: "120px" }} />));
    expect(article("1:pt").getAttribute("data-size")).toBe("md");
    rerender(wrap(<SessionCard session={talk} variant="row" showLocation />));
    expect(article("1:pt").getAttribute("data-size")).toBe("md");
  });

  it("marks point sessions and shows their single time", () => {
    render(wrap(<SessionCard session={point} variant="grid" showLocation />));
    expect(article("8:pt").getAttribute("data-point")).toBe("true");
    expect(screen.getByRole("button", { name: "Otwarcie, 09:30, Sala wykł. 1" })).not.toBeNull();
  });

  it("omits the time from a chip for a session without a start", () => {
    render(wrap(<SessionCard session={noTime} variant="chip" showLocation />));
    expect(screen.getByRole("button", { name: "Bez godziny sesja, Sala wykł. 1" })).not.toBeNull();
  });

  it("logs no console.error while rendering a card in the plan with conflicts", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      useStore.setState({ favourites: ["1:pt", "2:pt"] });
      render(wrap(<SessionCard session={talk} variant="grid" showLocation style={{ height: "120px" }} />));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("ContinuationStub", () => {
  it("is decorative, names the end time and opens the detail on click", () => {
    render(wrap(<ContinuationStub session={timed(talk)} />));
    const stub = document.querySelector<HTMLElement>('[data-stub][data-session-id="1:pt"]');
    expect(stub).not.toBeNull();
    expect(stub?.getAttribute("aria-hidden")).toBe("true");
    expect(stub?.textContent).toContain("Światło w studiu");
    expect(stub?.textContent).toContain("do 11:00");
    expect(screen.queryByRole("button")).toBeNull();
    fireEvent.click(stub as Element);
    expect(useStore.getState().selectedSessionId).toBe("1:pt");
    expect(useStore.getState().openSheet).toBe("detail");
  });

  it("uses the 20-minute visual end for a point session", () => {
    render(wrap(<ContinuationStub session={timed(point)} />));
    expect(document.querySelector("[data-stub]")?.textContent).toContain("do 09:50");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tom/Projects/conference-melt && npx vitest run src/test/SessionCard.test.tsx`

Expected: the file fails to load with `Error: Failed to resolve import "../components/grid/SessionCard" from "src/test/SessionCard.test.tsx". Does the file exist?`

- [ ] **Step 3: Write minimal implementation**

Create `src/components/grid/SessionCard.tsx`:

```tsx
import type { CSSProperties } from "react";
import { TriangleAlert } from "lucide-react";
import styles from "./SessionCard.module.css";
import type { Session } from "../../data/types";
import { useData } from "../../data/index";
import { hueFor } from "../../domain/colors";
import { locationLabel, speakersOf } from "../../domain/lookup";
import { liveState, nowFor } from "../../domain/now";
import { conflictCount } from "../../domain/overlaps";
import { planSessions } from "../../domain/plan";
import { formatRange, isPoint } from "../../domain/time";
import { usePlanSet, useStore } from "../../state/store";
import { Avatar } from "../ui/Avatar";
import { Star } from "../ui/Star";
import { cx } from "../ui/cx";

export interface SessionCardProps {
  session: Session;
  compact?: boolean;
  showLocation: boolean;
  style?: CSSProperties;
  variant: "grid" | "row" | "chip";
}

type CardSize = "xs" | "sm" | "md";

const MAX_AVATARS = 3;
/** Spec §7.2: under 56 px the card shows title and time only, under 40 px the title alone. */
const SMALL_PX = 56;
const TINY_PX = 40;

function sizeOf(style: CSSProperties | undefined): CardSize {
  const height = style?.height;
  const px = typeof height === "number" ? height : typeof height === "string" ? Number.parseFloat(height) : Number.NaN;
  if (!Number.isFinite(px)) return "md";
  if (px < TINY_PX) return "xs";
  if (px < SMALL_PX) return "sm";
  return "md";
}

function signupBadge(session: Session): { text: string; tone: "open" | "full" } | null {
  if (session.signup.status === "open") return { text: "Zapisy", tone: "open" };
  if (session.signup.status === "full") return { text: "Brak miejsc", tone: "full" };
  return null;
}

export function SessionCard({ session, compact = false, showLocation, style, variant }: SessionCardProps) {
  const { index } = useData();
  const colorBy = useStore((s) => s.settings.colorBy);
  const showAvatars = useStore((s) => s.settings.showAvatars);
  const now = useStore((s) => s.now);
  const previewing = useStore((s) => s.previewPlan !== null);
  const toggleFavourite = useStore((s) => s.toggleFavourite);
  const selectSession = useStore((s) => s.selectSession);
  const planSet = usePlanSet();

  const hue = hueFor(session, colorBy, index);
  const day = index.dayById.get(session.day);
  const state = liveState(session, day ? nowFor(day, now) : null);
  const inPlan = planSet.has(session.id);
  // `overlaps` is false across days, so the day's own sessions are all that can conflict.
  const conflicts = inPlan
    ? conflictCount(session, planSessions(planSet, index.sessionsByDay.get(session.day) ?? []))
    : 0;
  const time = session.start === null ? null : formatRange(session.start, session.end);
  const location = locationLabel(session, index);
  const badge = signupBadge(session);
  const speakers = speakersOf(session, index);
  const avatars = showAvatars ? speakers.slice(0, MAX_AVATARS) : [];
  // Spec §7.4: a list row falls back to the names while avatars are off; the other variants then show no speakers.
  const speakerNames = variant === "row" && !showAvatars ? speakers.map((speaker) => speaker.name).join(", ") : "";
  const label = [session.title, time, location, badge?.text]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(", ");
  const paintLocation = showLocation && location.length > 0;
  const hasMeta = paintLocation || avatars.length > 0 || speakerNames.length > 0 || badge !== null || conflicts > 0;

  const cardStyle = { ...style, "--card-h": String(hue.hue), "--card-c": String(hue.chroma) } as CSSProperties;

  return (
    <article
      className={cx(styles.card, styles[variant], compact && styles.compact)}
      style={cardStyle}
      data-session-id={session.id}
      data-size={sizeOf(style)}
      data-live={state}
      data-in-plan={inPlan ? "true" : undefined}
      data-point={isPoint(session) ? "true" : undefined}
    >
      <button
        type="button"
        className={cx("card__main", styles.main)}
        aria-label={label}
        title={label}
        onClick={() => selectSession(session.id)}
      >
        <span className={styles.title}>{session.title}</span>
        {time !== null && (
          <span className={styles.time}>
            {time}
            {state === "live" && <span className={styles.livePill}>Teraz</span>}
          </span>
        )}
        {hasMeta && (
          <span className={styles.meta}>
            {paintLocation && <span className={styles.location}>{location}</span>}
            {avatars.length > 0 && (
              <span className={styles.avatars}>
                {avatars.map((speaker) => (
                  <Avatar
                    key={speaker.id}
                    name={speaker.name}
                    src={speaker.photoThumb}
                    size={22}
                    hue={hue.chroma > 0 ? hue.hue : undefined}
                  />
                ))}
              </span>
            )}
            {speakerNames.length > 0 && <span className={styles.speakerNames}>{speakerNames}</span>}
            {badge && <span className={cx(styles.badge, styles[badge.tone])}>{badge.text}</span>}
            {conflicts > 0 && (
              <span className={styles.conflict} data-conflicts={conflicts} title={`Nakłada się z ${conflicts} w planie`}>
                <TriangleAlert size={11} aria-hidden="true" />
                {conflicts}
              </span>
            )}
          </span>
        )}
      </button>
      {!previewing && (
        <span className={styles.starSlot}>
          <Star pressed={inPlan} onToggle={() => toggleFavourite(session.id)} />
        </span>
      )}
    </article>
  );
}
```

Create `src/components/grid/SessionCard.module.css`:

```css
/* Spec §7.3. The article is positioned by the grid engine; the edge colour comes from --card-h / --card-c set inline. */
.card {
  --card-h: 0;
  --card-c: 0;
  --edge: oklch(var(--hue-l) var(--card-c) var(--card-h));
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface-1);
  box-shadow: var(--shadow-1);
  color: var(--text);
  font-size: 13px;
  line-height: 1.25;
}

.card::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--edge);
  pointer-events: none;
}

.card:hover {
  box-shadow: var(--shadow-2);
  transform: translateY(-2px);
}

.main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  height: 100%;
  min-width: 0;
  /* the right padding keeps the title out from under the star */
  padding: 6px 36px 6px 12px;
  overflow: hidden;
  text-align: left;
}

.main:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: var(--radius-card);
}

.title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  overflow-wrap: anywhere;
  font-weight: 600;
}

.compact .title {
  -webkit-line-clamp: 2;
}

.time {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  color: var(--text-muted);
  font-size: 12px;
}

.location {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.avatars {
  display: inline-flex;
}

.avatars > * + * {
  margin-left: -6px;
}

/* Row variant with avatars off (spec §7.4): the names, muted, on one line */
.speakerNames {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
}

.badge {
  padding: 0 6px;
  border: 1px solid currentColor;
  border-radius: var(--radius-chip);
  font-weight: 600;
  white-space: nowrap;
}

.open {
  color: var(--success);
}

.full {
  color: var(--danger);
}

.conflict {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 5px;
  border-radius: var(--radius-chip);
  background: var(--warning);
  color: oklch(20% 0.02 85);
  font-weight: 700;
}

.livePill {
  padding: 0 6px;
  border-radius: var(--radius-chip);
  background: var(--accent);
  color: var(--on-accent);
  font-size: 12px;
  font-weight: 700;
}

.starSlot {
  position: absolute;
  top: 2px;
  right: 2px;
  z-index: 1;
}

/* States (spec §7.3) */
.card[data-in-plan="true"] {
  background: color-mix(in oklch, var(--accent) 10%, var(--surface-1));
}

.card[data-live="live"] {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.card[data-live="past"] {
  opacity: 0.6;
}

/* Short cards (spec §7.2): under 56 px title + time, under 40 px title only */
.card[data-size="sm"] .title,
.card[data-size="xs"] .title {
  -webkit-line-clamp: 1;
}

.card[data-size="sm"] .meta,
.card[data-size="xs"] .meta,
.card[data-size="xs"] .time {
  display: none;
}

.card[data-size="sm"] .main,
.card[data-size="xs"] .main {
  gap: 0;
  padding-top: 3px;
  padding-bottom: 3px;
}

/* Point sessions: a diamond on the edge instead of the bar (spec §7.2) */
.card[data-point="true"]::before {
  inset: 50% auto auto 2px;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  transform: translateY(-50%) rotate(45deg);
}

/* Row variant (list view, spec §7.4): time, colour dot, title, location, speakers, star */
.row::before {
  inset: 50% auto auto 8px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  transform: translateY(-50%);
}

.row .main {
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 8px 48px 8px 24px;
}

.row .time {
  order: -1;
  flex: none;
  min-width: 96px;
  font-family: var(--font-display);
  font-weight: 600;
}

.row .title {
  flex: 1;
  -webkit-line-clamp: 2;
}

.row .starSlot {
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
}

/* Chip variant (strips, spec §7.2): one line, at most 44 px tall */
.chip {
  display: inline-flex;
  flex: none;
  max-width: 280px;
  height: 36px;
}

.chip .main {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 0 40px 0 14px;
}

.chip .title {
  -webkit-line-clamp: 1;
  overflow-wrap: normal;
}

.chip .time {
  flex: none;
}

.chip .meta {
  display: none;
}

.chip .starSlot {
  top: 50%;
  right: 2px;
  transform: translateY(-50%);
}

@media (pointer: coarse) {
  .chip {
    height: 44px;
  }

  .starSlot {
    top: 0;
    right: 0;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .card {
    transition: transform 120ms ease, box-shadow 120ms ease;
    /* entrance (spec §8); the grid engine sets animation-delay inline for the stagger */
    animation: cardIn 180ms ease-out backwards;
  }

  .card[data-live="live"] {
    animation: cardIn 180ms ease-out backwards, livePulse 2s ease-in-out infinite;
  }
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

@keyframes livePulse {
  0%,
  100% {
    outline-color: var(--accent);
  }

  50% {
    outline-color: color-mix(in oklch, var(--accent) 30%, transparent);
  }
}
```

Create `src/components/grid/ContinuationStub.tsx`:

```tsx
import type { CSSProperties } from "react";
import styles from "./ContinuationStub.module.css";
import type { TimedSession } from "../../data/types";
import { useData } from "../../data/index";
import { hueFor } from "../../domain/colors";
import { formatTime, visualEnd } from "../../domain/time";
import { useStore } from "../../state/store";

export interface ContinuationStubProps {
  session: TimedSession;
}

/** Spec §7.2: a decorative one-liner with no tab stop; a pointer click still opens the detail panel. */
export function ContinuationStub({ session }: ContinuationStubProps) {
  const { index } = useData();
  const colorBy = useStore((s) => s.settings.colorBy);
  const selectSession = useStore((s) => s.selectSession);
  const hue = hueFor(session, colorBy, index);
  const style = { "--card-h": String(hue.hue), "--card-c": String(hue.chroma) } as CSSProperties;

  return (
    <div
      className={styles.stub}
      style={style}
      aria-hidden="true"
      data-stub=""
      data-session-id={session.id}
      onClick={() => selectSession(session.id)}
    >
      <span className={styles.title}>{session.title}</span>
      <span className={styles.until}>{`do ${formatTime(visualEnd(session))}`}</span>
    </div>
  );
}
```

Create `src/components/grid/ContinuationStub.module.css`:

```css
.stub {
  --card-h: 0;
  --card-c: 0;
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  padding: 2px 8px 2px 12px;
  overflow: hidden;
  border: 1px dashed var(--border);
  border-radius: var(--radius-card);
  background: color-mix(in oklch, var(--surface-1) 60%, transparent);
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}

.stub::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: oklch(var(--hue-l) var(--card-c) var(--card-h));
  opacity: 0.7;
}

.stub:hover {
  color: var(--text);
}

.title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.until {
  flex: none;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/tom/Projects/conference-melt && npx vitest run src/test/SessionCard.test.tsx` — expected: 20 tests pass (18 SessionCard, 2 ContinuationStub).

Run: `cd /Users/tom/Projects/conference-melt && npm run typecheck` — expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/tom/Projects/conference-melt && git add src/components/grid/SessionCard.tsx src/components/grid/SessionCard.module.css src/components/grid/ContinuationStub.tsx src/components/grid/ContinuationStub.module.css src/test/SessionCard.test.tsx && git commit -F - <<'EOF'
feat(grid): add SessionCard and ContinuationStub

Article with two sibling controls (card__main button + Star), colour edge
from hueFor, live / past / in-plan / conflict states, data-size from the
inline height, grid / row / chip variants (rows name the speakers while
avatars are off); decorative continuation stub with "do HH:MM" that
opens the detail on click.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2
EOF
```

---

### Task 26: ScheduleGrid, TimelineBody, TimeRail, ColumnHeader, NowLine (timeline mode)

**Files:**
- Replace the Task 23 placeholder: `src/components/grid/ScheduleGrid.tsx`
- Create: `src/components/grid/ScheduleGrid.module.css`
- Create: `src/components/grid/TimelineBody.tsx`
- Create: `src/components/grid/TimelineBody.module.css`
- Create: `src/components/grid/TimeRail.tsx`
- Create: `src/components/grid/TimeRail.module.css`
- Create: `src/components/grid/ColumnHeader.tsx`
- Create: `src/components/grid/ColumnHeader.module.css`
- Create: `src/components/grid/NowLine.tsx`
- Create: `src/components/grid/NowLine.module.css`
- Create: `src/test/gridHarness.tsx` (test-only helper reused by Tasks 27 and 28)
- Test: `src/test/ScheduleGrid.timeline.test.tsx`

**Interfaces:**
- Consumes:
  - `src/components/grid/gridLayout.ts` (Task 24, as implemented): `densityFor(density, coarsePointer): Density`, `coarsePointer(): boolean`, `prefersReducedMotion(): boolean`, `timelineRange(layout: TimedSession[]): TimelineRange`, `timelineGeometry(column: Column, range: TimelineRange, zoom: number, density: Density): { columnWidth; columnLanes; cards: Map<string, CardGeometry> }`, `cardStyle(g: CardGeometry): { top; height; left; width }`, `sortByStartTitle(a, b)`, `nowScrollTop(lineTop, viewportHeight)`, type `Density`, type `TimelineRange`.
  - `src/state/derive.ts`: types `DaySets`, `Column`, `ResolvedTime`; in the harness `daySets(...)`, `buildColumns(...)`, `resolveTimeMode(...)`.
  - `src/state/store.ts`: `useStore` (`settings`, `filters`, `now`, `clearFilters()`, `setSettings(patch)`), `usePlanSet()`, `defaultSettings(width)`.
  - `src/domain/filters.ts`: `activeFilterCount(f)`, `signupLabel(status, data)`, type `Filters`, `EMPTY_FILTERS`; `src/domain/lookup.ts`: type `DataIndex`; `src/domain/now.ts`: `nowFor(day, now)`; `src/domain/time.ts`: `formatTime(m)`.
  - `src/data/index.tsx`: `useData()`, `DataProvider`, `buildAppData`.
  - `src/components/ui/EmptyState.tsx`: `EmptyState({ title, text?, actions?, illustration? })`; `src/components/ui/Chip.tsx`: `Chip({ children, onRemove?, tone? })`; `cx`.
  - Task 25: `SessionCard`.
- Produces:
  - `ScheduleGrid({ sets: DaySets; columns: Column[]; resolved: ResolvedTime; dayId: string })` — renders the spec §9 empty state (`role="status"`) when `sets.rendered` is empty, otherwise a body keyed by `` `${resolved.mode}:${dayId}` `` (this task: `TimelineBody` for every mode; Task 27 adds the slot branch, Task 28 the strips).
  - `export function FilteredEmpty({ text?: string; extraActions?: ReactNode })` (from `ScheduleGrid.tsx`) — the spec §9 filter empty state: the title (`"Brak wydarzeń dla tych filtrów"` unless `text` is passed), the active-filter chips from `filterLabels`, then `extraActions`, then `"Wyczyść filtry"` only while `activeFilterCount(filters) > 0`. Both grid empty states render through it; Task 33's `PlanView` reuses it.
  - `export function filterLabels(filters: Filters, data: ScheduleData, index: DataIndex): string[]` (from `ScheduleGrid.tsx`) — the active filter labels in `FilterChips` order, for `FilteredEmpty` and for `PlanView` if it needs the labels themselves.
  - `TimelineBody({ sets: DaySets; columns: Column[]; density: Density; nowMinutes: number | null; dayId: string })` — the scroll container `div[data-scroll-container="timeline"]`; column headers `[data-column-header=<key>]`, bodies `[data-column=<key>]`, cards as direct `article` children of a body.
  - `TimeRail({ range: TimelineRange; zoom: number; now: { top: number; label: string } | null; className?: string; style?: CSSProperties })` — `div[data-time-rail]`, `aria-hidden`.
  - `ColumnHeader({ column: Column; className?: string; style?: CSSProperties })`.
  - `NowLine({ style?: CSSProperties })` — `<div id="now-line" data-now-line aria-hidden>` (the hook `LiveChip` scrolls to); `NowChip({ label: string; top?: number })` — the time chip placed inside a rail (both exported from `NowLine.tsx`).
  - `src/test/gridHarness.tsx`: `GridHarness()` (reads the store, computes sets/columns/resolved like `App`, renders `ScheduleGrid`), `renderGrid(data: ScheduleData)` (wraps it in a `DataProvider`) and `nestingWarnings(spy: MockInstance): string[]` (the `console.error` calls that are DOM-nesting warnings, in React 18 and React 19 wording).

- [ ] **Step 1: Write the failing test**

Create `src/test/gridHarness.tsx`:

```tsx
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
```

Create `src/test/ScheduleGrid.timeline.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EMPTY_FILTERS } from "../domain/filters";
import { defaultSettings, useStore } from "../state/store";
import { makeData, makeSession } from "./fixtures/build";
import { nestingWarnings, renderGrid } from "./gridHarness";

const ZOOM = 2;
const LANE_MIN = 180;
const RANGE_START = 585; // roundDown(600, 30) - 15

const hour = makeSession({ id: "1:pt", eventId: 1, title: "Jedna godzina", start: 600, end: 660 });
const eight = Array.from({ length: 8 }, (_, i) =>
  makeSession({ id: `${10 + i}:pt`, eventId: 10 + i, title: `Równolegle ${i + 1}`, start: 660, end: 720 }),
);
const pair = [21, 22].map((id) => makeSession({ id: `${id}:pt`, eventId: id, title: `Para ${id}`, start: 840, end: 900 }));
const zone = makeSession({
  id: "30:pt",
  eventId: 30,
  title: "Rejestracja",
  start: 540,
  end: 1080,
  allDay: true,
  typeIds: [242],
  locationIds: [318],
});
const data = makeData([hour, ...eight, ...pair, zone]);

function card(id: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`article[data-session-id="${id}"]`);
  if (!el) throw new Error(`missing card ${id}`);
  return el;
}

function rail(): HTMLElement {
  const el = document.querySelector<HTMLElement>("[data-time-rail]");
  if (!el) throw new Error("missing time rail");
  return el;
}

/**
 * The CSSOM may canonicalise calc() on read-back (calc(100% / 8) can come back as calc(12.5%)),
 * so expectations go through the same round trip as the card's inline style.
 */
function cssValue(property: "width" | "left", value: string): string {
  const probe = document.createElement("div");
  probe.style[property] = value;
  if (probe.style[property] === "") throw new Error(`jsdom rejected ${property}: ${value}`);
  return probe.style[property];
}

function resetStore(): void {
  useStore.setState({
    day: "pt",
    view: "grid",
    filters: { ...EMPTY_FILTERS },
    // the synthetic set is slot-distinguishable, so the timeline is forced here
    settings: { ...defaultSettings(1024), timeMode: "timeline", zoom: ZOOM },
    favourites: [],
    selectedSessionId: null,
    openSheet: null,
    sharedPlan: null,
    previewPlan: null,
    now: new Date(2026, 8, 4, 10, 30),
    toasts: [],
    copyText: null,
  });
}

function setAxis(axis: "location" | "none"): void {
  useStore.setState({ settings: { ...useStore.getState().settings, columnAxis: axis } });
}

const originalScrollTo = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTo");
let scrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetStore();
  scrollTo = vi.fn();
  Object.defineProperty(Element.prototype, "scrollTo", { configurable: true, writable: true, value: scrollTo });
});

afterEach(() => {
  if (originalScrollTo) Object.defineProperty(Element.prototype, "scrollTo", originalScrollTo);
  else Reflect.deleteProperty(Element.prototype, "scrollTo");
});

describe("ScheduleGrid in timeline mode", () => {
  it("renders exactly one scroll container, in timeline mode", () => {
    renderGrid(data);
    expect(document.querySelectorAll("[data-scroll-container]")).toHaveLength(1);
    expect(document.querySelector('[data-scroll-container="timeline"]')).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("gives a 60-minute card an inline height of 60 × zoom and a top measured from the range start", () => {
    renderGrid(data);
    expect(card("1:pt").style.height).toBe(`${60 * ZOOM}px`);
    expect(card("1:pt").style.top).toBe(`${(600 - RANGE_START) * ZOOM}px`);
    expect(card("1:pt").getAttribute("data-size")).toBe("md");
  });

  it("sizes an 8-lane column to 8 × laneMin and cards to a fraction of their own component", () => {
    setAxis("none");
    renderGrid(data);
    expect(document.querySelector<HTMLElement>('[data-column="all"]')?.style.minWidth).toBe(`${8 * LANE_MIN}px`);
    expect(document.querySelector<HTMLElement>('[data-column-header="all"]')?.style.minWidth).toBe(`${8 * LANE_MIN}px`);
    const eighth = cssValue("width", "calc(100% / 8)");
    for (const s of eight) expect(card(s.id).style.width).toBe(eighth);
    expect(new Set(eight.map((s) => card(s.id).style.left)).size).toBe(8);
    const half = cssValue("width", "calc(100% / 2)");
    for (const s of pair) expect(card(s.id).style.width).toBe(half);
    expect(card("1:pt").style.width).toBe(cssValue("width", "calc(100% / 1)"));
    expect(card("1:pt").style.left).toBe(cssValue("left", "calc(0 * 100% / 1)"));
  });

  it("never lets two cards in one column body share both a time span and a lane", () => {
    setAxis("none");
    renderGrid(data);
    const cards = [...document.querySelectorAll<HTMLElement>('[data-column="all"] > article')];
    expect(cards).toHaveLength(11);
    const boxes = cards.map((el) => {
      const top = Number.parseFloat(el.style.top);
      return { top, bottom: top + Number.parseFloat(el.style.height), left: el.style.left };
    });
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        expect(a.bottom <= b.top || b.bottom <= a.top || a.left !== b.left).toBe(true);
      }
    }
  });

  it("keeps DOM order inside a column by start time", () => {
    setAxis("none");
    renderGrid(data);
    const ids = [...document.querySelectorAll('[data-column="all"] > article')].map((el) => el.getAttribute("data-session-id"));
    expect(ids[0]).toBe("1:pt");
    expect(ids.slice(-2)).toEqual(["21:pt", "22:pt"]);
  });

  it("logs no DOM nesting warning while rendering a column of many cards", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      setAxis("none");
      renderGrid(data);
      expect(document.querySelectorAll('[data-column="all"] > article')).toHaveLength(11);
      expect(nestingWarnings(spy)).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it("labels every full hour on the rail and ticks the half hours", () => {
    renderGrid(data);
    for (const label of ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"]) {
      expect(within(rail()).getByText(label)).not.toBeNull();
    }
    expect(within(rail()).queryByText("11:30")).toBeNull();
    expect(rail().style.height).toBe(`${(915 - RANGE_START) * ZOOM}px`);
  });

  it("draws the now line at the exact minute, exposes it to the live chip and scrolls to it once", () => {
    renderGrid(data);
    const line = document.querySelector<HTMLElement>("[data-now-line]");
    expect(line?.id).toBe("now-line");
    expect(line?.style.top).toBe(`${(630 - RANGE_START) * ZOOM}px`);
    expect(within(rail()).getByText("10:30")).not.toBeNull();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: (630 - RANGE_START) * ZOOM, behavior: "auto" });
    act(() => useStore.getState().setNow(new Date(2026, 8, 4, 10, 31)));
    expect(document.querySelector<HTMLElement>("[data-now-line]")?.style.top).toBe(`${(631 - RANGE_START) * ZOOM}px`);
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it("renders no now line and does not scroll when the day is not today", () => {
    useStore.setState({ now: new Date(2026, 8, 5, 10, 30) });
    renderGrid(data);
    expect(document.querySelector("[data-now-line]")).toBeNull();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("shows the filter empty state with the active chips and clears them", async () => {
    const user = userEvent.setup();
    useStore.setState({ filters: { ...EMPTY_FILTERS, types: [5] } });
    renderGrid(data);
    expect(screen.getByText("Brak wydarzeń dla tych filtrów")).not.toBeNull();
    expect(screen.getByText("Warsztaty")).not.toBeNull();
    expect(document.querySelector("[data-scroll-container]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Pokaż w siatce" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Wyczyść filtry" }));
    expect(useStore.getState().filters).toEqual(EMPTY_FILTERS);
    expect(document.querySelector('[data-scroll-container="timeline"]')).not.toBeNull();
  });

  it("shows the strip-only empty state and moves the zones into the grid on request", async () => {
    const user = userEvent.setup();
    useStore.setState({ filters: { ...EMPTY_FILTERS, locations: [318] } });
    renderGrid(data);
    expect(
      screen.getByText("Wszystkie pasujące wydarzenia są całodniowe lub bez godziny. Znajdziesz je powyżej"),
    ).not.toBeNull();
    expect(document.querySelector("[data-scroll-container]")).toBeNull();
    expect(screen.getByRole("button", { name: "Wyczyść filtry" })).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Pokaż w siatce" }));
    expect(useStore.getState().settings.allDayStrip).toBe(false);
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelectorAll("[data-column-header]")).toHaveLength(1);
    expect(card("30:pt").style.height).toBe(`${(1080 - 540) * ZOOM}px`);
  });

  it("offers no buttons when nothing is filtered on an empty day", () => {
    useStore.setState({ day: "czw" });
    renderGrid(data);
    expect(screen.getByText("Brak wydarzeń dla tych filtrów")).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tom/Projects/conference-melt && npx vitest run src/test/ScheduleGrid.timeline.test.tsx`

Expected: the harness resolves Task 23's placeholder `ScheduleGrid`, which renders none of the grid DOM, so every test fails — the first on `expect(document.querySelectorAll("[data-scroll-container]")).toHaveLength(1)` with a length of 0.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/grid/NowLine.tsx`:

```tsx
import type { CSSProperties } from "react";
import styles from "./NowLine.module.css";
import { cx } from "../ui/cx";

export interface NowLineProps {
  style?: CSSProperties;
}

/** The line itself: decorative (spec §7.9); `id` and `data-now-line` are what LiveChip scrolls to. */
export function NowLine({ style }: NowLineProps) {
  return <div id="now-line" data-now-line="" className={styles.line} style={style} aria-hidden="true" />;
}

export interface NowChipProps {
  label: string;
  /** Pixel offset inside a timeline rail; omit inside a slot rail cell (chip sits at the cell's top). */
  top?: number;
}

/** The time chip, rendered inside the sticky rail so it survives horizontal scroll. */
export function NowChip({ label, top }: NowChipProps) {
  return (
    <span
      className={cx(styles.chip, top !== undefined && styles.centered)}
      style={top === undefined ? undefined : { top: `${top}px` }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}
```

Create `src/components/grid/NowLine.module.css`:

```css
.line {
  position: relative;
  z-index: 1;
  align-self: start;
  height: 2px;
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent);
  pointer-events: none;
}

.line::before {
  content: "";
  position: absolute;
  top: -3px;
  left: -4px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--accent);
}

.chip {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 1;
  padding: 1px 6px;
  border-radius: var(--radius-chip);
  background: var(--accent);
  color: var(--on-accent);
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
}

.centered {
  transform: translateY(-50%);
}
```

Create `src/components/grid/ColumnHeader.tsx`:

```tsx
import type { CSSProperties } from "react";
import styles from "./ColumnHeader.module.css";
import type { Column } from "../../state/derive";
import { cx } from "../ui/cx";

export interface ColumnHeaderProps {
  column: Column;
  className?: string;
  style?: CSSProperties;
}

/** Spec §7.2: label, rendered-set count and, for locations, the venue as a second line. */
export function ColumnHeader({ column, className, style }: ColumnHeaderProps) {
  return (
    <div className={cx(styles.header, className)} style={style} data-column-header={column.key}>
      <span className={styles.row}>
        <span className={styles.label}>{column.label}</span>
        <span className={styles.count}>{column.count}</span>
      </span>
      {column.sublabel !== null && <span className={styles.sub}>{column.sublabel}</span>}
    </div>
  );
}
```

Create `src/components/grid/ColumnHeader.module.css`:

```css
.header {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  min-height: 44px;
  padding: 6px 10px;
  border-right: 1px solid var(--border);
}

.row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
}

.count {
  flex: none;
  padding: 0 6px;
  border-radius: var(--radius-chip);
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: var(--text-min);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
  font-size: var(--text-min);
}
```

Create `src/components/grid/TimeRail.tsx`:

```tsx
import type { CSSProperties } from "react";
import styles from "./TimeRail.module.css";
import { formatTime } from "../../domain/time";
import { cx } from "../ui/cx";
import { NowChip } from "./NowLine";
import type { TimelineRange } from "./gridLayout";

export interface TimeRailProps {
  range: TimelineRange;
  zoom: number;
  now: { top: number; label: string } | null;
  className?: string;
  style?: CSSProperties;
}

const HALF_HOUR = 30;
const HOUR = 60;

/** Spec §7.2: hour labels and half-hour ticks over the timeline range; decorative (spec §7.9). */
export function TimeRail({ range, zoom, now, className, style }: TimeRailProps) {
  const marks: number[] = [];
  for (let m = Math.ceil(range.start / HALF_HOUR) * HALF_HOUR; m <= range.end; m += HALF_HOUR) marks.push(m);

  return (
    <div
      className={cx(styles.rail, className)}
      style={{ ...style, height: `${(range.end - range.start) * zoom}px` }}
      data-time-rail=""
      aria-hidden="true"
    >
      {marks.map((minute) =>
        minute % HOUR === 0 ? (
          <span key={minute} className={styles.hour} style={{ top: `${(minute - range.start) * zoom}px` }}>
            {formatTime(minute)}
          </span>
        ) : (
          <span key={minute} className={styles.tick} style={{ top: `${(minute - range.start) * zoom}px` }} />
        ),
      )}
      {now && <NowChip label={now.label} top={now.top} />}
    </div>
  );
}
```

Create `src/components/grid/TimeRail.module.css`:

```css
.rail {
  position: relative;
  width: var(--rail-width);
  border-right: 1px solid var(--border);
  background: var(--surface-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--text-muted);
  font-size: 12px;
}

.hour {
  position: absolute;
  right: 8px;
  transform: translateY(-50%);
  font-family: var(--font-display);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.tick {
  position: absolute;
  right: 0;
  width: 8px;
  height: 1px;
  background: var(--border);
}
```

Create `src/components/grid/TimelineBody.tsx`:

```tsx
import { useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import styles from "./TimelineBody.module.css";
import { formatTime } from "../../domain/time";
import type { Column, DaySets } from "../../state/derive";
import { useStore } from "../../state/store";
import { ColumnHeader } from "./ColumnHeader";
import { NowLine } from "./NowLine";
import { SessionCard } from "./SessionCard";
import { TimeRail } from "./TimeRail";
import {
  cardStyle,
  nowScrollTop,
  prefersReducedMotion,
  sortByStartTitle,
  timelineGeometry,
  timelineRange,
  type Density,
} from "./gridLayout";

export interface TimelineBodyProps {
  sets: DaySets;
  columns: Column[];
  density: Density;
  nowMinutes: number | null;
  dayId: string;
}

/** Spec §8: entrance stagger of 12 ms per card, capped at 240 ms. */
const STAGGER_MS = 12;
const STAGGER_MAX_MS = 240;

function enterDelay(order: number): string {
  return `${Math.min(order * STAGGER_MS, STAGGER_MAX_MS)}ms`;
}

export function TimelineBody({ sets, columns, density, nowMinutes, dayId }: TimelineBodyProps) {
  const zoom = useStore((s) => s.settings.zoom);
  const axis = useStore((s) => s.settings.columnAxis);
  const compact = useStore((s) => s.settings.density === "compact");
  const showLocation = axis !== "location";
  const animate = !prefersReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);

  const range = useMemo(() => timelineRange(sets.layout), [sets.layout]);
  const placed = useMemo(
    () =>
      columns.map((column) => ({
        column,
        geometry: timelineGeometry(column, range, zoom, density),
        // DOM order follows start time so Tab order matches reading order (spec §7.3)
        cards: [...column.sessions].sort(sortByStartTitle).filter((s) => column.renderedIds.has(s.id)),
      })),
    [columns, range, zoom, density],
  );
  const bodyHeight = (range.end - range.start) * zoom;
  const lineTop =
    nowMinutes !== null && nowMinutes >= range.start && nowMinutes <= range.end
      ? (nowMinutes - range.start) * zoom
      : null;

  // First render for a day: put the now line a third of the way down the viewport (spec §7.2).
  useLayoutEffect(() => {
    if (lineTop === null || scrolledFor.current === dayId) return;
    scrolledFor.current = dayId;
    const el = scroller.current;
    if (!el || typeof el.scrollTo !== "function") return;
    el.scrollTo({ top: nowScrollTop(lineTop, el.clientHeight), behavior: "auto" });
  }, [dayId, lineTop]);

  const track = axis === "none" ? "minmax(calc(100% - var(--rail-width)), auto)" : "auto";
  const style = {
    gridTemplateColumns: `var(--rail-width) ${columns.map(() => track).join(" ")}`,
    "--half-hour": `${30 * zoom}px`,
  } as CSSProperties;

  let order = 0;

  return (
    <div ref={scroller} className={styles.scroller} style={style} data-scroll-container="timeline">
      <div className={styles.corner} style={{ gridColumn: "1", gridRow: "1" }} aria-hidden="true" />
      {placed.map(({ column, geometry }, i) => (
        <ColumnHeader
          key={column.key}
          column={column}
          className={styles.header}
          style={{ gridColumn: String(i + 2), gridRow: "1", minWidth: `${geometry.columnWidth}px` }}
        />
      ))}
      <TimeRail
        range={range}
        zoom={zoom}
        className={styles.rail}
        style={{ gridColumn: "1", gridRow: "2" }}
        now={lineTop === null || nowMinutes === null ? null : { top: lineTop, label: formatTime(nowMinutes) }}
      />
      {placed.map(({ column, geometry, cards }, i) => (
        <div
          key={column.key}
          className={styles.body}
          style={{ gridColumn: String(i + 2), gridRow: "2", height: `${bodyHeight}px`, minWidth: `${geometry.columnWidth}px` }}
          data-column={column.key}
        >
          {cards.map((s) => {
            const g = geometry.cards.get(s.id);
            if (!g) return null;
            const delay = animate ? enterDelay(order++) : undefined;
            return (
              <SessionCard
                key={s.id}
                session={s}
                variant="grid"
                compact={compact}
                showLocation={showLocation}
                style={{ ...cardStyle(g), animationDelay: delay }}
              />
            );
          })}
        </div>
      ))}
      {lineTop !== null && <NowLine style={{ gridColumn: "2 / -1", gridRow: "2", top: `${lineTop}px` }} />}
    </div>
  );
}
```

Create `src/components/grid/TimelineBody.module.css`:

```css
/* The scroll container is the grid: corner + headers in row 1, rail + bodies in row 2 (spec §7.2). */
.scroller {
  position: relative;
  display: grid;
  grid-template-rows: auto auto;
  align-content: start;
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  background: var(--bg);
}

.corner {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 4;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: var(--surface-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.header {
  position: sticky;
  top: 0;
  z-index: 3;
  border-bottom: 1px solid var(--border);
  background: var(--surface-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.rail {
  position: sticky;
  left: 0;
  z-index: 2;
}

.body {
  position: relative;
  border-right: 1px solid var(--border);
  /* one guide line per half hour, aligned to the 15-minute range padding */
  background-image: linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px);
  background-size: 100% var(--half-hour);
  background-position: 0 calc(var(--half-hour) / 2);
}

.body > article {
  position: absolute;
}
```

Replace the Task 23 placeholder `src/components/grid/ScheduleGrid.tsx` with:

```tsx
import { useMemo, type ReactNode } from "react";
import styles from "./ScheduleGrid.module.css";
import { useData } from "../../data/index";
import type { ScheduleData } from "../../data/types";
import { activeFilterCount, signupLabel, type Filters } from "../../domain/filters";
import type { DataIndex } from "../../domain/lookup";
import { nowFor } from "../../domain/now";
import type { Column, DaySets, ResolvedTime } from "../../state/derive";
import { useStore } from "../../state/store";
import { Chip } from "../ui/Chip";
import { EmptyState } from "../ui/EmptyState";
import { cx } from "../ui/cx";
import { coarsePointer, densityFor } from "./gridLayout";
import { TimelineBody } from "./TimelineBody";

export interface ScheduleGridProps {
  sets: DaySets;
  columns: Column[];
  resolved: ResolvedTime;
  dayId: string;
}

const FILTERED_EMPTY = "Brak wydarzeń dla tych filtrów";
const STRIP_ONLY_EMPTY = "Wszystkie pasujące wydarzenia są całodniowe lub bez godziny. Znajdziesz je powyżej";

/** Labels of every active filter, in FilterChips order, for the empty states (PlanView may reuse it). */
export function filterLabels(filters: Filters, data: ScheduleData, index: DataIndex): string[] {
  const labels = [
    ...filters.types.map((id) => index.typeById.get(id)?.name ?? String(id)),
    ...filters.locations.map((id) => index.locationById.get(id)?.short ?? String(id)),
    ...filters.themes.map((id) => index.themeById.get(id)?.name ?? String(id)),
    ...filters.brands.map((id) => index.brandById.get(id)?.name ?? String(id)),
    ...filters.signup.map((status) => signupLabel(status, data)),
  ];
  if (filters.query.trim().length > 0) labels.push(`Szukaj: „${filters.query}”`);
  if (filters.onlyFavourites) labels.push("Tylko ulubione");
  if (filters.hideAllDay) labels.push("Ukryj strefy całodniowe");
  return labels;
}

export interface FilteredEmptyProps {
  /** Title line; defaults to the spec §9 "Brak wydarzeń dla tych filtrów". */
  text?: string;
  /** Extra buttons, rendered between the filter chips and "Wyczyść filtry". */
  extraActions?: ReactNode;
}

/**
 * Spec §9: the filter empty state — the title, one chip per active filter and "Wyczyść filtry"
 * only while a filter is on. Both grid empty states render through it; PlanView (Task 33) reuses it.
 */
export function FilteredEmpty({ text = FILTERED_EMPTY, extraActions }: FilteredEmptyProps) {
  const { data, index } = useData();
  const filters = useStore((s) => s.filters);
  const clearFilters = useStore((s) => s.clearFilters);
  const labels = filterLabels(filters, data, index);

  return (
    <EmptyState
      title={text}
      actions={
        <>
          {labels.length > 0 && (
            <span className={styles.chips}>
              {labels.map((label, i) => (
                <Chip key={`${i}-${label}`} tone="accent">
                  {label}
                </Chip>
              ))}
            </span>
          )}
          {extraActions}
          {activeFilterCount(filters) > 0 && (
            <button type="button" className={cx(styles.button, styles.secondary)} onClick={clearFilters}>
              Wyczyść filtry
            </button>
          )}
        </>
      }
    />
  );
}

/** Spec §9: replaces the scroll container whenever the rendered set is empty. */
function GridEmpty({ sets }: { sets: DaySets }) {
  const setSettings = useStore((s) => s.setSettings);
  const stripOnly = sets.visible.length > 0;

  return (
    <FilteredEmpty
      text={stripOnly ? STRIP_ONLY_EMPTY : FILTERED_EMPTY}
      extraActions={
        stripOnly && sets.stripAllDay.length > 0 ? (
          <button type="button" className={styles.button} onClick={() => setSettings({ allDayStrip: false })}>
            Pokaż w siatce
          </button>
        ) : undefined
      }
    />
  );
}

export function ScheduleGrid({ sets, columns, resolved, dayId }: ScheduleGridProps) {
  const { index } = useData();
  const densitySetting = useStore((s) => s.settings.density);
  const now = useStore((s) => s.now);
  const density = useMemo(() => densityFor(densitySetting, coarsePointer()), [densitySetting]);
  const day = index.dayById.get(dayId);
  const nowMinutes = day ? nowFor(day, now) : null;

  return (
    <section className={styles.grid} aria-label="Siatka harmonogramu">
      {sets.rendered.length === 0 ? (
        <GridEmpty sets={sets} />
      ) : (
        <div key={`${resolved.mode}:${dayId}`} className={styles.fade}>
          <TimelineBody sets={sets} columns={columns} density={density} nowMinutes={nowMinutes} dayId={dayId} />
        </div>
      )}
    </section>
  );
}
```

Create `src/components/grid/ScheduleGrid.module.css`:

```css
.grid {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.fade {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  width: 100%;
}

.button {
  height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-chip);
  background: var(--accent);
  color: var(--on-accent);
  font-size: 13px;
  font-weight: 600;
}

.button:hover {
  background: var(--accent-hover);
}

.secondary {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
}

.secondary:hover {
  background: var(--surface-1);
}

@media (pointer: coarse) {
  .button {
    min-height: 44px;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .fade {
    animation: gridFade 160ms ease-out;
  }
}

@keyframes gridFade {
  from {
    opacity: 0;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/tom/Projects/conference-melt && npx vitest run src/test/ScheduleGrid.timeline.test.tsx` — expected: 12 tests pass. These assertions were verified against jsdom 30.x; if `npm install` resolves jsdom 26.x and the `calc()` or `gridRow` read-back assertions fail, bump `jsdom` in package.json to `^30.0.1` and re-run.

Run: `cd /Users/tom/Projects/conference-melt && npx vitest run src/test/SessionCard.test.tsx src/components/grid/gridLayout.test.ts` — expected: still green.

Run: `cd /Users/tom/Projects/conference-melt && npm run typecheck` — expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/tom/Projects/conference-melt && git add src/components/grid/ScheduleGrid.tsx src/components/grid/ScheduleGrid.module.css src/components/grid/TimelineBody.tsx src/components/grid/TimelineBody.module.css src/components/grid/TimeRail.tsx src/components/grid/TimeRail.module.css src/components/grid/ColumnHeader.tsx src/components/grid/ColumnHeader.module.css src/components/grid/NowLine.tsx src/components/grid/NowLine.module.css src/test/gridHarness.tsx src/test/ScheduleGrid.timeline.test.tsx && git commit -F - <<'EOF'
feat(grid): add ScheduleGrid with the timeline body, rail, headers and now line

Sticky corner / headers / rail inside one scrolling CSS grid, column
bodies with absolutely positioned cards from timelineGeometry, the now
line with its rail chip and the first-render scroll, and the spec §9
empty states (the reusable FilteredEmpty) in place of the scroll container.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2
EOF
```

---

### Task 27: SlotBody (slot mode)

**Files:**
- Create: `src/components/grid/SlotBody.tsx`
- Create: `src/components/grid/SlotBody.module.css`
- Modify: `src/components/grid/ScheduleGrid.tsx` (import `SlotBody`; render it instead of `TimelineBody` when `resolved.mode === "slots"`)
- Test: `src/test/ScheduleGrid.slots.test.tsx`

**Interfaces:**
- Consumes:
  - `src/components/grid/gridLayout.ts` (Task 24, as implemented): `slotPlacements(column, columnIndex, slots, tolerance, renderedIds): SlotPlacement[]`, `slotCells(placements): SlotCell[]` (`{ column, row, stubs, overflow, cards }`, stubs capped at `MAX_STUBS = 3`), `gridArea(p): { gridColumn, gridRow }`, `nowScrollTop`, `prefersReducedMotion`, types `Density`, `SlotCell`, `SlotPlacement`.
  - `src/domain/slots.ts`: type `Slot` (`{ index, start, lastStart, end, sessionIds }`); `src/domain/time.ts`: `formatTime`, `formatRange`.
  - `src/state/store.ts`: `useStore` (`settings.columnAxis`, `settings.slotTolerance`, `settings.density`); `src/state/derive.ts`: type `Column`.
  - Task 25: `SessionCard`, `ContinuationStub`; Task 26: `ColumnHeader`, `NowLine`, `NowChip`, `renderGrid` and `nestingWarnings` (test harness).
  - `src/test/fixtures/fri-lectures.json` (`ScheduleData` subset, 27 Friday lecture sessions).
- Produces:
  - `SlotBody({ columns: Column[]; slots: Slot[]; density: Density; nowMinutes: number | null; dayId: string })` — the scroll container `div[data-scroll-container="slots"]` is the grid; rail cells `[data-slot-row=<r>]`, cell wrappers `[data-cell="<c>:<r>"]` with inline `gridColumn`/`gridRow`, spanning items `[data-span=<sessionId>]` with `gridRow: "<r> / span k"`, the now line as a `1 / -1` item on the row containing now with the chip inside that row's rail cell. Cell wrappers and spanning items are rendered as one list sorted by (column, row), so DOM order inside a column follows start time (spec §7.3).
  - `ScheduleGrid` now branches on `resolved.mode`.

- [ ] **Step 1: Write the failing test**

Create `src/test/ScheduleGrid.slots.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, within } from "@testing-library/react";
import type { ScheduleData } from "../data/types";
import { EMPTY_FILTERS } from "../domain/filters";
import { defaultSettings, useStore, type Settings } from "../state/store";
import friLecturesJson from "./fixtures/fri-lectures.json";
import { makeData, makeSession } from "./fixtures/build";
import { nestingWarnings, renderGrid } from "./gridHarness";

const friLectures = friLecturesJson as unknown as ScheduleData;

// The spec §10 synthetic case lives on Saturday; the real Friday lectures share the data set.
const synthetic = [
  makeSession({ id: "1:sob", eventId: 1, day: "sob", title: "A", start: 570, end: 645, locationIds: [] }),
  makeSession({ id: "2:sob", eventId: 2, day: "sob", title: "B", start: 615, end: 690, locationIds: [] }),
  makeSession({ id: "3:sob", eventId: 3, day: "sob", title: "C", start: 660, end: 735, locationIds: [] }),
];
const data = makeData([...synthetic, ...friLectures.sessions], {
  types: friLectures.types,
  locations: friLectures.locations,
});

function slotSettings(patch: Partial<Settings>): Settings {
  return { ...defaultSettings(1024), timeMode: "slots", slotTolerance: 15, columnAxis: "none", ...patch };
}

function resetStore(day: string, settings: Settings): void {
  useStore.setState({
    day,
    view: "grid",
    filters: { ...EMPTY_FILTERS },
    settings,
    favourites: [],
    selectedSessionId: null,
    openSheet: null,
    sharedPlan: null,
    previewPlan: null,
    now: new Date(2026, 8, 4, 10, 30),
    toasts: [],
    copyText: null,
  });
}

function cell(key: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-cell="${key}"]`);
  if (!el) throw new Error(`missing cell wrapper ${key}`);
  return el;
}

function parseRow(gridRow: string): { row: number; span: number } {
  const match = /^(\d+)(?:\s*\/\s*span\s+(\d+))?$/.exec(gridRow.trim());
  if (!match) throw new Error(`unexpected grid-row: ${gridRow}`);
  return { row: Number(match[1]), span: match[2] === undefined ? 1 : Number(match[2]) };
}

function items(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("[data-cell], [data-span]")];
}

/** Every wrapper and spanning item expanded to its (column, row) cells; no cell may be covered twice. */
function expectDisjoint(): void {
  const covered: string[] = [];
  for (const item of items()) {
    const column = Number.parseInt(item.style.gridColumn, 10);
    const { row, span } = parseRow(item.style.gridRow);
    expect(Number.isFinite(column)).toBe(true);
    for (let r = row; r < row + span; r += 1) covered.push(`${column}:${r}`);
  }
  expect(covered.length).toBeGreaterThan(0);
  expect(new Set(covered).size).toBe(covered.length);
}

/** Every session id appears at most once per column as a card. */
function expectOneCardPerColumn(): void {
  const perColumn = new Map<string, string[]>();
  for (const item of items()) {
    const ids = [...item.querySelectorAll("article[data-session-id]")].map((el) => el.getAttribute("data-session-id") ?? "");
    perColumn.set(item.style.gridColumn, [...(perColumn.get(item.style.gridColumn) ?? []), ...ids]);
  }
  for (const ids of perColumn.values()) expect(new Set(ids).size).toBe(ids.length);
}

/** Spec §7.3: wrappers and spanning items sit in DOM order by (column, row), so Tab order follows start time. */
function expectDomOrderFollowsRows(): void {
  const order = items().map((item) => ({
    column: Number.parseInt(item.style.gridColumn, 10),
    row: parseRow(item.style.gridRow).row,
  }));
  const sorted = [...order].sort((a, b) => a.column - b.column || a.row - b.row);
  expect(order).toEqual(sorted);
}

describe("forced slot mode on the synthetic spec §10 set", () => {
  beforeEach(() => resetStore("sob", slotSettings({})));

  it("renders the slot grid with rail rows 09:30, 10:15 and 11:00", () => {
    renderGrid(data);
    expect(document.querySelectorAll("[data-scroll-container]")).toHaveLength(1);
    expect(document.querySelector('[data-scroll-container="slots"]')).not.toBeNull();
    const rows = [...document.querySelectorAll<HTMLElement>("[data-slot-row]")];
    expect(rows.map((r) => r.style.gridRow)).toEqual(["2", "3", "4"]);
    expect(rows.map((r) => r.firstElementChild?.textContent)).toEqual(["09:30", "10:15", "11:00"]);
    expect(rows.map((r) => r.children.length)).toEqual([1, 1, 1]);
  });

  it("declares the header row and the minimum slot row height on the grid", () => {
    renderGrid(data);
    const grid = document.querySelector<HTMLElement>('[data-scroll-container="slots"]');
    expect(grid?.style.gridTemplateRows).toBe("auto");
    expect(grid?.style.gridAutoRows).toBe("minmax(88px, auto)");
  });

  it("confines the first two sessions with one stub each and gives the third a bare card", () => {
    renderGrid(data);
    expect(cell("0:0").querySelectorAll('article[data-session-id="1:sob"]')).toHaveLength(1);
    expect(cell("0:1").querySelectorAll('[data-stub][data-session-id="1:sob"][aria-hidden="true"]')).toHaveLength(1);
    expect(cell("0:1").querySelectorAll('article[data-session-id="2:sob"]')).toHaveLength(1);
    expect(cell("0:2").querySelectorAll('[data-stub][data-session-id="2:sob"][aria-hidden="true"]')).toHaveLength(1);
    expect(cell("0:2").querySelectorAll('article[data-session-id="3:sob"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-stub][data-session-id="3:sob"]')).toHaveLength(0);
    expect(document.querySelectorAll("[data-span]")).toHaveLength(0);
    expect(cell("0:1").style.gridColumn).toBe("2");
    expect(cell("0:1").style.gridRow).toBe("3");
  });

  it("lists stubs before cards, never repeats a session inside one wrapper and covers each cell once", () => {
    renderGrid(data);
    const wrappers = [...document.querySelectorAll<HTMLElement>("[data-cell]")];
    expect(wrappers).toHaveLength(3);
    for (const wrapper of wrappers) {
      const kinds = [...wrapper.children].map((el) =>
        el.hasAttribute("data-stub") ? "stub" : el.tagName === "ARTICLE" ? "card" : "other",
      );
      const firstCard = kinds.indexOf("card");
      const lastStub = kinds.lastIndexOf("stub");
      if (firstCard >= 0 && lastStub >= 0) expect(lastStub).toBeLessThan(firstCard);
      const ids = [...wrapper.querySelectorAll("[data-session-id]")].map((el) => el.getAttribute("data-session-id"));
      expect(new Set(ids).size).toBe(ids.length);
    }
    expectDomOrderFollowsRows();
    expectDisjoint();
    expectOneCardPerColumn();
  });

  it("marks the slot containing now with a column-spanning line and a chip in that rail cell", () => {
    useStore.setState({ now: new Date(2026, 8, 5, 10, 20) });
    renderGrid(data);
    const line = document.querySelector<HTMLElement>("[data-now-line]");
    expect(line?.id).toBe("now-line");
    expect(line?.style.gridColumn.replace(/\s+/g, " ")).toBe("1 / -1");
    expect(line?.style.gridRow).toBe("3");
    const railCell = document.querySelector<HTMLElement>('[data-slot-row="1"]');
    expect(railCell).not.toBeNull();
    expect(within(railCell as HTMLElement).getByText("10:20")).not.toBeNull();
    act(() => useStore.getState().setNow(new Date(2026, 8, 5, 12, 30)));
    expect(document.querySelector("[data-now-line]")).toBeNull();
  });
});

describe("forced slot mode on the Friday lectures fixture", () => {
  beforeEach(() => resetStore("pt", slotSettings({ columnAxis: "type" })));

  it("has 13 rail rows with 13:20 at row 3 and a 13:40–13:50 range at row 4", () => {
    renderGrid(data);
    const rows = [...document.querySelectorAll<HTMLElement>("[data-slot-row]")];
    expect(rows).toHaveLength(13);
    expect(rows[3]?.firstElementChild?.textContent).toBe("13:20");
    expect(rows[3]?.children).toHaveLength(1);
    expect(rows[4]?.firstElementChild?.textContent).toBe("13:40");
    expect(rows[4]?.children[1]?.textContent).toBe("13:40–13:50");
  });

  it("confines the 13:20–14:20 lecture under the type axis with a stub in the 13:40 row", () => {
    renderGrid(data);
    const card = document.querySelector('[data-cell] article[data-session-id="39564:pt"]');
    expect(card?.closest("[data-cell]")?.getAttribute("data-cell")).toBe("0:3");
    expect(cell("0:4").querySelectorAll('[data-stub][data-session-id="39564:pt"]')).toHaveLength(1);
    expect(document.querySelector('[data-span="39564:pt"]')).toBeNull();
    expectDisjoint();
    expectOneCardPerColumn();
  });

  it("spans it over two rows under the location axis and renders no stubs at all", () => {
    useStore.setState({ settings: slotSettings({ columnAxis: "location" }) });
    renderGrid(data);
    const span = document.querySelector<HTMLElement>('[data-span="39564:pt"]');
    expect(span).not.toBeNull();
    const spanItem = span as HTMLElement;
    expect(spanItem.style.gridRow.replace(/\s+/g, " ")).toBe("5 / span 2");
    expect(spanItem.querySelectorAll('article[data-session-id="39564:pt"]')).toHaveLength(1);
    expect(document.querySelectorAll("[data-stub]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-span]")).toHaveLength(9);
    // Spec §7.3: in its column the spanning item precedes every wrapper of a later row and follows every earlier one.
    const sameColumn = items().filter((el) => el !== spanItem && el.style.gridColumn === spanItem.style.gridColumn);
    for (const el of sameColumn) {
      const follows = (spanItem.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      expect(follows).toBe(parseRow(el.style.gridRow).row > 5);
    }
    expectDomOrderFollowsRows();
    expectDisjoint();
    expectOneCardPerColumn();
  });

  it("keeps the confinement and the stub when a query leaves only that card", () => {
    useStore.setState({ filters: { ...EMPTY_FILTERS, query: "sportowa" } });
    renderGrid(data);
    expect(document.querySelectorAll("[data-scroll-container] article")).toHaveLength(1);
    expect(document.querySelectorAll("[data-column-header]")).toHaveLength(1);
    expect(cell("0:3").querySelectorAll('article[data-session-id="39564:pt"]')).toHaveLength(1);
    expect(cell("0:4").querySelectorAll('[data-stub][data-session-id="39564:pt"]')).toHaveLength(1);
    expect(document.querySelector("[data-span]")).toBeNull();
    expect(document.querySelectorAll("[data-slot-row]")).toHaveLength(13);
  });

  it("renders every fixture session exactly once as a card under the none axis", () => {
    useStore.setState({ settings: slotSettings({ columnAxis: "none" }) });
    renderGrid(data);
    const ids = [...document.querySelectorAll("[data-scroll-container] article[data-session-id]")].map((el) =>
      el.getAttribute("data-session-id"),
    );
    expect(ids).toHaveLength(27);
    expect(new Set(ids).size).toBe(27);
    expectDomOrderFollowsRows();
    expectDisjoint();
  });

  it("logs no DOM nesting warning while rendering the location-axis grid", () => {
    useStore.setState({ settings: slotSettings({ columnAxis: "location" }) });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      renderGrid(data);
      expect(document.querySelectorAll("[data-scroll-container] article").length).toBeGreaterThanOrEqual(27);
      expect(nestingWarnings(spy)).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tom/Projects/conference-melt && npx vitest run src/test/ScheduleGrid.slots.test.tsx`

Expected: the file loads (the harness exists) and every test fails, the first with `AssertionError: expected null not to be null` on `[data-scroll-container="slots"]`, because `ScheduleGrid` still renders `TimelineBody` for the slot mode.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/grid/SlotBody.tsx`:

```tsx
import { useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import styles from "./SlotBody.module.css";
import type { TimedSession } from "../../data/types";
import type { Slot } from "../../domain/slots";
import { formatRange, formatTime } from "../../domain/time";
import type { Column } from "../../state/derive";
import { useStore } from "../../state/store";
import { ColumnHeader } from "./ColumnHeader";
import { ContinuationStub } from "./ContinuationStub";
import { NowChip, NowLine } from "./NowLine";
import { SessionCard } from "./SessionCard";
import {
  gridArea,
  nowScrollTop,
  prefersReducedMotion,
  slotCells,
  slotPlacements,
  type Density,
  type SlotCell,
  type SlotPlacement,
} from "./gridLayout";

export interface SlotBodyProps {
  columns: Column[];
  slots: Slot[];
  density: Density;
  nowMinutes: number | null;
  dayId: string;
}

/** Spec §8: entrance stagger of 12 ms per card, capped at 240 ms. */
const STAGGER_MS = 12;
const STAGGER_MAX_MS = 240;

function enterDelay(order: number): string {
  return `${Math.min(order * STAGGER_MS, STAGGER_MAX_MS)}ms`;
}

/** Spec §7.2: the row r with slots[r].start <= now < slots[r].end, or -1. */
function nowRowOf(slots: Slot[], nowMinutes: number | null): number {
  if (nowMinutes === null) return -1;
  return slots.findIndex((slot) => slot.start <= nowMinutes && nowMinutes < slot.end);
}

/** One grid item: a cell wrapper (stubs, overflow, cards) or a spanning card; both are placed by (column, row). */
type GridItem =
  | { kind: "cell"; column: number; row: number; cell: SlotCell }
  | { kind: "span"; column: number; row: number; placement: SlotPlacement };

export function SlotBody({ columns, slots, density, nowMinutes, dayId }: SlotBodyProps) {
  const axis = useStore((s) => s.settings.columnAxis);
  const tolerance = useStore((s) => s.settings.slotTolerance);
  const compact = useStore((s) => s.settings.density === "compact");
  const showLocation = axis !== "location";
  const animate = !prefersReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);

  const { items, sessionById } = useMemo(() => {
    const placements = columns.flatMap((column, i) => slotPlacements(column, i, slots, tolerance, column.renderedIds));
    const sessionById = new Map<string, TimedSession>();
    for (const column of columns) {
      for (const s of column.sessions) sessionById.set(s.id, s);
    }
    const items: GridItem[] = [
      ...slotCells(placements).map((cell): GridItem => ({ kind: "cell", column: cell.column, row: cell.row, cell })),
      ...placements
        .filter((p) => p.kind === "span")
        .map((placement): GridItem => ({ kind: "span", column: placement.column, row: placement.row, placement })),
    ];
    // Spec §7.3: DOM order inside a column follows start time, so wrappers and spanning cards interleave by row.
    items.sort((a, b) => a.column - b.column || a.row - b.row);
    return { items, sessionById };
  }, [columns, slots, tolerance]);

  const nowRow = nowRowOf(slots, nowMinutes);

  // First render for a day: put the now line a third of the way down the viewport (spec §7.2).
  useLayoutEffect(() => {
    if (nowRow < 0 || scrolledFor.current === dayId) return;
    scrolledFor.current = dayId;
    const el = scroller.current;
    const line = el?.querySelector<HTMLElement>("[data-now-line]");
    if (!el || !line || typeof el.scrollTo !== "function") return;
    el.scrollTo({ top: nowScrollTop(line.offsetTop, el.clientHeight), behavior: "auto" });
  }, [dayId, nowRow]);

  const track = axis === "none" ? "minmax(calc(100% - var(--rail-width)), auto)" : `${density.minColumnWidth}px`;
  const style: CSSProperties = {
    gridTemplateColumns: `var(--rail-width) ${columns.map(() => track).join(" ")}`,
    gridTemplateRows: "auto",
    gridAutoRows: `minmax(${density.rowMin}px, auto)`,
  };

  // Cards are numbered in DOM order, which is (column, row) order, for the entrance stagger.
  let order = 0;
  const renderCard = (p: SlotPlacement): ReactNode => {
    const s = sessionById.get(p.sessionId);
    if (!s) return null;
    const delay = animate ? enterDelay(order++) : undefined;
    return (
      <SessionCard
        key={s.id}
        session={s}
        variant="grid"
        compact={compact}
        showLocation={showLocation}
        style={delay === undefined ? undefined : { animationDelay: delay }}
      />
    );
  };

  return (
    <div ref={scroller} className={styles.scroller} style={style} data-scroll-container="slots">
      <div className={styles.corner} style={{ gridColumn: "1", gridRow: "1" }} aria-hidden="true" />
      {columns.map((column, i) => (
        <ColumnHeader key={column.key} column={column} className={styles.header} style={{ gridColumn: String(i + 2), gridRow: "1" }} />
      ))}
      {slots.map((slot) => (
        <div
          key={slot.index}
          className={styles.railCell}
          style={{ gridColumn: "1", gridRow: String(slot.index + 2) }}
          data-slot-row={slot.index}
        >
          <span className={styles.railStart}>{formatTime(slot.start)}</span>
          {slot.lastStart !== slot.start && <span className={styles.railRange}>{formatRange(slot.start, slot.lastStart)}</span>}
          {slot.index === nowRow && nowMinutes !== null && <NowChip label={formatTime(nowMinutes)} />}
        </div>
      ))}
      {items.map((item) => {
        if (item.kind === "span") {
          const p = item.placement;
          return (
            <div key={`span:${p.column}:${p.sessionId}`} className={styles.span} style={gridArea(p)} data-span={p.sessionId}>
              {renderCard(p)}
            </div>
          );
        }
        const { cell } = item;
        const anchor = cell.stubs[0] ?? cell.cards[0];
        if (!anchor) return null;
        const key = `${cell.column}:${cell.row}`;
        return (
          <div key={`cell:${key}`} className={styles.cell} style={gridArea(anchor)} data-cell={key}>
            {cell.stubs.map((p) => {
              const s = sessionById.get(p.sessionId);
              return s ? <ContinuationStub key={s.id} session={s} /> : null;
            })}
            {cell.overflow > 0 && <span className={styles.more}>{`+${cell.overflow} w trakcie`}</span>}
            {cell.cards.map(renderCard)}
          </div>
        );
      })}
      {nowRow >= 0 && <NowLine style={{ gridColumn: "1 / -1", gridRow: String(nowRow + 2) }} />}
    </div>
  );
}
```

Create `src/components/grid/SlotBody.module.css`:

```css
/* The scroll container is the grid itself: row 1 headers, rows 2.. the slots (spec §7.2). */
.scroller {
  position: relative;
  display: grid;
  align-content: start;
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  background: var(--bg);
}

.corner {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 4;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: var(--surface-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.header {
  position: sticky;
  top: 0;
  z-index: 3;
  border-bottom: 1px solid var(--border);
  background: var(--surface-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.railCell {
  position: sticky;
  left: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: var(--rail-width);
  padding: 8px 6px;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: var(--surface-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.railStart {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.railRange {
  color: var(--text-muted);
  font-size: var(--text-min);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.cell,
.span {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 6px;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.span > article {
  flex: 1;
}

.more {
  color: var(--text-muted);
  font-size: 12px;
}
```

Modify `src/components/grid/ScheduleGrid.tsx`: add the import and the branch. The complete file after the change:

```tsx
import { useMemo, type ReactNode } from "react";
import styles from "./ScheduleGrid.module.css";
import { useData } from "../../data/index";
import type { ScheduleData } from "../../data/types";
import { activeFilterCount, signupLabel, type Filters } from "../../domain/filters";
import type { DataIndex } from "../../domain/lookup";
import { nowFor } from "../../domain/now";
import type { Column, DaySets, ResolvedTime } from "../../state/derive";
import { useStore } from "../../state/store";
import { Chip } from "../ui/Chip";
import { EmptyState } from "../ui/EmptyState";
import { cx } from "../ui/cx";
import { coarsePointer, densityFor } from "./gridLayout";
import { SlotBody } from "./SlotBody";
import { TimelineBody } from "./TimelineBody";

export interface ScheduleGridProps {
  sets: DaySets;
  columns: Column[];
  resolved: ResolvedTime;
  dayId: string;
}

const FILTERED_EMPTY = "Brak wydarzeń dla tych filtrów";
const STRIP_ONLY_EMPTY = "Wszystkie pasujące wydarzenia są całodniowe lub bez godziny. Znajdziesz je powyżej";

/** Labels of every active filter, in FilterChips order, for the empty states (PlanView may reuse it). */
export function filterLabels(filters: Filters, data: ScheduleData, index: DataIndex): string[] {
  const labels = [
    ...filters.types.map((id) => index.typeById.get(id)?.name ?? String(id)),
    ...filters.locations.map((id) => index.locationById.get(id)?.short ?? String(id)),
    ...filters.themes.map((id) => index.themeById.get(id)?.name ?? String(id)),
    ...filters.brands.map((id) => index.brandById.get(id)?.name ?? String(id)),
    ...filters.signup.map((status) => signupLabel(status, data)),
  ];
  if (filters.query.trim().length > 0) labels.push(`Szukaj: „${filters.query}”`);
  if (filters.onlyFavourites) labels.push("Tylko ulubione");
  if (filters.hideAllDay) labels.push("Ukryj strefy całodniowe");
  return labels;
}

export interface FilteredEmptyProps {
  /** Title line; defaults to the spec §9 "Brak wydarzeń dla tych filtrów". */
  text?: string;
  /** Extra buttons, rendered between the filter chips and "Wyczyść filtry". */
  extraActions?: ReactNode;
}

/**
 * Spec §9: the filter empty state — the title, one chip per active filter and "Wyczyść filtry"
 * only while a filter is on. Both grid empty states render through it; PlanView (Task 33) reuses it.
 */
export function FilteredEmpty({ text = FILTERED_EMPTY, extraActions }: FilteredEmptyProps) {
  const { data, index } = useData();
  const filters = useStore((s) => s.filters);
  const clearFilters = useStore((s) => s.clearFilters);
  const labels = filterLabels(filters, data, index);

  return (
    <EmptyState
      title={text}
      actions={
        <>
          {labels.length > 0 && (
            <span className={styles.chips}>
              {labels.map((label, i) => (
                <Chip key={`${i}-${label}`} tone="accent">
                  {label}
                </Chip>
              ))}
            </span>
          )}
          {extraActions}
          {activeFilterCount(filters) > 0 && (
            <button type="button" className={cx(styles.button, styles.secondary)} onClick={clearFilters}>
              Wyczyść filtry
            </button>
          )}
        </>
      }
    />
  );
}

/** Spec §9: replaces the scroll container whenever the rendered set is empty. */
function GridEmpty({ sets }: { sets: DaySets }) {
  const setSettings = useStore((s) => s.setSettings);
  const stripOnly = sets.visible.length > 0;

  return (
    <FilteredEmpty
      text={stripOnly ? STRIP_ONLY_EMPTY : FILTERED_EMPTY}
      extraActions={
        stripOnly && sets.stripAllDay.length > 0 ? (
          <button type="button" className={styles.button} onClick={() => setSettings({ allDayStrip: false })}>
            Pokaż w siatce
          </button>
        ) : undefined
      }
    />
  );
}

export function ScheduleGrid({ sets, columns, resolved, dayId }: ScheduleGridProps) {
  const { index } = useData();
  const densitySetting = useStore((s) => s.settings.density);
  const now = useStore((s) => s.now);
  const density = useMemo(() => densityFor(densitySetting, coarsePointer()), [densitySetting]);
  const day = index.dayById.get(dayId);
  const nowMinutes = day ? nowFor(day, now) : null;

  return (
    <section className={styles.grid} aria-label="Siatka harmonogramu">
      {sets.rendered.length === 0 ? (
        <GridEmpty sets={sets} />
      ) : (
        <div key={`${resolved.mode}:${dayId}`} className={styles.fade}>
          {resolved.mode === "slots" ? (
            <SlotBody columns={columns} slots={resolved.slots} density={density} nowMinutes={nowMinutes} dayId={dayId} />
          ) : (
            <TimelineBody sets={sets} columns={columns} density={density} nowMinutes={nowMinutes} dayId={dayId} />
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/tom/Projects/conference-melt && npx vitest run src/test/ScheduleGrid.slots.test.tsx` — expected: 11 tests pass. These assertions were verified against jsdom 30.x; if `npm install` resolves jsdom 26.x and the `calc()` or `gridRow` read-back assertions fail, bump `jsdom` in package.json to `^30.0.1` and re-run.

Run: `cd /Users/tom/Projects/conference-melt && npx vitest run src/test/ScheduleGrid.timeline.test.tsx src/test/SessionCard.test.tsx` — expected: still green (the timeline file forces `timeMode: "timeline"`, so nothing there changes mode).

Run: `cd /Users/tom/Projects/conference-melt && npm run typecheck` — expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/tom/Projects/conference-melt && git add src/components/grid/SlotBody.tsx src/components/grid/SlotBody.module.css src/components/grid/ScheduleGrid.tsx src/test/ScheduleGrid.slots.test.tsx && git commit -F - <<'EOF'
feat(grid): add the slot-mode body

The scroll container is the CSS grid: rail cells per detected slot,
cell wrappers with stubs before cards and "+N w trakcie", spanning
cards at "row / span k" when spanAllowed, wrappers and spans in one
(column, row)-sorted DOM order, the now line as a column-spanning item
with its chip in the rail cell; ScheduleGrid branches on the resolved
mode.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2
EOF
```

---

### Task 28: Strips and wiring

**Files:**
- Create: `src/components/grid/Strips.tsx`
- Create: `src/components/grid/Strips.module.css`
- Modify: `src/components/grid/ScheduleGrid.tsx` (render `<Strips sets={sets} />` above the body / empty state)
- Test: `src/test/Strips.test.tsx`

**Interfaces:**
- Consumes:
  - `src/state/derive.ts`: `DaySets` (`stripAllDay` is already empty while `settings.allDayStrip` is off; `stripNoTime` holds visible sessions without a start).
  - Task 25: `SessionCard` (variant `"chip"`); Task 26: `renderGrid` and `GridHarness` (test harness), `NowLine` hooks.
  - `src/components/shell/FilterChips.tsx` (Task 23): `FilterChips()` — rendered in the test next to the harness; its remove buttons are named `Usuń filtr: <label>`.
  - `src/components/shell/LiveChip.tsx` (Task 23) scrolls to `document.querySelector("[data-now-line]")` in grid view — provided by `NowLine` since Task 26; this task verifies the hook end to end through `ScheduleGrid`.
- Produces:
  - `Strips({ sets: DaySets })` — `div[data-strips]` holding, in order, the all-day strip (`role="group"`, name `"Całodniowe (N)"`) and the no-time strip (name `"Bez godziny (N)"`), each a horizontally scrolling row of chip cards; renders `null` when both are empty. Strips sit outside and above the scroll container and are not sticky.

- [ ] **Step 1: Write the failing test**

Create `src/test/Strips.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataProvider, buildAppData } from "../data/index";
import { EMPTY_FILTERS } from "../domain/filters";
import { defaultSettings, useStore } from "../state/store";
import { FilterChips } from "../components/shell/FilterChips";
import { makeData, makeSession } from "./fixtures/build";
import { GridHarness, renderGrid } from "./gridHarness";

const STRIP_ONLY_EMPTY = "Wszystkie pasujące wydarzenia są całodniowe lub bez godziny. Znajdziesz je powyżej";

const zone = makeSession({
  id: "30:pt",
  eventId: 30,
  title: "Rejestracja",
  start: 540,
  end: 1080,
  allDay: true,
  typeIds: [242],
  locationIds: [318],
});
const talk = makeSession({ id: "1:pt", eventId: 1, title: "Wykład", start: 600, end: 660 });
const noTime = makeSession({ id: "4:pt", eventId: 4, title: "Bez godziny sesja", start: null, end: null });
const data = makeData([zone, talk, noTime]);

// Two lectures (type 184, Prelekcja) and one workshop (type 5, Warsztaty) for the filter-chip round trip.
const second = makeSession({ id: "3:pt", eventId: 3, title: "Drugi wykład", start: 720, end: 780 });
const workshop = makeSession({ id: "2:pt", eventId: 2, title: "Warsztat", start: 660, end: 720, typeIds: [5] });
const chipData = makeData([talk, second, workshop, noTime]);

beforeEach(() => {
  useStore.setState({
    day: "pt",
    view: "grid",
    filters: { ...EMPTY_FILTERS },
    settings: defaultSettings(1024),
    favourites: [],
    selectedSessionId: null,
    openSheet: null,
    sharedPlan: null,
    previewPlan: null,
    now: new Date(2026, 8, 4, 10, 30),
    toasts: [],
    copyText: null,
  });
});

describe("Strips", () => {
  it("with the location facet on Rejestracja renders one chip, the strip-only empty state and no scroll container", () => {
    useStore.setState({ filters: { ...EMPTY_FILTERS, locations: [318] } });
    renderGrid(data);
    const strip = screen.getByRole("group", { name: "Całodniowe (1)" });
    expect(within(strip).getAllByRole("article")).toHaveLength(1);
    expect(within(strip).getByRole("button", { name: "Rejestracja, 09:00–18:00, Rejestracja" })).not.toBeNull();
    expect(within(strip).getByRole("button", { name: "Do planu" })).not.toBeNull();
    expect(screen.queryByRole("group", { name: /Bez godziny/ })).toBeNull();
    expect(screen.getByText(STRIP_ONLY_EMPTY)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Pokaż w siatce" })).not.toBeNull();
    expect(document.querySelector("[data-scroll-container]")).toBeNull();
  });

  it("with the all-day strip off renders one column holding that card and no strip", () => {
    useStore.setState({ filters: { ...EMPTY_FILTERS, locations: [318] } });
    renderGrid(data);
    act(() => useStore.getState().setSettings({ allDayStrip: false }));
    expect(screen.queryByRole("group", { name: /Całodniowe/ })).toBeNull();
    expect(screen.queryByText(STRIP_ONLY_EMPTY)).toBeNull();
    const headers = document.querySelectorAll("[data-column-header]");
    expect(headers).toHaveLength(1);
    expect(headers[0]?.textContent).toContain("Rejestracja");
    expect(document.querySelector('[data-scroll-container] article[data-session-id="30:pt"]')).not.toBeNull();
  });

  it("renders the Bez godziny strip after the all-day strip, both outside the scroll container", () => {
    renderGrid(data);
    const allDay = screen.getByRole("group", { name: "Całodniowe (1)" });
    const none = screen.getByRole("group", { name: "Bez godziny (1)" });
    expect(within(none).getByRole("button", { name: "Bez godziny sesja, Sala wykł. 1" })).not.toBeNull();
    expect(allDay.compareDocumentPosition(none) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const scroller = document.querySelector('[data-scroll-container="timeline"]');
    const strips = document.querySelector("[data-strips]");
    expect(scroller).not.toBeNull();
    expect(strips).not.toBeNull();
    expect((scroller as Element).querySelector("[data-strips]")).toBeNull();
    expect((strips as Element).compareDocumentPosition(scroller as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((scroller as Element).querySelectorAll("article")).toHaveLength(1);
  });

  it("renders no strips when nothing sits in them", () => {
    useStore.setState({ filters: { ...EMPTY_FILTERS, locations: [233] } });
    renderGrid(data);
    expect(document.querySelector("[data-strips]")).toBeNull();
    expect(document.querySelector('[data-scroll-container="timeline"]')).not.toBeNull();
  });

  it("chip stars toggle favourites", async () => {
    const user = userEvent.setup();
    renderGrid(data);
    const none = screen.getByRole("group", { name: "Bez godziny (1)" });
    await user.click(within(none).getByRole("button", { name: "Do planu" }));
    expect(useStore.getState().favourites).toEqual(["4:pt"]);
    expect(within(none).getByRole("button", { name: "Do planu" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("hides chip stars during a shared-plan preview", () => {
    useStore.setState({ previewPlan: ["4:pt"] });
    renderGrid(data);
    expect(within(document.querySelector("[data-strips]") as HTMLElement).queryByRole("button", { name: "Do planu" })).toBeNull();
  });

  it("keeps the now line reachable for the live chip", () => {
    renderGrid(data);
    const line = document.querySelector<HTMLElement>("[data-now-line]");
    expect(line?.id).toBe("now-line");
    expect(line?.closest("[data-scroll-container]")).not.toBeNull();
  });

  it("removing a filter chip restores the sessions", async () => {
    const user = userEvent.setup();
    useStore.setState({ filters: { ...EMPTY_FILTERS, types: [5] } });
    render(
      <DataProvider value={buildAppData(chipData)}>
        <FilterChips />
        <GridHarness />
      </DataProvider>,
    );
    const cardIds = () =>
      [...document.querySelectorAll("[data-scroll-container] article[data-session-id]")]
        .map((el) => el.getAttribute("data-session-id"))
        .sort();
    expect(cardIds()).toEqual(["2:pt"]);
    await user.click(screen.getByRole("button", { name: "Usuń filtr: Warsztaty" }));
    expect(useStore.getState().filters.types).toEqual([]);
    expect(screen.queryByRole("button", { name: "Usuń filtr: Warsztaty" })).toBeNull();
    expect(cardIds()).toEqual(["1:pt", "2:pt", "3:pt"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tom/Projects/conference-melt && npx vitest run src/test/Strips.test.tsx`

Expected: the file loads and the strip tests fail with `TestingLibraryElementError: Unable to find an accessible element with the role "group" and name "Całodniowe (1)"` (only "renders no strips when nothing sits in them", "keeps the now line reachable for the live chip" and "removing a filter chip restores the sessions" pass, since none of them asserts a strip).

- [ ] **Step 3: Write minimal implementation**

Create `src/components/grid/Strips.tsx`:

```tsx
import styles from "./Strips.module.css";
import type { Session } from "../../data/types";
import type { DaySets } from "../../state/derive";
import { SessionCard } from "./SessionCard";

export interface StripsProps {
  sets: DaySets;
}

function Strip({ label, sessions }: { label: string; sessions: Session[] }) {
  return (
    <div className={styles.strip} role="group" aria-label={label}>
      <span className={styles.label}>{label}</span>
      <div className={styles.row}>
        {sessions.map((s) => (
          <SessionCard key={s.id} session={s} variant="chip" showLocation={false} />
        ))}
      </div>
    </div>
  );
}

/**
 * Spec §7.2 strips, outside and above the scroll container. `daySets` already empties
 * `stripAllDay` while `settings.allDayStrip` is off, so the sets alone decide what renders.
 */
export function Strips({ sets }: StripsProps) {
  if (sets.stripAllDay.length === 0 && sets.stripNoTime.length === 0) return null;
  return (
    <div className={styles.strips} data-strips="">
      {sets.stripAllDay.length > 0 && <Strip label={`Całodniowe (${sets.stripAllDay.length})`} sessions={sets.stripAllDay} />}
      {sets.stripNoTime.length > 0 && <Strip label={`Bez godziny (${sets.stripNoTime.length})`} sessions={sets.stripNoTime} />}
    </div>
  );
}
```

Create `src/components/grid/Strips.module.css`:

```css
.strips {
  display: flex;
  flex-direction: column;
  flex: none;
  border-bottom: 1px solid var(--border);
  background: var(--surface-1);
}

/* One row of chips, at most 44 px tall (spec §7.2); chips are 36 px, 44 px on coarse pointers. */
.strip {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 12px;
}

.strip + .strip {
  border-top: 1px solid var(--border);
}

.label {
  flex: none;
  color: var(--text-muted);
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}

.row::-webkit-scrollbar {
  display: none;
}
```

Modify `src/components/grid/ScheduleGrid.tsx`: import `Strips` and render it first inside the section. The complete file after the change:

```tsx
import { useMemo, type ReactNode } from "react";
import styles from "./ScheduleGrid.module.css";
import { useData } from "../../data/index";
import type { ScheduleData } from "../../data/types";
import { activeFilterCount, signupLabel, type Filters } from "../../domain/filters";
import type { DataIndex } from "../../domain/lookup";
import { nowFor } from "../../domain/now";
import type { Column, DaySets, ResolvedTime } from "../../state/derive";
import { useStore } from "../../state/store";
import { Chip } from "../ui/Chip";
import { EmptyState } from "../ui/EmptyState";
import { cx } from "../ui/cx";
import { coarsePointer, densityFor } from "./gridLayout";
import { SlotBody } from "./SlotBody";
import { Strips } from "./Strips";
import { TimelineBody } from "./TimelineBody";

export interface ScheduleGridProps {
  sets: DaySets;
  columns: Column[];
  resolved: ResolvedTime;
  dayId: string;
}

const FILTERED_EMPTY = "Brak wydarzeń dla tych filtrów";
const STRIP_ONLY_EMPTY = "Wszystkie pasujące wydarzenia są całodniowe lub bez godziny. Znajdziesz je powyżej";

/** Labels of every active filter, in FilterChips order, for the empty states (PlanView may reuse it). */
export function filterLabels(filters: Filters, data: ScheduleData, index: DataIndex): string[] {
  const labels = [
    ...filters.types.map((id) => index.typeById.get(id)?.name ?? String(id)),
    ...filters.locations.map((id) => index.locationById.get(id)?.short ?? String(id)),
    ...filters.themes.map((id) => index.themeById.get(id)?.name ?? String(id)),
    ...filters.brands.map((id) => index.brandById.get(id)?.name ?? String(id)),
    ...filters.signup.map((status) => signupLabel(status, data)),
  ];
  if (filters.query.trim().length > 0) labels.push(`Szukaj: „${filters.query}”`);
  if (filters.onlyFavourites) labels.push("Tylko ulubione");
  if (filters.hideAllDay) labels.push("Ukryj strefy całodniowe");
  return labels;
}

export interface FilteredEmptyProps {
  /** Title line; defaults to the spec §9 "Brak wydarzeń dla tych filtrów". */
  text?: string;
  /** Extra buttons, rendered between the filter chips and "Wyczyść filtry". */
  extraActions?: ReactNode;
}

/**
 * Spec §9: the filter empty state — the title, one chip per active filter and "Wyczyść filtry"
 * only while a filter is on. Both grid empty states render through it; PlanView (Task 33) reuses it.
 */
export function FilteredEmpty({ text = FILTERED_EMPTY, extraActions }: FilteredEmptyProps) {
  const { data, index } = useData();
  const filters = useStore((s) => s.filters);
  const clearFilters = useStore((s) => s.clearFilters);
  const labels = filterLabels(filters, data, index);

  return (
    <EmptyState
      title={text}
      actions={
        <>
          {labels.length > 0 && (
            <span className={styles.chips}>
              {labels.map((label, i) => (
                <Chip key={`${i}-${label}`} tone="accent">
                  {label}
                </Chip>
              ))}
            </span>
          )}
          {extraActions}
          {activeFilterCount(filters) > 0 && (
            <button type="button" className={cx(styles.button, styles.secondary)} onClick={clearFilters}>
              Wyczyść filtry
            </button>
          )}
        </>
      }
    />
  );
}

/** Spec §9: replaces the scroll container whenever the rendered set is empty. */
function GridEmpty({ sets }: { sets: DaySets }) {
  const setSettings = useStore((s) => s.setSettings);
  const stripOnly = sets.visible.length > 0;

  return (
    <FilteredEmpty
      text={stripOnly ? STRIP_ONLY_EMPTY : FILTERED_EMPTY}
      extraActions={
        stripOnly && sets.stripAllDay.length > 0 ? (
          <button type="button" className={styles.button} onClick={() => setSettings({ allDayStrip: false })}>
            Pokaż w siatce
          </button>
        ) : undefined
      }
    />
  );
}

export function ScheduleGrid({ sets, columns, resolved, dayId }: ScheduleGridProps) {
  const { index } = useData();
  const densitySetting = useStore((s) => s.settings.density);
  const now = useStore((s) => s.now);
  const density = useMemo(() => densityFor(densitySetting, coarsePointer()), [densitySetting]);
  const day = index.dayById.get(dayId);
  const nowMinutes = day ? nowFor(day, now) : null;

  return (
    <section className={styles.grid} aria-label="Siatka harmonogramu">
      <Strips sets={sets} />
      {sets.rendered.length === 0 ? (
        <GridEmpty sets={sets} />
      ) : (
        <div key={`${resolved.mode}:${dayId}`} className={styles.fade}>
          {resolved.mode === "slots" ? (
            <SlotBody columns={columns} slots={resolved.slots} density={density} nowMinutes={nowMinutes} dayId={dayId} />
          ) : (
            <TimelineBody sets={sets} columns={columns} density={density} nowMinutes={nowMinutes} dayId={dayId} />
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/tom/Projects/conference-melt && npx vitest run src/test/Strips.test.tsx` — expected: 8 tests pass.

Run: `cd /Users/tom/Projects/conference-melt && npx vitest run src/test/SessionCard.test.tsx src/test/ScheduleGrid.timeline.test.tsx src/test/ScheduleGrid.slots.test.tsx src/components/grid/gridLayout.test.ts` — expected: all green (the timeline file's zone now also renders as an all-day chip, which none of its assertions exclude: card lookups are by `data-session-id` on the layout cards, and the scroll-container queries target `[data-column="all"]`).

Run: `cd /Users/tom/Projects/conference-melt && npm run typecheck` — expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/tom/Projects/conference-melt && git add src/components/grid/Strips.tsx src/components/grid/Strips.module.css src/components/grid/ScheduleGrid.tsx src/test/Strips.test.tsx && git commit -F - <<'EOF'
feat(grid): add all-day and no-time strips

"Całodniowe (N)" and "Bez godziny (N)" rows of chip cards above the
scroll container, wired into ScheduleGrid; the now line's data-now-line
hook is verified end to end for LiveChip.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2
EOF
```


### Task 29: ScheduleList

**Files:**
- Replace the Task 23 placeholder: `src/components/list/ScheduleList.tsx`
- Create: `src/components/list/ScheduleList.module.css`
- Test: `src/test/ScheduleList.test.tsx`

**Interfaces:**
- Consumes: `ListGroup { key: string; label: string; sessions: Session[]; total: number; parallel: number }` from `src/state/derive.ts` (groups are already ordered by `listGroups`: "Całodniowe" first, slot or hourly groups, "Bez godziny" last; groups without visible rows are already omitted); `SessionCard: { session: Session; compact?: boolean; showLocation: boolean; style?: CSSProperties; variant: "grid" | "row" | "chip" }` from `src/components/grid/SessionCard.tsx`; `nowFor(day: Day, now: Date): number | null` and `liveState(s: Session, nowMinutes: number | null): LiveState` from `src/domain/now.ts`; `useStore` (`day`, `now`) from `src/state/store.ts`; `useData()` from `src/data/index.tsx`.
- Produces: `ScheduleList({ groups: ListGroup[] })` (named export) and `export const LIVE_GROUP_ID = "list-live"`. The first group section that holds a session whose `liveState` is `"live"` or `"soon"` carries two hooks: `id={LIVE_GROUP_ID}`, so `document.getElementById(LIVE_GROUP_ID)` finds it, and the empty `data-live-group` attribute, which is what the LiveChip (shell part) queries with `document.querySelector("[data-live-group]")` before calling `scrollIntoView` in list view. Both hooks sit on the same section and both are absent when the selected day is not today.

- [ ] **Step 1: Write the failing test**

`src/test/ScheduleList.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DataProvider, buildAppData } from "../data/index";
import { useStore } from "../state/store";
import { EMPTY_FILTERS } from "../domain/filters";
import type { ListGroup } from "../state/derive";
import { ScheduleList, LIVE_GROUP_ID } from "../components/list/ScheduleList";
import { makeData, makeSession } from "./fixtures/build";

const s1 = makeSession({ id: "1:pt", eventId: 1, title: "Światło w portrecie", start: 570, end: 645, locationIds: [233] });
const s2 = makeSession({ id: "2:pt", eventId: 2, title: "Krajobraz nocą", start: 570, end: 645, locationIds: [281] });
const s3 = makeSession({ id: "3:pt", eventId: 3, title: "Analog dziś", start: 600, end: 660, locationIds: [233] });
const s4 = makeSession({ id: "4:pt", eventId: 4, title: "Ogłoszenie wyników konkursu", start: 810, end: null, locationIds: [233] });
const data = makeData([s1, s2, s3, s4]);

const morning: ListGroup = { key: "570", label: "09:30", sessions: [s1, s2, s3], total: 3, parallel: 3 };
const afternoon: ListGroup = { key: "780", label: "13:00–14:00", sessions: [s4], total: 1, parallel: 1 };

function renderList(groups: ListGroup[]) {
  return render(
    <DataProvider value={buildAppData(data)}>
      <ScheduleList groups={groups} />
    </DataProvider>,
  );
}

beforeEach(() => {
  useStore.setState({
    day: "pt",
    view: "list",
    filters: { ...EMPTY_FILTERS },
    favourites: [],
    previewPlan: null,
    selectedSessionId: null,
    openSheet: null,
    now: new Date(2026, 8, 3, 10, 0),
    toasts: [],
  });
});

describe("ScheduleList", () => {
  it("renders one section per group with its label and event count", () => {
    renderList([morning, afternoon]);
    expect(screen.getByRole("heading", { name: "09:30" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "13:00–14:00" })).toBeTruthy();
    expect(screen.getByText("3 wydarzeń")).toBeTruthy();
    expect(screen.getByText("1 wydarzeń")).toBeTruthy();
  });

  it("shows M równolegle only when M is at least 2 and differs from N", () => {
    renderList([
      { key: "a", label: "A", sessions: [s1, s2, s3], total: 3, parallel: 2 },
      { key: "b", label: "B", sessions: [s1, s2, s3], total: 3, parallel: 3 },
      { key: "c", label: "C", sessions: [s1, s3], total: 2, parallel: 1 },
    ]);
    expect(screen.getByText("2 równolegle")).toBeTruthy();
    expect(screen.queryByText("3 równolegle")).toBeNull();
    expect(screen.queryByText("1 równolegle")).toBeNull();
  });

  it("renders a row card for every session of a group", () => {
    renderList([morning]);
    const section = screen.getByRole("region", { name: "09:30" });
    expect(within(section).getAllByRole("listitem")).toHaveLength(3);
    expect(within(section).getByRole("button", { name: /Światło w portrecie/ })).toBeTruthy();
    expect(within(section).getByRole("button", { name: /Krajobraz nocą/ })).toBeTruthy();
    expect(within(section).getByRole("button", { name: /Analog dziś/ })).toBeTruthy();
  });

  it("puts the list-live id and data-live-group on the first group holding a live session when the day is today", () => {
    useStore.setState({ now: new Date(2026, 8, 4, 10, 0) });
    renderList([morning, afternoon]);
    const live = document.getElementById(LIVE_GROUP_ID);
    expect(live).not.toBeNull();
    expect(within(live as HTMLElement).getByRole("heading", { name: "09:30" })).toBeTruthy();
    expect(screen.getAllByRole("region").filter((el) => el.id === LIVE_GROUP_ID)).toHaveLength(1);
    // The LiveChip scrolls to the data attribute, so it must sit on the same section as the id.
    expect(live?.getAttribute("data-live-group")).toBe("");
    expect(document.querySelectorAll("[data-live-group]")).toHaveLength(1);
    expect(document.querySelector("[data-live-group]")).toBe(live);
  });

  it("uses a soon session when nothing is live, keeping the first qualifying group in order", () => {
    useStore.setState({ now: new Date(2026, 8, 4, 9, 50) });
    const early: ListGroup = { key: "500", label: "08:20", sessions: [makeSession({ id: "9:pt", eventId: 9, title: "Wcześnie", start: 500, end: 540 })], total: 1, parallel: 1 };
    const soon: ListGroup = { key: "600", label: "10:00", sessions: [s3], total: 1, parallel: 1 };
    renderList([early, soon, afternoon]);
    const live = document.getElementById(LIVE_GROUP_ID);
    expect(live).not.toBeNull();
    expect(within(live as HTMLElement).getByRole("heading", { name: "10:00" })).toBeTruthy();
    expect(document.querySelector("[data-live-group]")).toBe(live);
  });

  it("adds neither the list-live id nor data-live-group when the selected day is not today", () => {
    useStore.setState({ now: new Date(2026, 8, 3, 10, 0) });
    renderList([morning, afternoon]);
    expect(document.getElementById(LIVE_GROUP_ID)).toBeNull();
    expect(document.querySelector("[data-live-group]")).toBeNull();
  });

  it("renders nothing for an empty group list", () => {
    const { container } = renderList([]);
    expect(container.innerHTML).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/ScheduleList.test.tsx`
Expected: the suite fails to load with `Failed to resolve import "../components/list/ScheduleList"`.

- [ ] **Step 3: Write the component**

`src/components/list/ScheduleList.tsx`:

```tsx
import type { ListGroup } from "../../state/derive";
import { useStore } from "../../state/store";
import { useData } from "../../data/index";
import { liveState, nowFor } from "../../domain/now";
import { SessionCard } from "../grid/SessionCard";
import styles from "./ScheduleList.module.css";

/** DOM id of the first group with a live or soon session; that section also carries `data-live-group`, which the LiveChip queries in list view. */
export const LIVE_GROUP_ID = "list-live";

interface Props {
  groups: ListGroup[];
}

/** Group keys come from listGroups and may hold any text; ids must not contain spaces. */
function domId(key: string): string {
  return `list-group-${key.replace(/[^\p{L}\p{N}_-]/gu, "_")}`;
}

export function ScheduleList({ groups }: Props) {
  const dayId = useStore((s) => s.day);
  const now = useStore((s) => s.now);
  const { index } = useData();
  const day = index.dayById.get(dayId);
  const nowMinutes = day ? nowFor(day, now) : null;

  const liveKey =
    nowMinutes === null
      ? null
      : (groups.find((g) =>
          g.sessions.some((s) => {
            const state = liveState(s, nowMinutes);
            return state === "live" || state === "soon";
          }),
        )?.key ?? null);

  if (groups.length === 0) return null;

  return (
    <div className={styles.list}>
      {groups.map((g) => {
        const headingId = domId(g.key);
        const showParallel = g.parallel >= 2 && g.parallel !== g.total;
        return (
          <section
            key={g.key}
            id={g.key === liveKey ? LIVE_GROUP_ID : undefined}
            data-live-group={g.key === liveKey ? "" : undefined}
            className={styles.group}
            aria-labelledby={headingId}
          >
            <header className={styles.header}>
              <h2 id={headingId} className={styles.label}>
                {g.label}
              </h2>
              <span className={styles.meta}>{g.total} wydarzeń</span>
              {showParallel ? <span className={styles.parallel}>{g.parallel} równolegle</span> : null}
            </header>
            <ul className={styles.rows}>
              {g.sessions.map((s) => (
                <li key={s.id} className={styles.row}>
                  <SessionCard session={s} showLocation variant="row" />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
```

`src/components/list/ScheduleList.module.css`:

```css
.list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 12px 16px 96px;
  max-width: 880px;
  margin: 0 auto;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 8px 0;
  background: color-mix(in oklch, var(--bg) 82%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.label {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 18px;
  color: var(--text);
}

.meta {
  font-size: 13px;
  color: var(--text-muted);
}

.parallel {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  color: var(--on-accent);
  background: var(--warning);
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  min-width: 0;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/test/ScheduleList.test.tsx`
Expected: 7 passed.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/list/ScheduleList.tsx src/components/list/ScheduleList.module.css src/test/ScheduleList.test.tsx
git commit -m "feat(list): add ScheduleList with slot groups and live anchor" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```

### Task 30: FiltersPanel and Facet

**Files:**
- Create: `src/components/filters/Facet.tsx`
- Create: `src/components/filters/Facet.module.css`
- Replace the Task 23 placeholder: `src/components/filters/FiltersPanel.tsx`
- Create: `src/components/filters/FiltersPanel.module.css`
- Test: `src/test/FiltersPanel.test.tsx`

**Interfaces:**
- Consumes: `Filters`, `EMPTY_FILTERS`, `FACETS`, `Facet as FacetKey`, `SIGNUP_ORDER`, `facetCounts(sessions, filters, facet, planSet, search): Map<number | SignupStatus, number>`, `signupLabel(status, data): string`, `activeFilterCount(f): number` from `src/domain/filters.ts`; `normalizeText(s)` from `src/domain/normalize.ts`; `useStore` (`filters`, `day`, `view`, `toggleFacetValue(facet, value)`, `clearFacet(facet)`, `clearFilters()`, `setFilters(patch)`) and `usePlanSet()` from `src/state/store.ts`; `Toggle: { checked; onChange(v: boolean); label; hint? }` from `src/components/ui/Toggle.tsx`; `Location` (`venue`, `level`, `room`, `order`) from `src/data/types.ts`; `useData()`.
- Produces: `FiltersPanel({ variant: "sidebar" | "sheet" })` (named export; the App wraps the `sheet` variant in `<Sheet>` itself, the panel never opens or closes anything) and `Facet` (named export, internal to this directory) with

  ```ts
  export type FacetValue = number | SignupStatus;
  export interface FacetOption { value: FacetValue; label: string; count: number; group: string | null }
  export interface FacetProps {
    title: string; options: FacetOption[]; selected: readonly FacetValue[];
    defaultOpen: boolean; searchable: boolean;
    onToggle(value: FacetValue): void; onClear(): void;
  }
  ```

  DOM contract used by tests and by nothing else: each facet title is the first `<span>` inside the `<details>` element's `<summary>` (the order test selects it with `summary span`, which keeps the signup option labelled "Zapisy" out of the match); every option is `<label data-dimmed="true"?><input type="checkbox" aria-label={label} aria-describedby={countId}/>…<span id={countId}>{count}</span></label>`; the per-facet clear button has `aria-label="Wyczyść: <title>"`; the inline search input has `aria-label="Szukaj: <title>"`; the global clear button has `aria-label="Wyczyść wszystkie filtry"`.

Facet counts run over the selected day's sessions (`index.sessionsByDay.get(day)`), intersected with the plan set in the plan view, so a count is exactly how many rows ticking that option would leave in the current view. Location options are labelled `"<venue> · <room>"` (venue alone when `room` is null) because the level sub-header already names the level. Level sub-headers use the §7.2 labels: "Poziom 0", "Poziom I", "Poziom I i II", "Poziom II", "Poziom III", "Inne".

- [ ] **Step 1: Write the failing test**

`src/test/FiltersPanel.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataProvider, buildAppData } from "../data/index";
import { useStore } from "../state/store";
import { EMPTY_FILTERS } from "../domain/filters";
import { FiltersPanel } from "../components/filters/FiltersPanel";
import { makeData, makeLocation, makeSession } from "./fixtures/build";

const locations = [
  makeLocation({ id: 308, slug: "stoiska-wystawcow-poziom-i-plenum", name: "Stoiska wystawców - poziom I (PLENUM)", count: 1, venue: "Stoiska wystawców", level: "I", room: "PLENUM", short: "Stoiska · Plenum", order: 0 }),
  makeLocation({ id: 233, slug: "so-salsa-poziom-ii-sala-wykladowa-nr-1", name: "So Salsa - poziom II - Sala wykładowa nr 1", count: 2, venue: "So Salsa", level: "II", room: "Sala wykładowa nr 1", short: "Sala wykł. 1", order: 1 }),
  makeLocation({ id: 281, slug: "sosalsa-poziom-ii-sala-wykladowa-nr-2", name: "SoSalsa - poziom II - Sala wykładowa nr 2", count: 1, venue: "SoSalsa", level: "II", room: "Sala wykładowa nr 2", short: "Sala wykł. 2", order: 2 }),
  makeLocation({ id: 318, slug: "rejestracja", name: "Rejestracja", count: 1, venue: "Rejestracja", level: null, room: null, short: "Rejestracja", order: 3 }),
];
const types = [
  { id: 242, slug: "ogolne", name: "Ogólne", count: 1 },
  { id: 184, slug: "prelekcja", name: "Prelekcja", count: 2 },
  { id: 5, slug: "warsztaty", name: "Warsztaty", count: 1 },
];
const themes = [
  { id: 260, slug: "krajobraz", name: "Krajobraz", count: 1 },
  { id: 267, slug: "portret", name: "Portret", count: 2 },
];
const brands = [
  { id: 10, slug: "canon", name: "Canon", count: 1 },
  { id: 11, slug: "sony", name: "Sony", count: 1 },
];
const signupStatuses = [
  { id: 327, slug: "brak-miejsc", name: "Brak miejsc", count: 1 },
  { id: 194, slug: "w-ramach-festiwalu", name: "W ramach festiwalu", count: 3 },
  { id: 56, slug: "zapisy", name: "Zapisy", count: 0 },
];

const included = { status: "included" as const, url: null, label: "W ramach festiwalu" };
const s1 = makeSession({ id: "1:pt", eventId: 1, title: "Światło w portrecie", start: 570, end: 645, typeIds: [184], locationIds: [233], themeIds: [267], brandIds: [10], signup: included });
const s2 = makeSession({ id: "2:pt", eventId: 2, title: "Krajobraz nocą", start: 570, end: 645, typeIds: [184], locationIds: [281], themeIds: [260], brandIds: [11], signup: included });
const s3 = makeSession({
  id: "3:pt", eventId: 3, title: "Warsztaty Masterclass – Moda na błysk", start: 570, end: 960, typeIds: [5], locationIds: [233], themeIds: [267], brandIds: [],
  signup: { status: "full", url: "https://www.cyfrowe.pl/swiatlosila-warsztaty-masterclass-moda-na-blysk-katarzyna-budziszyna-danaj-p.html", label: "Brak miejsc" },
});
const zone = makeSession({ id: "4:pt", eventId: 4, title: "Rejestracja", start: 540, end: 1080, allDay: true, typeIds: [242], locationIds: [318], themeIds: [], brandIds: [], signup: included });
const data = makeData([s1, s2, s3, zone], { locations, types, themes, brands, signupStatuses });

function renderPanel(variant: "sidebar" | "sheet" = "sidebar") {
  return render(
    <DataProvider value={buildAppData(data)}>
      <FiltersPanel variant={variant} />
    </DataProvider>,
  );
}

function countOf(checkbox: HTMLElement): string {
  const label = checkbox.closest("label") as HTMLElement;
  return (within(label).getByText(/^\d+$/) as HTMLElement).textContent ?? "";
}

function isDimmed(checkbox: HTMLElement): boolean {
  return (checkbox.closest("label") as HTMLElement).dataset.dimmed === "true";
}

beforeEach(() => {
  useStore.setState({
    day: "pt",
    view: "grid",
    filters: { ...EMPTY_FILTERS },
    favourites: [],
    previewPlan: null,
    selectedSessionId: null,
    openSheet: null,
    now: new Date(2026, 8, 3, 10, 0),
    toasts: [],
  });
});

describe("FiltersPanel", () => {
  it("shows the facets in order with counts from facetCounts", () => {
    renderPanel();
    // Scoped to the <summary> title spans: the signup option label "Zapisy" would otherwise match as a sixth element.
    const titles = screen.getAllByText(/^(Typ|Miejsce|Tematyka|Marka|Zapisy)$/, { selector: "summary span" }).map((el) => el.textContent);
    expect(titles).toEqual(["Typ", "Miejsce", "Tematyka", "Marka", "Zapisy"]);
    expect(countOf(screen.getByLabelText("Prelekcja"))).toBe("2");
    expect(countOf(screen.getByLabelText("Warsztaty"))).toBe("1");
    expect(countOf(screen.getByLabelText("Ogólne"))).toBe("1");
    expect(countOf(screen.getByLabelText("Portret"))).toBe("2");
    expect(countOf(screen.getByLabelText("Sony"))).toBe("1");
  });

  it("dims zero-count options without hiding them once another facet narrows the results", () => {
    useStore.setState({ filters: { ...EMPTY_FILTERS, locations: [233] } });
    renderPanel();
    const ogolne = screen.getByLabelText("Ogólne");
    expect(countOf(ogolne)).toBe("0");
    expect(isDimmed(ogolne)).toBe(true);
    expect((ogolne as HTMLInputElement).disabled).toBe(false);
    const prelekcja = screen.getByLabelText("Prelekcja");
    expect(countOf(prelekcja)).toBe("1");
    expect(isDimmed(prelekcja)).toBe(false);
  });

  it("counts a facet without applying that facet's own selection", () => {
    useStore.setState({ filters: { ...EMPTY_FILTERS, types: [5] } });
    renderPanel();
    expect(countOf(screen.getByLabelText("Prelekcja"))).toBe("2");
    expect(countOf(screen.getByLabelText("Warsztaty"))).toBe("1");
    expect(countOf(screen.getByLabelText("Sala wykładowa nr 1", { exact: false }))).toBe("1");
  });

  it("toggles a facet value in the store when its checkbox is clicked", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByLabelText("Prelekcja"));
    expect(useStore.getState().filters.types).toEqual([184]);
    expect((screen.getByLabelText("Prelekcja") as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByLabelText("Prelekcja"));
    expect(useStore.getState().filters.types).toEqual([]);
  });

  it("groups Miejsce by level with the level labels as sub-headers", () => {
    renderPanel();
    const headers = screen.getAllByText(/^(Poziom 0|Poziom I|Poziom I i II|Poziom II|Poziom III|Inne)$/).map((el) => el.textContent);
    expect(headers).toEqual(["Poziom I", "Poziom II", "Inne"]);
    expect(screen.getByLabelText("Stoiska wystawców · PLENUM")).toBeTruthy();
    expect(screen.getByLabelText("So Salsa · Sala wykładowa nr 1")).toBeTruthy();
    expect(screen.getByLabelText("SoSalsa · Sala wykładowa nr 2")).toBeTruthy();
    expect(screen.getByLabelText("Rejestracja")).toBeTruthy();
  });

  it("lists signup statuses by status value with the term labels and counts", () => {
    renderPanel();
    expect(countOf(screen.getByLabelText("Brak miejsc"))).toBe("1");
    expect(countOf(screen.getByLabelText("W ramach festiwalu"))).toBe("3");
    expect(countOf(screen.getByLabelText("Zapisy"))).toBe("0");
    expect(countOf(screen.getByLabelText("Brak informacji"))).toBe("0");
  });

  it("filters Tematyka options with the inline search, ignoring diacritics", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.type(screen.getByLabelText("Szukaj: Tematyka"), "kraj");
    expect(screen.getByLabelText("Krajobraz")).toBeTruthy();
    expect(screen.queryByLabelText("Portret")).toBeNull();
  });

  it("clears one facet with its own button and everything with the global one", async () => {
    const user = userEvent.setup();
    useStore.setState({ filters: { ...EMPTY_FILTERS, types: [184], locations: [233], query: "abc" } });
    renderPanel();
    await user.click(screen.getByLabelText("Wyczyść: Typ"));
    expect(useStore.getState().filters.types).toEqual([]);
    expect(useStore.getState().filters.locations).toEqual([233]);
    expect(useStore.getState().filters.query).toBe("abc");
    await user.click(screen.getByLabelText("Wyczyść wszystkie filtry"));
    expect(useStore.getState().filters).toEqual(EMPTY_FILTERS);
  });

  it("writes the two toggles to the store", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByLabelText("Ukryj strefy całodniowe"));
    expect(useStore.getState().filters.hideAllDay).toBe(true);
    await user.click(screen.getByLabelText("Tylko ulubione"));
    expect(useStore.getState().filters.onlyFavourites).toBe(true);
  });

  it("restricts counts to the plan set in the plan view", () => {
    useStore.setState({ view: "plan", favourites: ["2:pt"] });
    renderPanel();
    expect(countOf(screen.getByLabelText("Prelekcja"))).toBe("1");
    expect(countOf(screen.getByLabelText("Warsztaty"))).toBe("0");
  });

  it("renders the sidebar as a labelled aside and the sheet variant without its own heading", () => {
    const sidebar = renderPanel("sidebar");
    expect(screen.getByRole("complementary", { name: "Filtry" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Filtry" })).toBeTruthy();
    sidebar.unmount();
    renderPanel("sheet");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Filtry" })).toBeNull();
    expect(screen.getByLabelText("Prelekcja")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/FiltersPanel.test.tsx`
Expected: the suite fails to load with `Failed to resolve import "../components/filters/FiltersPanel"`.

- [ ] **Step 3: Write Facet**

`src/components/filters/Facet.tsx`:

```tsx
import { useId, useState } from "react";
import type { SignupStatus } from "../../data/types";
import { normalizeText } from "../../domain/normalize";
import styles from "./Facet.module.css";

export type FacetValue = number | SignupStatus;

export interface FacetOption {
  value: FacetValue;
  label: string;
  count: number;
  /** Sub-header the option sits under (level label for Miejsce), null for flat facets. */
  group: string | null;
}

export interface FacetProps {
  title: string;
  options: FacetOption[];
  selected: readonly FacetValue[];
  defaultOpen: boolean;
  searchable: boolean;
  onToggle(value: FacetValue): void;
  onClear(): void;
}

interface OptionGroup {
  group: string | null;
  options: FacetOption[];
}

/** Consecutive options with the same group label form one block; options arrive already ordered. */
function groupOptions(options: FacetOption[]): OptionGroup[] {
  const groups: OptionGroup[] = [];
  for (const option of options) {
    const last = groups[groups.length - 1];
    if (last && last.group === option.group) last.options.push(option);
    else groups.push({ group: option.group, options: [option] });
  }
  return groups;
}

export function Facet({ title, options, selected, defaultOpen, searchable, onToggle, onClear }: FacetProps) {
  const [query, setQuery] = useState("");
  const baseId = useId();
  const needle = normalizeText(query.trim());
  const shown = needle === "" ? options : options.filter((o) => normalizeText(o.label).includes(needle));
  const selectedSet = new Set<FacetValue>(selected);
  const groups = groupOptions(shown);
  const hasTools = searchable || selected.length > 0;

  return (
    <details className={styles.facet} open={defaultOpen}>
      <summary className={styles.summary}>
        <span className={styles.title}>{title}</span>
        {selected.length > 0 ? <span className={styles.badge}>{selected.length}</span> : null}
      </summary>
      <div className={styles.body}>
        {hasTools ? (
          <div className={styles.tools}>
            {searchable ? (
              <input
                type="search"
                className={styles.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj"
                aria-label={`Szukaj: ${title}`}
              />
            ) : null}
            {selected.length > 0 ? (
              <button type="button" className={styles.clear} onClick={onClear} aria-label={`Wyczyść: ${title}`}>
                Wyczyść
              </button>
            ) : null}
          </div>
        ) : null}
        {groups.map((grp, gi) => (
          <div key={`${grp.group ?? ""}#${gi}`} className={styles.group}>
            {grp.group !== null ? <div className={styles.groupLabel}>{grp.group}</div> : null}
            <ul className={styles.options}>
              {grp.options.map((o) => {
                const countId = `${baseId}-${String(o.value)}`;
                return (
                  <li key={String(o.value)}>
                    <label className={styles.option} data-dimmed={o.count === 0 ? "true" : undefined}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={selectedSet.has(o.value)}
                        onChange={() => onToggle(o.value)}
                        aria-label={o.label}
                        aria-describedby={countId}
                      />
                      <span className={styles.name}>{o.label}</span>
                      <span className={styles.count} id={countId}>
                        {o.count}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {shown.length === 0 ? <p className={styles.empty}>Brak pasujących opcji</p> : null}
      </div>
    </details>
  );
}
```

`src/components/filters/Facet.module.css`:

```css
.facet {
  border-top: 1px solid var(--border);
  padding: 4px 0;
}

.summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 4px;
  cursor: pointer;
  list-style: none;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 15px;
  color: var(--text);
}

.summary::-webkit-details-marker {
  display: none;
}

.summary::after {
  content: "";
  margin-left: auto;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--text-muted);
  border-bottom: 2px solid var(--text-muted);
  transform: rotate(-45deg);
}

.facet[open] > .summary::after {
  transform: rotate(45deg);
}

.badge {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 999px;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  color: var(--on-accent);
  background: var(--accent);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 4px 10px;
}

.tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-1);
  color: var(--text);
  font: inherit;
  font-size: 13px;
}

.clear {
  padding: 4px 8px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.clear:hover {
  color: var(--accent-hover);
}

.group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.groupLabel {
  padding: 6px 0 2px;
  font-size: var(--text-min);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.options {
  list-style: none;
  margin: 0;
  padding: 0;
}

.option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 2px 4px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
}

.option:hover {
  background: var(--surface-2);
}

.option[data-dimmed="true"] {
  opacity: 0.45;
}

.checkbox {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--accent);
}

.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  font-variant-numeric: tabular-nums;
  font-size: 12px;
  color: var(--text-muted);
}

.empty {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

@media (pointer: coarse) {
  .option {
    min-height: 44px;
  }
}
```

- [ ] **Step 4: Write FiltersPanel**

`src/components/filters/FiltersPanel.tsx`:

```tsx
import { useMemo } from "react";
import type { Location, SignupStatus, Term } from "../../data/types";
import { useData } from "../../data/index";
import { usePlanSet, useStore } from "../../state/store";
import { FACETS, SIGNUP_ORDER, activeFilterCount, facetCounts, signupLabel, type Facet as FacetKey } from "../../domain/filters";
import { Toggle } from "../ui/Toggle";
import { Facet, type FacetOption } from "./Facet";
import styles from "./FiltersPanel.module.css";

interface Props {
  variant: "sidebar" | "sheet";
}

const LEVEL_LABELS: Record<string, string> = {
  "0": "Poziom 0",
  I: "Poziom I",
  "I+II": "Poziom I i II",
  II: "Poziom II",
  III: "Poziom III",
};

function levelLabel(level: Location["level"]): string {
  return level === null ? "Inne" : LEVEL_LABELS[level];
}

function locationOptionLabel(l: Location): string {
  return l.room === null ? l.venue : `${l.venue} · ${l.room}`;
}

type Counts = Record<FacetKey, Map<number | SignupStatus, number>>;

function termOptions(terms: Term[], counts: Map<number | SignupStatus, number>): FacetOption[] {
  return terms.map((t) => ({ value: t.id, label: t.name, count: counts.get(t.id) ?? 0, group: null }));
}

export function FiltersPanel({ variant }: Props) {
  const { data, index, search } = useData();
  const filters = useStore((s) => s.filters);
  const day = useStore((s) => s.day);
  const view = useStore((s) => s.view);
  const toggleFacetValue = useStore((s) => s.toggleFacetValue);
  const clearFacet = useStore((s) => s.clearFacet);
  const clearFilters = useStore((s) => s.clearFilters);
  const setFilters = useStore((s) => s.setFilters);
  const planSet = usePlanSet();

  const base = useMemo(() => {
    const daySessions = index.sessionsByDay.get(day) ?? [];
    return view === "plan" ? daySessions.filter((s) => planSet.has(s.id)) : daySessions;
  }, [index, day, view, planSet]);

  const counts = useMemo(() => {
    const out: Partial<Counts> = {};
    for (const facet of FACETS) out[facet] = facetCounts(base, filters, facet, planSet, search);
    return out as Counts;
  }, [base, filters, planSet, search]);

  const locationOptions = useMemo<FacetOption[]>(
    () =>
      [...data.locations]
        .sort((a, b) => a.order - b.order)
        .map((l) => ({
          value: l.id,
          label: locationOptionLabel(l),
          count: counts.locations.get(l.id) ?? 0,
          group: levelLabel(l.level),
        })),
    [data.locations, counts.locations],
  );

  const signupOptions: FacetOption[] = SIGNUP_ORDER.map((status) => ({
    value: status,
    label: signupLabel(status, data),
    count: counts.signup.get(status) ?? 0,
    group: null,
  }));

  const active = activeFilterCount(filters);
  const Wrapper = variant === "sidebar" ? "aside" : "div";

  return (
    <Wrapper className={variant === "sidebar" ? styles.sidebar : styles.sheet} aria-label={variant === "sidebar" ? "Filtry" : undefined}>
      <div className={styles.head}>
        {variant === "sidebar" ? <h2 className={styles.heading}>Filtry</h2> : null}
        <button
          type="button"
          className={styles.clearAll}
          onClick={clearFilters}
          disabled={active === 0}
          aria-label="Wyczyść wszystkie filtry"
        >
          Wyczyść
        </button>
      </div>
      <Facet
        title="Typ"
        options={termOptions(data.types, counts.types)}
        selected={filters.types}
        defaultOpen
        searchable={false}
        onToggle={(v) => toggleFacetValue("types", v)}
        onClear={() => clearFacet("types")}
      />
      <Facet
        title="Miejsce"
        options={locationOptions}
        selected={filters.locations}
        defaultOpen
        searchable={false}
        onToggle={(v) => toggleFacetValue("locations", v)}
        onClear={() => clearFacet("locations")}
      />
      <Facet
        title="Tematyka"
        options={termOptions(data.themes, counts.themes)}
        selected={filters.themes}
        defaultOpen={false}
        searchable
        onToggle={(v) => toggleFacetValue("themes", v)}
        onClear={() => clearFacet("themes")}
      />
      <Facet
        title="Marka"
        options={termOptions(data.brands, counts.brands)}
        selected={filters.brands}
        defaultOpen={false}
        searchable
        onToggle={(v) => toggleFacetValue("brands", v)}
        onClear={() => clearFacet("brands")}
      />
      <Facet
        title="Zapisy"
        options={signupOptions}
        selected={filters.signup}
        defaultOpen
        searchable={false}
        onToggle={(v) => toggleFacetValue("signup", v)}
        onClear={() => clearFacet("signup")}
      />
      <div className={styles.toggles}>
        <Toggle checked={filters.hideAllDay} onChange={(v) => setFilters({ hideAllDay: v })} label="Ukryj strefy całodniowe" />
        <Toggle checked={filters.onlyFavourites} onChange={(v) => setFilters({ onlyFavourites: v })} label="Tylko ulubione" />
      </div>
    </Wrapper>
  );
}
```

`src/components/filters/FiltersPanel.module.css`:

```css
.sidebar,
.sheet {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--text);
}

.sidebar {
  width: 280px;
  flex: 0 0 280px;
  padding: 16px 12px 32px;
  border-right: 1px solid var(--border);
  background: var(--surface-1);
  overflow-y: auto;
}

.sheet {
  padding: 0 4px 24px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 4px 8px;
}

.heading {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 18px;
}

.clearAll {
  margin-left: auto;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.clearAll:disabled {
  opacity: 0.4;
  cursor: default;
}

.toggles {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 4px 0;
  border-top: 1px solid var(--border);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/test/FiltersPanel.test.tsx`
Expected: 11 passed.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/filters src/test/FiltersPanel.test.tsx
git commit -m "feat(filters): add FiltersPanel and Facet with live counts" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```



### Task 31: SettingsPanel

**Files:**
- Replace the Task 23 placeholder: `src/components/settings/SettingsPanel.tsx`
- Create: `src/components/settings/SettingsPanel.module.css`
- Test: `src/test/SettingsPanel.test.tsx`

**Interfaces:**
- Consumes: `Settings`, `ColumnAxis`, `TimeMode`, `useStore` (`settings`, `day`, `view`, `filters`, `setSettings(patch)`, `resetSettings()`), `usePlanSet()`, `defaultSettings(viewportWidth)` from `src/state/store.ts`; `daySets(args): DaySets` and `resolveTimeMode(settings, layout): ResolvedTime` from `src/state/derive.ts`; `Popover: { open; anchorRef: RefObject<HTMLElement | null>; onClose(); children; title }`, `Sheet: { open; side; title; onClose(); children; labelledBy? }`, `Segmented<T>: { value; options: { value: T; label: string; hint?: string }[]; onChange(v: T); ariaLabel }`, `Slider: { value; min; max; step; onChange(v: number); label; format?(v) }`, `Toggle: { checked; onChange(v); label; hint? }` from `src/components/ui/`; `useData()`.
- Produces: `SettingsPanel({ variant: "popover" | "sheet"; anchorRef?: RefObject<HTMLElement | null>; open: boolean; onClose(): void })` (named export). Segmented groups carry these `ariaLabel`s: "Kolumny", "Tryb czasu", "Gęstość", "Kolor", "Motyw" (sheet only); sliders are labelled "Tolerancja slotów" and "Powiększenie"; toggles "Zdjęcia prelegentów" and "Strefy całodniowe w osobnym pasku". The time-mode hint always ends with a `<span>` reading exactly "Auto (sloty)" or "Auto (oś czasu)", computed by running `resolveTimeMode` with `timeMode: "auto"` over the current day's layout set, so the readout stays informative even while a mode is forced.

- [ ] **Step 1: Write the failing test**

`src/test/SettingsPanel.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { RefObject } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataProvider, buildAppData } from "../data/index";
import { defaultSettings, useStore } from "../state/store";
import { EMPTY_FILTERS } from "../domain/filters";
import { SettingsPanel } from "../components/settings/SettingsPanel";
import { makeData, makeSession } from "./fixtures/build";

/** Two starts 90 minutes apart, two sessions per start: 2 slots, medianGap 90, sharedRatio 1 → distinguishable. */
const slotted = makeData([
  makeSession({ id: "1:pt", eventId: 1, title: "A", start: 570, end: 630, locationIds: [233] }),
  makeSession({ id: "2:pt", eventId: 2, title: "B", start: 570, end: 630, locationIds: [281] }),
  makeSession({ id: "3:pt", eventId: 3, title: "C", start: 660, end: 720, locationIds: [233] }),
  makeSession({ id: "4:pt", eventId: 4, title: "D", start: 660, end: 720, locationIds: [281] }),
]);
/** One slot only → not distinguishable → auto resolves to timeline. */
const single = makeData([makeSession({ id: "1:pt", eventId: 1, title: "A", start: 570, end: 630 })]);

function renderSheet(data = slotted) {
  return render(
    <DataProvider value={buildAppData(data)}>
      <SettingsPanel variant="sheet" open onClose={() => {}} />
    </DataProvider>,
  );
}

let anchor: HTMLButtonElement | null = null;

function renderPopover() {
  anchor = document.createElement("button");
  anchor.textContent = "Widok";
  document.body.appendChild(anchor);
  const anchorRef: RefObject<HTMLElement | null> = { current: anchor };
  return render(
    <DataProvider value={buildAppData(slotted)}>
      <SettingsPanel variant="popover" anchorRef={anchorRef} open onClose={() => {}} />
    </DataProvider>,
  );
}

beforeEach(() => {
  useStore.setState({
    day: "pt",
    view: "grid",
    filters: { ...EMPTY_FILTERS },
    favourites: [],
    previewPlan: null,
    selectedSessionId: null,
    openSheet: null,
    now: new Date(2026, 8, 3, 10, 0),
    toasts: [],
    settings: { ...defaultSettings(1280), theme: "dark" },
  });
});

afterEach(() => {
  anchor?.remove();
  anchor = null;
});

describe("SettingsPanel", () => {
  it("renders every control with its Polish label in the sheet variant", () => {
    renderSheet();
    const axis = screen.getByLabelText("Kolumny");
    for (const label of ["Sale", "Typ", "Marka", "Poziom", "Bez grupowania"]) {
      expect(within(axis).getByText(label)).toBeTruthy();
    }
    const time = screen.getByLabelText("Tryb czasu");
    for (const label of ["Auto", "Sloty", "Oś czasu"]) expect(within(time).getByText(label)).toBeTruthy();
    expect(screen.getByLabelText("Tolerancja slotów")).toBeTruthy();
    expect(screen.getByLabelText("Powiększenie")).toBeTruthy();
    const density = screen.getByLabelText("Gęstość");
    for (const label of ["Zwarty", "Wygodny"]) expect(within(density).getByText(label)).toBeTruthy();
    const color = screen.getByLabelText("Kolor");
    for (const label of ["Typ", "Miejsce", "Marka"]) expect(within(color).getByText(label)).toBeTruthy();
    expect(screen.getByLabelText("Zdjęcia prelegentów")).toBeTruthy();
    expect(screen.getByLabelText("Strefy całodniowe w osobnym pasku")).toBeTruthy();
    const theme = screen.getByLabelText("Motyw");
    for (const label of ["System", "Ciemny", "Jasny"]) expect(within(theme).getByText(label)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Przywróć domyślne" })).toBeTruthy();
  });

  it("omits the theme control in the popover variant", () => {
    renderPopover();
    expect(screen.getByLabelText("Kolumny")).toBeTruthy();
    expect(screen.queryByLabelText("Motyw")).toBeNull();
  });

  it("shows the resolved auto mode as Auto (sloty) or Auto (oś czasu)", () => {
    const first = renderSheet(slotted);
    expect(screen.getByText("Auto (sloty)")).toBeTruthy();
    first.unmount();
    renderSheet(single);
    expect(screen.getByText("Auto (oś czasu)")).toBeTruthy();
  });

  it("keeps the auto readout meaningful while a mode is forced", () => {
    useStore.setState({ settings: { ...useStore.getState().settings, timeMode: "timeline" } });
    renderSheet(slotted);
    expect(screen.getByText("Auto (sloty)")).toBeTruthy();
  });

  it("writes the column axis, time mode, density and colour choices", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(within(screen.getByLabelText("Kolumny")).getByText("Marka"));
    expect(useStore.getState().settings.columnAxis).toBe("brand");
    await user.click(within(screen.getByLabelText("Kolumny")).getByText("Bez grupowania"));
    expect(useStore.getState().settings.columnAxis).toBe("none");
    await user.click(within(screen.getByLabelText("Tryb czasu")).getByText("Oś czasu"));
    expect(useStore.getState().settings.timeMode).toBe("timeline");
    await user.click(within(screen.getByLabelText("Gęstość")).getByText("Zwarty"));
    expect(useStore.getState().settings.density).toBe("compact");
    await user.click(within(screen.getByLabelText("Kolor")).getByText("Miejsce"));
    expect(useStore.getState().settings.colorBy).toBe("location");
  });

  it("writes slot tolerance and zoom from the sliders", () => {
    renderSheet();
    fireEvent.change(screen.getByLabelText("Tolerancja slotów"), { target: { value: "30" } });
    expect(useStore.getState().settings.slotTolerance).toBe(30);
    fireEvent.change(screen.getByLabelText("Powiększenie"), { target: { value: "2.4" } });
    expect(useStore.getState().settings.zoom).toBe(2.4);
  });

  it("writes the two toggles", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(screen.getByLabelText("Zdjęcia prelegentów"));
    expect(useStore.getState().settings.showAvatars).toBe(false);
    await user.click(screen.getByLabelText("Strefy całodniowe w osobnym pasku"));
    expect(useStore.getState().settings.allDayStrip).toBe(false);
  });

  it("writes the theme from the sheet control", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(within(screen.getByLabelText("Motyw")).getByText("Jasny"));
    expect(useStore.getState().settings.theme).toBe("light");
  });

  it("Przywróć domyślne resets the shown fields and leaves the theme alone", async () => {
    const user = userEvent.setup();
    useStore.setState({ settings: { ...useStore.getState().settings, columnAxis: "brand", zoom: 3.6, density: "compact", theme: "dark" } });
    renderSheet();
    await user.click(screen.getByRole("button", { name: "Przywróć domyślne" }));
    const expected = defaultSettings(window.innerWidth);
    const actual = useStore.getState().settings;
    expect(actual.columnAxis).toBe(expected.columnAxis);
    expect(actual.zoom).toBe(expected.zoom);
    expect(actual.density).toBe(expected.density);
    expect(actual.theme).toBe("dark");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/SettingsPanel.test.tsx`
Expected: the suite fails to load with `Failed to resolve import "../components/settings/SettingsPanel"`.

- [ ] **Step 3: Write the component**

`src/components/settings/SettingsPanel.tsx`:

```tsx
import { useMemo, type ReactNode, type RefObject } from "react";
import { useData } from "../../data/index";
import { usePlanSet, useStore, type ColumnAxis, type Settings, type TimeMode } from "../../state/store";
import { daySets, resolveTimeMode } from "../../state/derive";
import { Popover } from "../ui/Popover";
import { Sheet } from "../ui/Sheet";
import { Segmented } from "../ui/Segmented";
import { Slider } from "../ui/Slider";
import { Toggle } from "../ui/Toggle";
import styles from "./SettingsPanel.module.css";

interface Props {
  variant: "popover" | "sheet";
  anchorRef?: RefObject<HTMLElement | null>;
  open: boolean;
  onClose(): void;
}

const AXIS_OPTIONS: { value: ColumnAxis; label: string }[] = [
  { value: "location", label: "Sale" },
  { value: "type", label: "Typ" },
  { value: "brand", label: "Marka" },
  { value: "level", label: "Poziom" },
  { value: "none", label: "Bez grupowania" },
];

const TIME_OPTIONS: { value: TimeMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "slots", label: "Sloty" },
  { value: "timeline", label: "Oś czasu" },
];

const DENSITY_OPTIONS: { value: Settings["density"]; label: string }[] = [
  { value: "compact", label: "Zwarty" },
  { value: "comfortable", label: "Wygodny" },
];

const COLOR_OPTIONS: { value: Settings["colorBy"]; label: string }[] = [
  { value: "type", label: "Typ" },
  { value: "location", label: "Miejsce" },
  { value: "brand", label: "Marka" },
];

const THEME_OPTIONS: { value: Settings["theme"]; label: string }[] = [
  { value: "system", label: "System" },
  { value: "dark", label: "Ciemny" },
  { value: "light", label: "Jasny" },
];

interface FieldProps {
  label?: string;
  hint: ReactNode;
  children: ReactNode;
}

/** One setting: optional visible caption, the control, and its one-line hint. */
function Field({ label, hint, children }: FieldProps) {
  return (
    <div className={styles.field}>
      {label !== undefined ? <div className={styles.fieldLabel}>{label}</div> : null}
      {children}
      <p className={styles.hint}>{hint}</p>
    </div>
  );
}

export function SettingsPanel({ variant, anchorRef, open, onClose }: Props) {
  const { data, index, search } = useData();
  const settings = useStore((s) => s.settings);
  const day = useStore((s) => s.day);
  const view = useStore((s) => s.view);
  const filters = useStore((s) => s.filters);
  const setSettings = useStore((s) => s.setSettings);
  const resetSettings = useStore((s) => s.resetSettings);
  const planSet = usePlanSet();

  const autoReadout = useMemo(() => {
    const sets = daySets({ data, index, search, dayId: day, filters, settings, planSet, planView: view === "plan" });
    const resolved = resolveTimeMode({ ...settings, timeMode: "auto" }, sets.layout);
    return resolved.mode === "slots" ? "Auto (sloty)" : "Auto (oś czasu)";
  }, [data, index, search, day, filters, settings, planSet, view]);

  const body = (
    <div className={styles.panel}>
      <Field label="Kolumny" hint="Co tworzy kolumny siatki">
        <Segmented value={settings.columnAxis} options={AXIS_OPTIONS} onChange={(v) => setSettings({ columnAxis: v })} ariaLabel="Kolumny" />
      </Field>
      <Field
        label="Tryb czasu"
        hint={
          <>
            Auto wybiera sloty, gdy widoczne starty tworzą regularną siatkę. Teraz: <span className={styles.readout}>{autoReadout}</span>
          </>
        }
      >
        <Segmented value={settings.timeMode} options={TIME_OPTIONS} onChange={(v) => setSettings({ timeMode: v })} ariaLabel="Tryb czasu" />
      </Field>
      <Field hint="Starty w tym odstępie trafiają do jednego slotu">
        <Slider
          value={settings.slotTolerance}
          min={5}
          max={45}
          step={5}
          onChange={(v) => setSettings({ slotTolerance: v })}
          label="Tolerancja slotów"
          format={(v) => `${v} min`}
        />
      </Field>
      <Field hint="Wysokość jednej minuty w osi czasu">
        <Slider
          value={settings.zoom}
          min={1.2}
          max={4}
          step={0.2}
          onChange={(v) => setSettings({ zoom: Math.round(v * 10) / 10 })}
          label="Powiększenie"
          format={(v) => `${v.toFixed(1)} px/min`}
        />
      </Field>
      <Field label="Gęstość" hint="Rozmiar kart i szerokość kolumn">
        <Segmented value={settings.density} options={DENSITY_OPTIONS} onChange={(v) => setSettings({ density: v })} ariaLabel="Gęstość" />
      </Field>
      <Field label="Kolor" hint="Skąd bierze się kolor krawędzi karty">
        <Segmented value={settings.colorBy} options={COLOR_OPTIONS} onChange={(v) => setSettings({ colorBy: v })} ariaLabel="Kolor" />
      </Field>
      <Toggle
        checked={settings.showAvatars}
        onChange={(v) => setSettings({ showAvatars: v })}
        label="Zdjęcia prelegentów"
        hint="Na kartach i w liście; w szczegółach zawsze"
      />
      <Toggle
        checked={settings.allDayStrip}
        onChange={(v) => setSettings({ allDayStrip: v })}
        label="Strefy całodniowe w osobnym pasku"
        hint="Wyłączone: strefy stają się pasami w siatce"
      />
      {variant === "sheet" ? (
        <Field label="Motyw" hint="System podąża za ustawieniem urządzenia">
          <Segmented value={settings.theme} options={THEME_OPTIONS} onChange={(v) => setSettings({ theme: v })} ariaLabel="Motyw" />
        </Field>
      ) : null}
      <button type="button" className={styles.reset} onClick={resetSettings}>
        Przywróć domyślne
      </button>
    </div>
  );

  if (variant === "sheet") {
    return (
      <Sheet open={open} side="bottom" title="Widok" onClose={onClose}>
        {body}
      </Sheet>
    );
  }
  if (!anchorRef) return null;
  return (
    <Popover open={open} anchorRef={anchorRef} onClose={onClose} title="Widok">
      {body}
    </Popover>
  );
}
```

`src/components/settings/SettingsPanel.module.css`:

```css
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(360px, 100%);
  padding: 4px 0 8px;
  color: var(--text);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fieldLabel {
  font-size: 13px;
  font-weight: 600;
}

.hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-muted);
}

.readout {
  font-weight: 600;
  color: var(--text);
}

.reset {
  align-self: flex-start;
  margin-top: 4px;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.reset:hover {
  color: var(--accent-hover);
  border-color: var(--accent-hover);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/test/SettingsPanel.test.tsx`
Expected: 9 passed.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings src/test/SettingsPanel.test.tsx
git commit -m "feat(settings): add SettingsPanel with resolved time-mode readout" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```



### Task 32: DetailSheet, SpeakerBlock and SameTimeList

**Files:**
- Create: `src/components/detail/SpeakerBlock.tsx`
- Create: `src/components/detail/SpeakerBlock.module.css`
- Create: `src/components/detail/SameTimeList.tsx`
- Create: `src/components/detail/SameTimeList.module.css`
- Replace the Task 23 placeholder: `src/components/detail/DetailSheet.tsx`
- Create: `src/components/detail/DetailSheet.module.css`
- Test: `src/test/DetailSheet.test.tsx`

**Interfaces:**
- Consumes: `overlaps(a: Session, b: Session): boolean` from `src/domain/overlaps.ts`; `formatRange(start, end)`, `durationLabel(start, end)` from `src/domain/time.ts`; `locationsOf(s, index)`, `speakersOf(s, index)`, `locationLabel(s, index)` from `src/domain/lookup.ts`; `useStore` (`selectedSessionId`, `openSheet`, `previewPlan`, `setSheet(kind)`, `selectSession(id)`, `toggleFavourite(id)`), `usePlanSet()`, `MOBILE_BREAKPOINT` from `src/state/store.ts`; `Sheet: { open; side: "right" | "bottom"; title; onClose(); children; labelledBy? }`, `Chip: { children; onRemove?; tone? }`, `Avatar: { name; src; size?; hue? }`, `Star: { pressed; onToggle(); size? }` (renders `<button aria-pressed aria-label="Do planu">`) from `src/components/ui/`; `Session`, `Signup`, `Speaker`, `Location` from `src/data/types.ts`; `useData()`.
- Produces: `DetailSheet()` (named export, no props; the App renders it once in every view), `SpeakerBlock({ speaker: Speaker })` and `SameTimeList({ session: Session })` (named exports, internal to this directory). `SpeakerBlock` hands `speaker.photo ?? speaker.photoThumb` to `Avatar`, because the detail panel shows the large photo (spec §7.6); the thumb stays the card and list image. `SameTimeList` renders `<ul aria-labelledby="same-time-heading">` whose `<li>` rows each hold a `<button aria-label="<title>, <time>, <location>">` sibling to a `Star` (star omitted while `previewPlan` is set), and renders nothing when no session overlaps. `DetailSheet` sets the Sheet's `side` to `"right"` when `window.innerWidth >= MOBILE_BREAKPOINT`, else `"bottom"`, re-evaluated on `resize`; it records `document.activeElement` in a store subscription at the moment `openSheet` becomes `"detail"` (before React moves focus into the dialog) and focuses it again when the sheet closes.

- [ ] **Step 1: Write the failing test**

`src/test/DetailSheet.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataProvider, buildAppData } from "../data/index";
import { useStore } from "../state/store";
import { EMPTY_FILTERS } from "../domain/filters";
import { DetailSheet } from "../components/detail/DetailSheet";
import { makeData, makeLocation, makeSession, makeSpeaker } from "./fixtures/build";

const locations = [
  makeLocation({ id: 308, slug: "stoiska-wystawcow-poziom-i-plenum", name: "Stoiska wystawców - poziom I (PLENUM)", count: 1, venue: "Stoiska wystawców", level: "I", room: "PLENUM", short: "Stoiska · Plenum", order: 0 }),
  makeLocation({ id: 233, slug: "so-salsa-poziom-ii-sala-wykladowa-nr-1", name: "So Salsa - poziom II - Sala wykładowa nr 1", count: 3, venue: "So Salsa", level: "II", room: "Sala wykładowa nr 1", short: "Sala wykł. 1", order: 1 }),
  makeLocation({ id: 281, slug: "sosalsa-poziom-ii-sala-wykladowa-nr-2", name: "SoSalsa - poziom II - Sala wykładowa nr 2", count: 2, venue: "SoSalsa", level: "II", room: "Sala wykładowa nr 2", short: "Sala wykł. 2", order: 2 }),
  makeLocation({ id: 318, slug: "rejestracja", name: "Rejestracja", count: 1, venue: "Rejestracja", level: null, room: null, short: "Rejestracja", order: 3 }),
];

const speaker = makeSpeaker({
  id: 293,
  slug: "filip-blank",
  name: "Filip Blank",
  photo: "https://swiatlosila.pl/wp-content/uploads/2024/08/600_Blank_Filip_canon.jpg",
  photoThumb: "https://swiatlosila.pl/wp-content/uploads/2024/08/600_Blank_Filip_canon-300x300.jpg",
  bioHtml: "<p>Fotograf, podróżnik, mąż i ojciec dwójki dzieci.</p>",
  url: "https://swiatlosila.pl/cyfrowe-prelegent/filip-blank/",
  brands: ["Canon"],
});

const included = { status: "included" as const, url: null, label: "W ramach festiwalu" };

/** The selected session, 10:00–11:00 on Friday. */
const selected = makeSession({
  id: "1:pt", eventId: 1, title: "Światło w portrecie", start: 600, end: 660,
  typeIds: [184], locationIds: [233], themeIds: [267], brandIds: [11], speakerIds: [293], byline: null,
  signup: { status: "open", url: "https://www.cyfrowe.pl/swiatlosila-fotogra-before-fotospacer-colour-hunting-z-sony-p.html", label: "Zapisy" },
  url: "https://swiatlosila.pl/cyfrowe-event/swiatlo-w-portrecie/",
});
// Spec §10 fixture: three overlapping, one touching the end, one all-day zone.
const before = makeSession({ id: "2:pt", eventId: 2, title: "Poranny krajobraz", start: 570, end: 615, locationIds: [281], speakerIds: [], signup: included });
const same = makeSession({ id: "3:pt", eventId: 3, title: "Analog dziś", start: 600, end: 660, locationIds: [281], speakerIds: [], signup: included });
const after = makeSession({ id: "4:pt", eventId: 4, title: "Film w aparacie", start: 630, end: 690, locationIds: [308], speakerIds: [], signup: included });
const touching = makeSession({ id: "5:pt", eventId: 5, title: "Druk w domu", start: 660, end: 720, locationIds: [233], speakerIds: [], signup: included });
const zone = makeSession({ id: "6:pt", eventId: 6, title: "Rejestracja", start: 540, end: 1080, allDay: true, typeIds: [242], locationIds: [318], speakerIds: [], signup: included });
// Saturday cases: a point session with a byline and a full workshop that ends at 13:00, before the 13:30 point session, so neither lists the other under "W tym samym czasie".
const point = makeSession({ id: "7:sob", eventId: 7, day: "sob", title: "Ogłoszenie wyników konkursu", start: 810, end: null, typeIds: [242], locationIds: [233], speakerIds: [], byline: "Cyfrowe.pl", signup: included });
const full = makeSession({
  id: "8:sob", eventId: 8, day: "sob", title: "Warsztaty Masterclass – Moda na błysk", start: 570, end: 780, typeIds: [5], locationIds: [233], speakerIds: [], byline: null,
  signup: { status: "full", url: "https://www.cyfrowe.pl/swiatlosila-warsztaty-masterclass-moda-na-blysk-katarzyna-budziszyna-danaj-p.html", label: "Brak miejsc" },
});

const data = makeData([selected, before, same, after, touching, zone, point, full], {
  locations,
  themes: [{ id: 267, slug: "portret", name: "Portret", count: 1 }],
  brands: [{ id: 11, slug: "sony", name: "Sony", count: 1 }],
  speakers: [speaker],
});

function renderDetail(id: string) {
  useStore.setState({ selectedSessionId: id, openSheet: "detail" });
  return render(
    <DataProvider value={buildAppData(data)}>
      <DetailSheet />
    </DataProvider>,
  );
}

beforeEach(() => {
  useStore.setState({
    day: "pt",
    view: "grid",
    filters: { ...EMPTY_FILTERS },
    favourites: [],
    previewPlan: null,
    selectedSessionId: null,
    openSheet: null,
    now: new Date(2026, 8, 3, 10, 0),
    toasts: [],
  });
});

describe("DetailSheet", () => {
  it("shows the type chip, title, day, time and duration", () => {
    renderDetail("1:pt");
    expect(screen.getByText("Prelekcja")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Światło w portrecie" })).toBeTruthy();
    expect(screen.getByText("Piątek, 4 września")).toBeTruthy();
    // "10:00–11:00" also appears on the same-time row of 3:pt, so more than one match is expected.
    expect(screen.getAllByText("10:00–11:00").length).toBeGreaterThan(0);
    expect(screen.getByText("1 h")).toBeTruthy();
  });

  it("shows venue, level and room, theme and brand chips", () => {
    renderDetail("1:pt");
    expect(screen.getByText("So Salsa · Poziom II · Sala wykładowa nr 1")).toBeTruthy();
    expect(screen.getByText("Portret")).toBeTruthy();
    expect(screen.getByText("Sony")).toBeTruthy();
  });

  it("renders the speaker with name, brands and a bio disclosure", async () => {
    const user = userEvent.setup();
    renderDetail("1:pt");
    expect(screen.getByText("Filip Blank")).toBeTruthy();
    expect(screen.getByText("Canon")).toBeTruthy();
    const toggle = screen.getByRole("button", { name: "Pokaż bio" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/Fotograf, podróżnik/)).toBeNull();
    await user.click(toggle);
    expect(screen.getByText(/Fotograf, podróżnik/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ukryj bio" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("shows the byline when no speaker resolved, and a single time without duration for a point session", () => {
    renderDetail("7:sob");
    expect(screen.getByText("Cyfrowe.pl")).toBeTruthy();
    expect(screen.getByText("13:30")).toBeTruthy();
    expect(screen.queryByText(/^\d+ (h|min)/)).toBeNull();
    expect(screen.queryByText(/–/)).toBeNull();
  });

  it("renders the signup as an external link when open and a disabled button when full", () => {
    const open = renderDetail("1:pt");
    const link = screen.getByRole("link", { name: "Zapisy" });
    expect(link.getAttribute("href")).toBe("https://www.cyfrowe.pl/swiatlosila-fotogra-before-fotospacer-colour-hunting-z-sony-p.html");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    open.unmount();
    renderDetail("8:sob");
    const button = screen.getByRole("button", { name: "Brak miejsc" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.queryByRole("link", { name: "Brak miejsc" })).toBeNull();
  });

  it("adds to and removes from the plan with the labelled button", async () => {
    const user = userEvent.setup();
    renderDetail("1:pt");
    await user.click(screen.getByRole("button", { name: "Dodaj do planu" }));
    expect(useStore.getState().favourites).toEqual(["1:pt"]);
    await user.click(screen.getByRole("button", { name: "Usuń z planu" }));
    expect(useStore.getState().favourites).toEqual([]);
  });

  it("lists exactly the three overlapping same-day sessions, whether or not they pass the filters", () => {
    useStore.setState({ filters: { ...EMPTY_FILTERS, locations: [233] } });
    renderDetail("1:pt");
    const list = screen.getByRole("list", { name: "W tym samym czasie" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    const names = within(list).getAllByRole("button", { name: /,/ }).map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual([
      "Poranny krajobraz, 09:30–10:15, Sala wykł. 2",
      "Analog dziś, 10:00–11:00, Sala wykł. 2",
      "Film w aparacie, 10:30–11:30, Stoiska · Plenum",
    ]);
    expect(within(list).queryByText(/Druk w domu/)).toBeNull();
    expect(within(list).queryByText(/Rejestracja/)).toBeNull();
    expect(within(list).getAllByRole("button", { name: "Do planu" })).toHaveLength(3);
  });

  it("switches the panel to a same-time session when its row is clicked", async () => {
    const user = userEvent.setup();
    renderDetail("1:pt");
    await user.click(screen.getByRole("button", { name: /^Analog dziś,/ }));
    expect(useStore.getState().selectedSessionId).toBe("3:pt");
    expect(screen.getByRole("heading", { name: "Analog dziś" })).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "W tym samym czasie" })).getByRole("button", { name: /^Światło w portrecie,/ })).toBeTruthy();
  });

  it("renders no same-time section for the touching session's only neighbour being the zone", () => {
    renderDetail("7:sob");
    expect(screen.queryByRole("list", { name: "W tym samym czasie" })).toBeNull();
  });

  it("hides the plan button and every same-time star during a preview and leaves favourites untouched", () => {
    useStore.setState({ previewPlan: ["3:pt"] });
    renderDetail("1:pt");
    expect(screen.queryByRole("button", { name: "Dodaj do planu" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Usuń z planu" })).toBeNull();
    expect(screen.queryAllByRole("button", { name: "Do planu" })).toHaveLength(0);
    expect(within(screen.getByRole("list", { name: "W tym samym czasie" })).getAllByRole("listitem")).toHaveLength(3);
    expect(useStore.getState().favourites).toEqual([]);
  });

  it("links to the festival page", () => {
    renderDetail("1:pt");
    const link = screen.getByRole("link", { name: "Zobacz na stronie festiwalu" });
    expect(link.getAttribute("href")).toBe("https://swiatlosila.pl/cyfrowe-event/swiatlo-w-portrecie/");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("restores focus to the control that opened it when the sheet closes", () => {
    render(
      <DataProvider value={buildAppData(data)}>
        <button type="button">Otwieracz</button>
        <DetailSheet />
      </DataProvider>,
    );
    const opener = screen.getByRole("button", { name: "Otwieracz" });
    opener.focus();
    expect(document.activeElement).toBe(opener);
    act(() => {
      useStore.getState().selectSession("1:pt");
      useStore.getState().setSheet("detail");
    });
    expect(screen.getByRole("heading", { name: "Światło w portrecie" })).toBeTruthy();
    act(() => {
      useStore.getState().setSheet(null);
    });
    expect(document.activeElement).toBe(opener);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/DetailSheet.test.tsx`
Expected: the suite fails to load with `Failed to resolve import "../components/detail/DetailSheet"`.

- [ ] **Step 3: Write SpeakerBlock**

`src/components/detail/SpeakerBlock.tsx`:

```tsx
import { useState } from "react";
import type { Speaker } from "../../data/types";
import { Avatar } from "../ui/Avatar";
import styles from "./SpeakerBlock.module.css";

interface Props {
  speaker: Speaker;
}

export function SpeakerBlock({ speaker }: Props) {
  const [bioOpen, setBioOpen] = useState(false);
  const hasBio = speaker.bioHtml.trim() !== "";

  return (
    <div className={styles.block}>
      <div className={styles.head}>
        {/* Spec §7.6: the detail panel shows the large photo; the thumb is only the fallback here. */}
        <Avatar name={speaker.name} src={speaker.photo ?? speaker.photoThumb} size={56} />
        <div className={styles.text}>
          <div className={styles.name}>{speaker.name}</div>
          {speaker.brands.length > 0 ? <div className={styles.brands}>{speaker.brands.join(" · ")}</div> : null}
          {hasBio ? (
            <button type="button" className={styles.bioToggle} aria-expanded={bioOpen} onClick={() => setBioOpen((v) => !v)}>
              {bioOpen ? "Ukryj bio" : "Pokaż bio"}
            </button>
          ) : null}
        </div>
      </div>
      {hasBio && bioOpen ? (
        // bioHtml is the fetch script's allowlist-sanitized output (spec §4.3).
        <div className={styles.bio} dangerouslySetInnerHTML={{ __html: speaker.bioHtml }} />
      ) : null}
    </div>
  );
}
```

`src/components/detail/SpeakerBlock.module.css`:

```css
.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.name {
  font-weight: 600;
  color: var(--text);
}

.brands {
  font-size: 13px;
  color: var(--text-muted);
}

.bioToggle {
  align-self: flex-start;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.bioToggle:hover {
  color: var(--accent-hover);
}

.bio {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
}

.bio p {
  margin: 0 0 8px;
}

.bio hr {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 12px 0;
}

.bio a {
  color: var(--accent);
}
```

- [ ] **Step 4: Write SameTimeList**

`src/components/detail/SameTimeList.tsx`:

```tsx
import { useMemo } from "react";
import type { Session } from "../../data/types";
import { useData } from "../../data/index";
import { usePlanSet, useStore } from "../../state/store";
import { overlaps } from "../../domain/overlaps";
import { formatRange } from "../../domain/time";
import { locationLabel } from "../../domain/lookup";
import { Star } from "../ui/Star";
import styles from "./SameTimeList.module.css";

interface Props {
  session: Session;
}

const HEADING_ID = "same-time-heading";

export function SameTimeList({ session }: Props) {
  const { index } = useData();
  const planSet = usePlanSet();
  const preview = useStore((s) => s.previewPlan !== null);
  const selectSession = useStore((s) => s.selectSession);
  const toggleFavourite = useStore((s) => s.toggleFavourite);

  const others = useMemo(
    () =>
      (index.sessionsByDay.get(session.day) ?? [])
        .filter((o) => o.id !== session.id && overlaps(session, o))
        .sort((a, b) => (a.start ?? 0) - (b.start ?? 0) || a.title.localeCompare(b.title, "pl")),
    [index, session],
  );

  if (others.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby={HEADING_ID}>
      <h3 id={HEADING_ID} className={styles.heading}>
        W tym samym czasie
      </h3>
      <ul className={styles.rows} aria-labelledby={HEADING_ID}>
        {others.map((o) => {
          const time = o.start === null ? "" : formatRange(o.start, o.end);
          const location = locationLabel(o, index);
          return (
            <li key={o.id} className={styles.row}>
              <button
                type="button"
                className={styles.main}
                aria-label={`${o.title}, ${time}, ${location}`}
                onClick={() => selectSession(o.id)}
              >
                <span className={styles.time}>{time}</span>
                <span className={styles.title}>{o.title}</span>
                <span className={styles.location}>{location}</span>
              </button>
              {preview ? null : <Star pressed={planSet.has(o.id)} onToggle={() => toggleFavourite(o.id)} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

`src/components/detail/SameTimeList.module.css`:

```css
.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.heading {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 15px;
  color: var(--text);
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row {
  position: relative;
  display: flex;
  align-items: stretch;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-2);
}

.main {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 10px;
  row-gap: 2px;
  padding: 8px 48px 8px 10px;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.main:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: 8px;
}

.time {
  grid-row: 1 / span 2;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}

.title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location {
  color: var(--text-muted);
}

.row > :global(button[aria-label="Do planu"]) {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
}
```

- [ ] **Step 5: Write DetailSheet**

`src/components/detail/DetailSheet.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import type { Location, Signup } from "../../data/types";
import { useData } from "../../data/index";
import { MOBILE_BREAKPOINT, usePlanSet, useStore } from "../../state/store";
import { durationLabel, formatRange } from "../../domain/time";
import { locationsOf, speakersOf } from "../../domain/lookup";
import { Sheet } from "../ui/Sheet";
import { Chip } from "../ui/Chip";
import { SpeakerBlock } from "./SpeakerBlock";
import { SameTimeList } from "./SameTimeList";
import styles from "./DetailSheet.module.css";

const TITLE_ID = "detail-title";

const LEVEL_LABELS: Record<string, string> = {
  "0": "Poziom 0",
  I: "Poziom I",
  "I+II": "Poziom I i II",
  II: "Poziom II",
  III: "Poziom III",
};

function locationLine(l: Location): string {
  const parts = [l.venue];
  if (l.level !== null) parts.push(LEVEL_LABELS[l.level]);
  if (l.room !== null) parts.push(l.room);
  return parts.join(" · ");
}

/** "right" at 700 px and up, "bottom" below; follows window resizes. */
function useSheetSide(): "right" | "bottom" {
  const [wide, setWide] = useState(() => window.innerWidth >= MOBILE_BREAKPOINT);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= MOBILE_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return wide ? "right" : "bottom";
}

function SignupControl({ signup }: { signup: Signup }) {
  if (signup.status === "full") {
    return (
      <button type="button" className={styles.signup} disabled>
        {signup.label}
      </button>
    );
  }
  if (signup.url !== null) {
    return (
      <a className={styles.signup} href={signup.url} target="_blank" rel="noopener noreferrer">
        {signup.label}
      </a>
    );
  }
  return <span className={styles.signupInfo}>{signup.label}</span>;
}

export function DetailSheet() {
  const { index } = useData();
  const selectedId = useStore((s) => s.selectedSessionId);
  const openSheet = useStore((s) => s.openSheet);
  const preview = useStore((s) => s.previewPlan !== null);
  const setSheet = useStore((s) => s.setSheet);
  const toggleFavourite = useStore((s) => s.toggleFavourite);
  const planSet = usePlanSet();
  const side = useSheetSide();

  const session = selectedId === null ? null : (index.sessionById.get(selectedId) ?? null);
  const open = openSheet === "detail" && session !== null;

  // Focus restore: capture the opener synchronously when the store flips to "detail",
  // before React renders the dialog and the Sheet moves focus inside it.
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(
    () =>
      useStore.subscribe((state, prev) => {
        if (state.openSheet === "detail" && prev.openSheet !== "detail") {
          openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }
      }),
    [],
  );
  useEffect(() => {
    if (open || openerRef.current === null) return;
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener.isConnected) opener.focus();
  }, [open]);

  if (session === null) return null;

  const day = index.dayById.get(session.day);
  const types = session.typeIds.flatMap((id) => index.typeById.get(id) ?? []);
  const themes = session.themeIds.flatMap((id) => index.themeById.get(id) ?? []);
  const brands = session.brandIds.flatMap((id) => index.brandById.get(id) ?? []);
  const locations = locationsOf(session, index);
  const speakers = speakersOf(session, index);
  const inPlan = planSet.has(session.id);
  const timeLabel = session.start === null ? "Bez godziny" : formatRange(session.start, session.end);
  const duration = session.start === null ? null : durationLabel(session.start, session.end);

  return (
    <Sheet open={open} side={side} title="Szczegóły wydarzenia" onClose={() => setSheet(null)} labelledBy={TITLE_ID}>
      <article className={styles.detail}>
        {types.length > 0 ? (
          <ul className={styles.chips} aria-label="Typ">
            {types.map((t) => (
              <li key={t.id}>
                <Chip tone="accent">{t.name}</Chip>
              </li>
            ))}
          </ul>
        ) : null}
        <h2 id={TITLE_ID} className={styles.title}>
          {session.title}
        </h2>
        <p className={styles.when}>
          {day ? <span className={styles.day}>{day.labelLong}</span> : null}
          <span className={styles.time}>{timeLabel}</span>
          {duration !== null ? <span className={styles.duration}>{duration}</span> : null}
        </p>
        {locations.length > 0 ? (
          <ul className={styles.locations}>
            {locations.map((l) => (
              <li key={l.id}>{locationLine(l)}</li>
            ))}
          </ul>
        ) : null}
        {themes.length > 0 ? (
          <ul className={styles.chips} aria-label="Tematyka">
            {themes.map((t) => (
              <li key={t.id}>
                <Chip>{t.name}</Chip>
              </li>
            ))}
          </ul>
        ) : null}
        {brands.length > 0 ? (
          <ul className={styles.chips} aria-label="Marka">
            {brands.map((t) => (
              <li key={t.id}>
                <Chip>{t.name}</Chip>
              </li>
            ))}
          </ul>
        ) : null}
        {speakers.length > 0 ? (
          <div className={styles.speakers}>
            {speakers.map((sp) => (
              <SpeakerBlock key={sp.id} speaker={sp} />
            ))}
          </div>
        ) : session.byline !== null ? (
          <p className={styles.byline}>{session.byline}</p>
        ) : null}
        <div className={styles.actions}>
          <SignupControl signup={session.signup} />
          {preview ? null : (
            <button
              type="button"
              className={inPlan ? styles.planRemove : styles.planAdd}
              onClick={() => toggleFavourite(session.id)}
            >
              {inPlan ? "Usuń z planu" : "Dodaj do planu"}
            </button>
          )}
        </div>
        <SameTimeList session={session} />
        <a className={styles.source} href={session.url} target="_blank" rel="noopener noreferrer">
          Zobacz na stronie festiwalu
        </a>
      </article>
    </Sheet>
  );
}
```

`src/components/detail/DetailSheet.module.css`:

```css
.detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0 24px;
  color: var(--text);
}

.chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 22px;
  line-height: 1.2;
}

.when {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: 14px;
}

.day {
  font-weight: 600;
}

.time {
  font-family: var(--font-display);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.duration {
  color: var(--text-muted);
}

.locations {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 14px;
  color: var(--text-muted);
}

.speakers {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: var(--surface-2);
}

.byline {
  margin: 0;
  font-size: 14px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.signup,
.planAdd,
.planRemove {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.signup {
  color: var(--on-accent);
  background: var(--success);
  border-color: transparent;
}

.signup:disabled {
  color: var(--text);
  background: var(--danger);
  opacity: 0.7;
  cursor: default;
}

.signupInfo {
  font-size: 14px;
  color: var(--text-muted);
}

.planAdd {
  color: var(--on-accent);
  background: var(--accent);
  border-color: transparent;
}

.planAdd:hover {
  background: var(--accent-hover);
}

.planRemove {
  color: var(--text);
  background: transparent;
}

.source {
  align-self: flex-start;
  font-size: 14px;
  color: var(--accent);
}

@media (pointer: coarse) {
  .signup,
  .planAdd,
  .planRemove {
    min-height: 44px;
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/test/DetailSheet.test.tsx`
Expected: 12 passed.

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/detail src/test/DetailSheet.test.tsx
git commit -m "feat(detail): add DetailSheet with speakers and same-time list" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2"
```


### Task 33: Plan view

**Files:**
- Replace the Task 23 placeholder: `src/components/plan/PlanView.tsx`
- Create: `src/components/plan/PlanView.module.css`
- Create: `src/components/plan/PlanSummary.tsx`, `src/components/plan/PlanSummary.module.css`
- Create: `src/components/plan/ConflictsPanel.tsx`, `src/components/plan/ConflictsPanel.module.css`
- Create: `src/components/plan/PlanActions.tsx`, `src/components/plan/PlanActions.module.css`
- Replace the Task 23 placeholder: `src/components/plan/PrintPlan.tsx`
- Create: `src/components/plan/PrintPlan.module.css`
- Modify: `src/styles/print.css` (replace Task 23's provisional file with the complete print rules below)
- Modify: `src/App.tsx` (confirm the `PlanView` / `PrintPlan` imports and the single unconditional `<PrintPlan />` from Task 23 step 13; add them if the shell was written without them)
- Modify: `src/main.tsx` (confirm `import "./styles/print.css";` from Task 23 step 14; add it after `base.css` if absent)
- Test: `src/test/PlanView.test.tsx`

**Interfaces:**
- Consumes:
  - `src/data/index.tsx` (Task 23 step 3): `useData(): AppData` (`{ data, index, search }`) in every component; in tests `DataProvider({ value, children })` and `buildAppData(data: ScheduleData): AppData`, used through a local `renderWithData(ui)` helper exactly as `src/test/shell.test.tsx` does. The data module is never mocked.
  - `src/state/store.ts`: `useStore`, `usePlanSet(): ReadonlySet<string>`, `defaultSettings(viewportWidth)`, types `State`, `View`; actions `setSettings(patch)`, `setView(view)`, `savePreview()`, `closePreview()`, `removeFavourite(id)`, `addFavourites(ids)`, `pushToast(text, action?)`, `setCopyText(text)`, `setSheet(kind)` (`clearFilters()` is called by `FilteredEmpty`, not by the plan components).
  - `src/state/derive.ts`: `daySets(args): DaySets`, `buildColumns(sets, axis, data, index): Column[]`, `resolveTimeMode(settings, layout): ResolvedTime`, `listGroups(sets, resolved, settings): ListGroup[]`.
  - `src/state/clipboard.ts`: `copyText(text: string): Promise<boolean>`.
  - `src/domain/plan.ts`: `planSessions(planSet, sessions): Session[]`, `planSummary(planSessions, days): PlanSummary` (`perDay` has one entry per day, zero counts included; `conflicts` only days with pairs; `conflictCount`), `nextUp(planSessions, days, now): Session | null`.
  - `src/domain/now.ts`: `nowFor(day, now): number | null`, `minutesUntil(start, nowMinutes): number`.
  - `src/domain/time.ts`: `formatRange(start, end): string`.
  - `src/domain/lookup.ts`: `locationLabel(s, index): string`.
  - `src/domain/filters.ts`: `EMPTY_FILTERS` (tests only; the `activeFilterCount` check lives inside `FilteredEmpty`).
  - `src/domain/text.ts`: `planLines(sessions, data, index): PlanLinesEntry[]`, `planAsText(sessions, data, index): string`.
  - `src/domain/ics.ts`: `buildIcs(sessions, data, index): string`.
  - `src/domain/share.ts`: `buildShareUrl(href, dayId, ids): string`.
  - Components: `ScheduleGrid({ sets, columns, resolved, dayId })` and `FilteredEmpty({ text?: string; extraActions?: ReactNode })`, both named exports of `src/components/grid/ScheduleGrid.tsx` (Task 26; `FilteredEmpty` renders the "Brak wydarzeń dla tych filtrów" title, or `text` when given, plus the active-filter chips and the "Wyczyść filtry" button, the last two only when `activeFilterCount(filters) > 0`), `ScheduleList({ groups })`, `Segmented({ value, options, onChange, ariaLabel })`, `EmptyState({ title, text?, actions?, illustration? })`.
  - `lucide-react` icons `Copy`, `Share2`, `Download`, `Printer`.
- Produces:
  - `PlanView()` (named export, no props) rendered by `App` when `view === "plan"`.
  - `PrintPlan()` (named export, no props) rendered by `App` once in every view; it portals `<section className="print-plan">` into `document.body` so `print.css` can hide every other body child.
  - Internal to `src/components/plan/` (named exports, not used elsewhere): `PlanSummary({ summary: PlanSummary; next: Session | null; now: Date })`, `ConflictsPanel({ conflicts: PlanSummary["conflicts"]; preview: boolean })`, `PlanActions({ plan: Session[]; preview: boolean })`.
  - DOM contract used by the tests: the conflicts panel is a `<section>` named "Konflikty w planie" (role `region`); every removal button has `aria-label="Usuń z planu: <title>"`; the layout toggle is a `radiogroup` named "Układ planu" with radios "Siatka" and "Lista"; the wrapper around the grid/list carries `key` `${day}:${planLayout}:${resolved.mode}` and class `schedule` (Task 34 relies on it for the crossfade).

Empty-state decision tree inside `PlanView` (spec §7.5, §9): `plan` = `planSessions(planSet, data.sessions)` across every day. When `plan.length === 0` the view shows only the "Twój plan jest pusty" state (plus the preview header while previewing). Otherwise the summary, actions and conflicts render, and the schedule area renders `FilteredEmpty` from `src/components/grid/ScheduleGrid.tsx` when `sets.visible.length === 0` (nothing of the plan on this day, or nothing passing the filters): the section 9 state "Brak wydarzeń dla tych filtrów" with the active-filter chips and "Wyczyść filtry", both present only when `activeFilterCount(filters) > 0`; else `ScheduleGrid` or `ScheduleList` by `settings.planLayout`. `ScheduleList` returns `null` for an empty group list (Task 29), so the plan view owns this state itself; the grid's own strip-only state (visible non-empty, rendered empty) stays the grid's job.

Steps:

- [ ] **Step 1: Write the failing test**

Create `src/test/PlanView.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { makeData, makeSession } from "./fixtures/build";
import { DataProvider, buildAppData } from "../data/index";
import App from "../App";
import { PlanView } from "../components/plan/PlanView";
import { PrintPlan } from "../components/plan/PrintPlan";
import { useStore, defaultSettings, type State, type View } from "../state/store";
import { EMPTY_FILTERS } from "../domain/filters";
import { planSessions } from "../domain/plan";
import { planAsText, planLines } from "../domain/text";
import { buildShareUrl } from "../domain/share";

// Synthetic fixture, injected through DataProvider (the data module is never mocked).
// 2:pt (11:00–12:00) and 3:pt (11:15–12:15) overlap; 1:pt (10:00–11:00) touches 2:pt at 11:00 and does not overlap.
const fixture = makeData([
  makeSession({ id: "1:pt", eventId: 1, day: "pt", title: "Poranne światło", start: 600, end: 660, locationIds: [233] }),
  makeSession({ id: "2:pt", eventId: 2, day: "pt", title: "Światło, które widzisz", start: 660, end: 720, locationIds: [281] }),
  makeSession({ id: "3:pt", eventId: 3, day: "pt", title: "Świadomy reset", start: 675, end: 735, locationIds: [233] }),
  makeSession({ id: "4:sob", eventId: 4, day: "sob", title: "Sobotni warsztat", start: 660, end: 720, locationIds: [233] }),
  makeSession({ id: "5:pt", eventId: 5, day: "pt", title: "Spotkanie bez godziny", start: null, end: null, timeText: "" }),
]);
const appData = buildAppData(fixture);
const { data, index } = appData;

/** Every component under test reads the schedule through `useData()`, so the tree is always mounted inside the provider. */
function renderWithData(ui: ReactNode) {
  return render(<DataProvider value={appData}>{ui}</DataProvider>);
}

const FRI_10 = "1:pt";
const FRI_11 = "2:pt";
const FRI_11_15 = "3:pt";
const SAT_11 = "4:sob";
const NO_TIME = "5:pt";
const TITLE_FRI_11 = "Światło, które widzisz";
const TITLE_FRI_11_15 = "Świadomy reset";
const WARSZTATY = 5; // type id from makeData; none of the sessions above carries it
const SHARE_TOAST_FILE =
  "Skopiowano. Link zadziała tylko u osób z tym samym plikiem. Opublikuj aplikację w sieci, aby udostępniać plan";
const ICS_FILENAME = "swiatlosila-2026-plan.ics";

function labelLong(dayId: string): string {
  const day = data.days.find((d) => d.id === dayId);
  if (!day) throw new Error(`Brak dnia ${dayId} w fixture`);
  return day.labelLong;
}

function reset(patch: Partial<State> = {}): void {
  localStorage.clear();
  useStore.setState({
    day: "pt",
    view: "plan",
    filters: EMPTY_FILTERS,
    settings: defaultSettings(1440),
    favourites: [],
    previewPlan: null,
    sharedPlan: null,
    selectedSessionId: null,
    openSheet: null,
    copyText: null,
    toasts: [],
    now: new Date(2026, 8, 4, 10, 30),
    ...patch,
  });
}

function stubClipboard() {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  return writeText;
}

function lastToast() {
  const toasts = useStore.getState().toasts;
  return toasts[toasts.length - 1];
}

beforeEach(() => reset());

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "clipboard");
  Reflect.deleteProperty(URL, "createObjectURL");
  Reflect.deleteProperty(URL, "revokeObjectURL");
});

describe("PlanView empty states", () => {
  it("shows the empty-plan copy and switches to the grid from its button", async () => {
    const user = userEvent.setup();
    renderWithData(<PlanView />);
    expect(screen.getByText("Twój plan jest pusty")).not.toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Układ planu" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Przeglądaj harmonogram" }));
    expect(useStore.getState().view).toBe("grid");
  });

  it("uses the section 9 empty state with no chips and no clear button when the plan lives on another day", () => {
    reset({ favourites: [SAT_11] });
    renderWithData(<PlanView />);
    // No filter is active, so FilteredEmpty renders the title alone: no filter chips and no clear button.
    expect(screen.getByText("Brak wydarzeń dla tych filtrów")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Wyczyść filtry" })).toBeNull();
    expect(screen.queryByText("Twój plan jest pusty")).toBeNull();
    expect(screen.getByText("Sob 1")).not.toBeNull();
  });

  it("offers Wyczyść filtry when a facet hides every plan session of the day", async () => {
    const user = userEvent.setup();
    reset({ favourites: [FRI_11], filters: { ...EMPTY_FILTERS, types: [WARSZTATY] } });
    renderWithData(<PlanView />);
    expect(screen.getByText("Brak wydarzeń dla tych filtrów")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Wyczyść filtry" }));
    expect(useStore.getState().filters.types).toEqual([]);
    expect(screen.getAllByText(TITLE_FRI_11).length).toBeGreaterThan(0);
  });
});

describe("PlanSummary", () => {
  it("summarises counts per day, the conflict pill and the next session", () => {
    reset({ favourites: [FRI_10, FRI_11, FRI_11_15, SAT_11] });
    renderWithData(<PlanView />);
    expect(screen.getByText("Pt 3 · Sob 1")).not.toBeNull();
    expect(screen.getByText("1 konflikt")).not.toBeNull();
    expect(screen.getByText(`Następne: ${TITLE_FRI_11} za 30 min`)).not.toBeNull();
  });

  it("hides the conflict pill and the next-up text when they do not apply", () => {
    // Saturday 10:30: the only plan session is on Friday, so nothing is "next" today.
    reset({ favourites: [FRI_10], now: new Date(2026, 8, 5, 10, 30) });
    renderWithData(<PlanView />);
    expect(screen.getByText("Pt 1")).not.toBeNull();
    expect(screen.queryByText(/konflikt/)).toBeNull();
    expect(screen.queryByText(/^Następne:/)).toBeNull();
  });
});

describe("ConflictsPanel", () => {
  it("lists conflict pairs by day, removes a side with a toast and restores it with Cofnij", async () => {
    const user = userEvent.setup();
    reset({ favourites: [FRI_11, FRI_11_15] });
    renderWithData(<PlanView />);
    const panel = screen.getByRole("region", { name: "Konflikty w planie" });
    expect(within(panel).getByText(labelLong("pt"))).not.toBeNull();
    expect(within(panel).getByText(TITLE_FRI_11)).not.toBeNull();
    expect(within(panel).getByText(TITLE_FRI_11_15)).not.toBeNull();
    expect(within(panel).getByText("11:00–12:00")).not.toBeNull();
    expect(within(panel).getByText("11:15–12:15")).not.toBeNull();
    expect(within(panel).getByText("Sala wykł. 2")).not.toBeNull();
    expect(within(panel).getByText("Sala wykł. 1")).not.toBeNull();

    await user.click(within(panel).getByRole("button", { name: `Usuń z planu: ${TITLE_FRI_11_15}` }));
    expect(useStore.getState().favourites).toEqual([FRI_11]);
    expect(screen.queryByRole("region", { name: "Konflikty w planie" })).toBeNull();

    const toast = lastToast();
    expect(toast?.text).toBe(`Usunięto z planu: ${TITLE_FRI_11_15}`);
    expect(toast?.action?.label).toBe("Cofnij");
    act(() => {
      toast?.action?.run();
    });
    expect(new Set(useStore.getState().favourites)).toEqual(new Set([FRI_11, FRI_11_15]));
    expect(screen.getByRole("region", { name: "Konflikty w planie" })).not.toBeNull();
  });

  it("renders no panel when the plan has no overlapping pair", () => {
    reset({ favourites: [FRI_10, FRI_11] });
    renderWithData(<PlanView />);
    expect(screen.queryByRole("region", { name: "Konflikty w planie" })).toBeNull();
  });
});

describe("preview mode", () => {
  it("shows the preview header and hides membership controls while previewing", async () => {
    const user = userEvent.setup();
    reset({ favourites: [], previewPlan: [FRI_11, FRI_11_15] });
    renderWithData(<PlanView />);
    expect(screen.getByText("Podgląd udostępnionego planu · nie zapisano")).not.toBeNull();
    expect(screen.getByRole("region", { name: "Konflikty w planie" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /^Usuń z planu/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Udostępnij" })).toBeNull();
    expect(screen.getByRole("button", { name: "Kopiuj jako tekst" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Zamknij podgląd" })).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Zapisz jako mój plan" }));
    expect(useStore.getState().previewPlan).toBeNull();
    expect(new Set(useStore.getState().favourites)).toEqual(new Set([FRI_11, FRI_11_15]));
  });

  it("closes the preview without touching favourites", async () => {
    const user = userEvent.setup();
    reset({ favourites: [FRI_10], previewPlan: [FRI_11] });
    renderWithData(<PlanView />);
    await user.click(screen.getByRole("button", { name: "Zamknij podgląd" }));
    expect(useStore.getState().previewPlan).toBeNull();
    expect(useStore.getState().favourites).toEqual([FRI_10]);
  });
});

describe("plan layout", () => {
  it("switches between list and grid with the segmented toggle and keeps the card in both", async () => {
    const user = userEvent.setup();
    reset({ favourites: [FRI_11] });
    renderWithData(<PlanView />);
    expect(useStore.getState().settings.planLayout).toBe("list");
    expect(screen.getAllByText(TITLE_FRI_11).length).toBeGreaterThan(0);
    const group = screen.getByRole("radiogroup", { name: "Układ planu" });
    await user.click(within(group).getByRole("radio", { name: "Siatka" }));
    expect(useStore.getState().settings.planLayout).toBe("grid");
    expect(screen.getAllByText(TITLE_FRI_11).length).toBeGreaterThan(0);
    await user.click(within(group).getByRole("radio", { name: "Lista" }));
    expect(useStore.getState().settings.planLayout).toBe("list");
  });
});

describe("PlanActions", () => {
  const plan = () => planSessions(new Set(useStore.getState().favourites), data.sessions);

  it("renders the four actions in spec order", () => {
    reset({ favourites: [FRI_11] });
    renderWithData(<PlanView />);
    const group = screen.getByRole("group", { name: "Akcje planu" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Kopiuj jako tekst",
      "Udostępnij",
      "Pobierz .ics",
      "Drukuj",
    ]);
  });

  it("copies the plan as text and confirms with a toast", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    reset({ favourites: [FRI_11] });
    renderWithData(<PlanView />);
    await user.click(screen.getByRole("button", { name: "Kopiuj jako tekst" }));
    await waitFor(() => expect(useStore.getState().toasts.map((t) => t.text)).toContain("Skopiowano plan jako tekst"));
    expect(writeText).toHaveBeenCalledWith(planAsText(plan(), data, index));
    expect(useStore.getState().openSheet).toBeNull();
  });

  it("falls back to the manual copy sheet when the clipboard is unavailable", async () => {
    const user = userEvent.setup();
    // userEvent.setup() installs a working clipboard stub; drop it so copyText() resolves false.
    // afterEach deletes the property again, which removes this override as well.
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    reset({ favourites: [FRI_11] });
    renderWithData(<PlanView />);
    await user.click(screen.getByRole("button", { name: "Kopiuj jako tekst" }));
    await waitFor(() => expect(useStore.getState().openSheet).toBe("copy"));
    expect(useStore.getState().copyText).toBe(planAsText(plan(), data, index));
    expect(useStore.getState().toasts).toEqual([]);
  });

  it("copies the share link and pushes the file: warning when the app runs from disk", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    vi.stubGlobal("location", { href: "file:///Users/tom/dist/index.html", protocol: "file:" });
    reset({ favourites: [FRI_11, SAT_11] });
    renderWithData(<PlanView />);
    await user.click(screen.getByRole("button", { name: "Udostępnij" }));
    await waitFor(() => expect(useStore.getState().toasts.map((t) => t.text)).toContain(SHARE_TOAST_FILE));
    expect(writeText).toHaveBeenCalledWith(buildShareUrl("file:///Users/tom/dist/index.html", "pt", [FRI_11, SAT_11]));
  });

  it("copies a plain share link under https, dropping the query and keeping every day of the plan", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    vi.stubGlobal("location", { href: "https://example.org/plan/?now=2026-09-04T10:30#d=pt&v=grid", protocol: "https:" });
    reset({ favourites: [FRI_11, SAT_11], day: "sob" });
    renderWithData(<PlanView />);
    await user.click(screen.getByRole("button", { name: "Udostępnij" }));
    await waitFor(() => expect(useStore.getState().toasts.map((t) => t.text)).toContain("Skopiowano link do planu"));
    const url = writeText.mock.calls[0]?.[0] ?? "";
    expect(url.startsWith("https://example.org/plan/#d=sob&v=plan&plan=1~")).toBe(true);
    expect(url).not.toContain("now=");
    expect(url).toBe(buildShareUrl("https://example.org/plan/?now=2026-09-04T10:30#d=pt&v=grid", "sob", [FRI_11, SAT_11]));
  });

  it("downloads the .ics through a temporary anchor named swiatlosila-2026-plan.ics", async () => {
    const user = userEvent.setup();
    const created: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return "blob:plan";
    });
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true, writable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true, writable: true });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(`${this.download}|${this.getAttribute("href")}`);
    });

    reset({ favourites: [FRI_11] });
    renderWithData(<PlanView />);
    await user.click(screen.getByRole("button", { name: "Pobierz .ics" }));

    expect(created).toHaveLength(1);
    expect(created[0]?.type).toBe("text/calendar;charset=utf-8");
    expect(created[0]?.size).toBeGreaterThan(0);
    expect(downloads).toEqual([`${ICS_FILENAME}|blob:plan`]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:plan");
    expect(document.body.querySelector(`a[download="${ICS_FILENAME}"]`)).toBeNull();
  });

  it("calls window.print for Drukuj", async () => {
    const user = userEvent.setup();
    const print = vi.fn();
    Object.defineProperty(window, "print", { value: print, configurable: true, writable: true });
    reset({ favourites: [FRI_11] });
    renderWithData(<PlanView />);
    await user.click(screen.getByRole("button", { name: "Drukuj" }));
    expect(print).toHaveBeenCalledTimes(1);
  });
});

describe("PrintPlan", () => {
  const printSection = (): HTMLElement | null => document.body.querySelector("section.print-plan");

  it("is rendered by App in the grid view, the list view and both plan layouts", () => {
    const cases: { view: View; planLayout: "grid" | "list" }[] = [
      { view: "grid", planLayout: "list" },
      { view: "list", planLayout: "list" },
      { view: "plan", planLayout: "grid" },
      { view: "plan", planLayout: "list" },
    ];
    for (const c of cases) {
      reset({ view: c.view, favourites: [FRI_10], settings: { ...defaultSettings(1440), planLayout: c.planLayout } });
      const { unmount } = renderWithData(<App />);
      expect(printSection(), `${c.view}/${c.planLayout}`).not.toBeNull();
      expect(document.body.querySelectorAll("section.print-plan")).toHaveLength(1);
      unmount();
      expect(printSection()).toBeNull();
    }
  });

  it("prints one heading per planLines entry with the lines, Bez godziny last", () => {
    reset({ favourites: [FRI_10, SAT_11, NO_TIME] });
    renderWithData(<PrintPlan />);
    const section = printSection();
    expect(section).not.toBeNull();
    const headings = Array.from(section?.querySelectorAll("h2") ?? []).map((h) => h.textContent);
    expect(headings).toEqual([labelLong("pt"), labelLong("sob"), "Bez godziny"]);
    const expected = planLines(planSessions(new Set([FRI_10, SAT_11, NO_TIME]), data.sessions), data, index);
    const items = Array.from(section?.querySelectorAll("li") ?? []).map((li) => li.textContent);
    expect(items).toEqual(expected.flatMap((e) => e.lines));
    expect(items[0]).toContain("10:00–11:00 · Poranne światło");
    expect(items[items.length - 1]).toContain("Spotkanie bez godziny");
  });

  it("says the plan is empty when nothing is starred", () => {
    renderWithData(<PrintPlan />);
    expect(printSection()?.textContent).toContain("Twój plan jest pusty");
    expect(printSection()?.querySelectorAll("h2")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/tom/Projects/conference-melt && npx vitest run src/test/PlanView.test.tsx`

Expected: the file fails to load with `Error: Failed to resolve import "../components/plan/PlanView" from "src/test/PlanView.test.tsx"`; no test runs. (If the shell task's `App.tsx` already imports `./components/plan/PlanView`, the message names `src/App.tsx` instead; either way nothing runs.)

- [ ] **Step 3: Replace `src/styles/print.css`**

Overwrite the provisional file from Task 23 with the complete print rules (spec §7.5). `PrintPlan` portals its section into `<body>`, so `body > *` hides the app root, every sheet portal and the toast region, and the section alone prints:

```css
/* Print support (spec §7.5). PrintPlan portals <section class="print-plan"> into <body>. */

.print-plan {
  display: none;
}

@media print {
  body > * {
    display: none !important;
  }

  .print-plan {
    display: block !important;
  }

  @page {
    margin: 15mm;
  }

  .print-plan {
    margin: 0;
    padding: 0;
    color: #000;
    background: #fff;
    font: 12pt/1.4 "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }

  .print-plan h1 {
    margin: 0 0 12pt;
    font-family: "Bricolage Grotesque", "Inter", system-ui, sans-serif;
    font-size: 18pt;
    font-weight: 700;
  }

  .print-plan h2 {
    margin: 14pt 0 6pt;
    font-family: "Bricolage Grotesque", "Inter", system-ui, sans-serif;
    font-size: 14pt;
    font-weight: 600;
    break-after: avoid;
  }

  .print-plan ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .print-plan li {
    padding: 3pt 0;
    border-bottom: 1pt solid #bbb;
    break-inside: avoid;
  }

  .print-plan p {
    margin: 0;
  }
}
```

- [ ] **Step 4: Write `PrintPlan`**

`src/components/plan/PrintPlan.tsx`:

```tsx
import { useMemo } from "react";
import { createPortal } from "react-dom";
import { useData } from "../../data/index";
import { planSessions } from "../../domain/plan";
import { planLines } from "../../domain/text";
import { usePlanSet } from "../../state/store";
import styles from "./PrintPlan.module.css";

const NO_TIME_HEADING = "Bez godziny";

/**
 * Print-only rendering of the plan set (spec §7.5). App renders it once in every view.
 * Portalled to <body> so print.css can hide every other body child with `body > *`.
 * The global class `print-plan` is what print.css targets; the module class only adds screen-safe resets.
 */
export function PrintPlan() {
  const { data, index } = useData();
  const planSet = usePlanSet();
  const entries = useMemo(() => planLines(planSessions(planSet, data.sessions), data, index), [planSet, data, index]);

  return createPortal(
    <section className={`print-plan ${styles.section}`} aria-hidden="true">
      <h1>Mój plan · ŚwiatłoSiła 2026</h1>
      {entries.length === 0 && <p>Twój plan jest pusty</p>}
      {entries.map((entry) => (
        <div key={entry.day ? entry.day.id : "no-time"}>
          <h2>{entry.day ? entry.day.labelLong : NO_TIME_HEADING}</h2>
          <ul>
            {entry.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>,
    document.body,
  );
}
```

`src/components/plan/PrintPlan.module.css`:

```css
/* The section is hidden on screen by src/styles/print.css; these rules only matter on paper. */
.section h1,
.section h2 {
  page-break-after: avoid;
}
```

`aria-hidden="true"` keeps the hidden section out of the accessibility tree on screen; print output is unaffected. Line keys use the line text: `planLines` never repeats a line inside one entry (each session yields exactly one line).

- [ ] **Step 5: Write `PlanSummary`**

`src/components/plan/PlanSummary.tsx`:

```tsx
import type { Session } from "../../data/types";
import { useData } from "../../data/index";
import { minutesUntil, nowFor } from "../../domain/now";
import type { PlanSummary as PlanSummaryData } from "../../domain/plan";
import styles from "./PlanSummary.module.css";

export interface PlanSummaryProps {
  summary: PlanSummaryData;
  next: Session | null;
  now: Date;
}

/** Polish plural for "konflikt": 1 konflikt, 2–4 konflikty, 5+ konfliktów (22–24 → konflikty, 12–14 → konfliktów). */
function conflictLabel(n: number): string {
  const last = n % 10;
  const lastTwo = n % 100;
  if (n === 1) return "1 konflikt";
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} konflikty`;
  return `${n} konfliktów`;
}

export function PlanSummary({ summary, next, now }: PlanSummaryProps) {
  const { index } = useData();
  const perDay = summary.perDay
    .filter((p) => p.count > 0)
    .map((p) => `${p.day.short} ${p.count}`)
    .join(" · ");

  let nextText: string | null = null;
  if (next !== null && next.start !== null) {
    const day = index.dayById.get(next.day);
    const nowMinutes = day ? nowFor(day, now) : null;
    if (nowMinutes !== null) nextText = `Następne: ${next.title} za ${minutesUntil(next.start, nowMinutes)} min`;
  }

  return (
    <div className={styles.bar}>
      <span className={styles.days}>{perDay}</span>
      {summary.conflictCount > 0 && <span className={styles.conflicts}>{conflictLabel(summary.conflictCount)}</span>}
      {nextText !== null && <span className={styles.next}>{nextText}</span>}
    </div>
  );
}
```

`src/components/plan/PlanSummary.module.css`:

```css
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  min-width: 0;
  font-size: 14px;
}

.days {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.01em;
  color: var(--text);
  white-space: nowrap;
}

.conflicts {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  border-radius: var(--radius-chip);
  background: var(--warning);
  color: var(--on-accent);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.next {
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
```

- [ ] **Step 6: Write `ConflictsPanel`**

`src/components/plan/ConflictsPanel.tsx`:

```tsx
import { useId } from "react";
import type { Session } from "../../data/types";
import { useData } from "../../data/index";
import { locationLabel } from "../../domain/lookup";
import type { PlanSummary } from "../../domain/plan";
import { formatRange } from "../../domain/time";
import { useStore } from "../../state/store";
import styles from "./ConflictsPanel.module.css";

export interface ConflictsPanelProps {
  conflicts: PlanSummary["conflicts"];
  preview: boolean;
}

function Side({ session, preview }: { session: Session; preview: boolean }) {
  const { index } = useData();
  const removeFavourite = useStore((s) => s.removeFavourite);
  const addFavourites = useStore((s) => s.addFavourites);
  const pushToast = useStore((s) => s.pushToast);
  const time = session.start === null ? "Bez godziny" : formatRange(session.start, session.end);
  const location = locationLabel(session, index);

  const remove = (): void => {
    removeFavourite(session.id);
    pushToast(`Usunięto z planu: ${session.title}`, { label: "Cofnij", run: () => addFavourites([session.id]) });
  };

  return (
    <div className={styles.side}>
      <span className={styles.time}>{time}</span>
      <span className={styles.title}>{session.title}</span>
      {location !== "" && <span className={styles.location}>{location}</span>}
      {!preview && (
        <button type="button" className={styles.remove} aria-label={`Usuń z planu: ${session.title}`} onClick={remove}>
          Usuń z planu
        </button>
      )}
    </div>
  );
}

/** Spec §7.5: every overlapping pair across all days, grouped by day; removal is undoable through the toast. */
export function ConflictsPanel({ conflicts, preview }: ConflictsPanelProps) {
  const headingId = useId();
  if (conflicts.length === 0) return null;

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        Konflikty w planie
      </h2>
      {conflicts.map((group) => (
        <div key={group.day.id} className={styles.day}>
          <h3 className={styles.dayLabel}>{group.day.labelLong}</h3>
          <ul className={styles.pairs}>
            {group.pairs.map((pair) => (
              <li key={`${pair.a.id}|${pair.b.id}`} className={styles.pair}>
                <Side session={pair.a} preview={preview} />
                <Side session={pair.b} preview={preview} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
```

`src/components/plan/ConflictsPanel.module.css`:

```css
.panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid color-mix(in oklch, var(--warning) 45%, var(--border));
  border-radius: var(--radius-sheet);
  background: color-mix(in oklch, var(--warning) 8%, var(--surface-1));
}

.heading {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 16px;
  color: var(--text);
}

.day {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dayLabel {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}

.pairs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Sides stack below 700 px and sit side by side from 700 px up (spec §7.5). */
.pair {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.side {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2px;
  min-width: 0;
  padding: 10px 12px;
  border-radius: var(--radius-card);
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.time {
  font-family: var(--font-display);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.title {
  font-weight: 600;
  color: var(--text);
}

.location {
  font-size: 13px;
  color: var(--text-muted);
}

.remove {
  justify-self: start;
  margin-top: 6px;
  min-height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-chip);
  border: 1px solid var(--border);
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

.remove:hover {
  border-color: var(--danger);
  color: var(--danger);
}

@media (min-width: 700px) {
  .pair {
    grid-template-columns: 1fr 1fr;
  }
}

@media (pointer: coarse) {
  .remove {
    min-height: 44px;
  }
}
```

- [ ] **Step 7: Write `PlanActions`**

`src/components/plan/PlanActions.tsx`:

```tsx
import { Copy, Download, Printer, Share2 } from "lucide-react";
import type { Session } from "../../data/types";
import { useData } from "../../data/index";
import { buildIcs } from "../../domain/ics";
import { buildShareUrl } from "../../domain/share";
import { planAsText } from "../../domain/text";
import { copyText } from "../../state/clipboard";
import { useStore } from "../../state/store";
import styles from "./PlanActions.module.css";

export interface PlanActionsProps {
  plan: Session[];
  preview: boolean;
}

const ICS_FILENAME = "swiatlosila-2026-plan.ics";
const COPY_TOAST = "Skopiowano plan jako tekst";
const SHARE_TOAST = "Skopiowano link do planu";
const SHARE_TOAST_FILE =
  "Skopiowano. Link zadziała tylko u osób z tym samym plikiem. Opublikuj aplikację w sieci, aby udostępniać plan";

/** Spec §7.5: a Blob, a temporary anchor with `download`, click, revoke. */
function downloadIcs(ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = ICS_FILENAME;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function PlanActions({ plan, preview }: PlanActionsProps) {
  const { data, index } = useData();
  const day = useStore((s) => s.day);
  const favourites = useStore((s) => s.favourites);
  const pushToast = useStore((s) => s.pushToast);
  const setCopyText = useStore((s) => s.setCopyText);
  const setSheet = useStore((s) => s.setSheet);

  /** Clipboard first; when it is missing or refuses, the "Skopiuj ręcznie" sheet takes over (spec §7.5). */
  const copyOrFallback = async (text: string, toast: string): Promise<void> => {
    if (await copyText(text)) {
      pushToast(toast);
      return;
    }
    setCopyText(text);
    setSheet("copy");
  };

  const onCopy = (): void => {
    void copyOrFallback(planAsText(plan, data, index), COPY_TOAST);
  };

  // The share link carries the whole saved plan (every day), never the preview.
  const onShare = (): void => {
    const { href, protocol } = window.location;
    void copyOrFallback(buildShareUrl(href, day, favourites), protocol === "file:" ? SHARE_TOAST_FILE : SHARE_TOAST);
  };

  const onIcs = (): void => downloadIcs(buildIcs(plan, data, index));
  const onPrint = (): void => window.print();

  return (
    <div className={styles.actions} role="group" aria-label="Akcje planu">
      <button type="button" className={styles.action} onClick={onCopy}>
        <Copy size={16} aria-hidden="true" />
        Kopiuj jako tekst
      </button>
      {!preview && (
        <button type="button" className={styles.action} onClick={onShare}>
          <Share2 size={16} aria-hidden="true" />
          Udostępnij
        </button>
      )}
      <button type="button" className={styles.action} onClick={onIcs}>
        <Download size={16} aria-hidden="true" />
        Pobierz .ics
      </button>
      <button type="button" className={styles.action} onClick={onPrint}>
        <Printer size={16} aria-hidden="true" />
        Drukuj
      </button>
    </div>
  );
}
```

`src/components/plan/PlanActions.module.css`:

```css
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-chip);
  border: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
}

.action:hover {
  border-color: var(--accent);
  color: var(--accent);
}

@media (pointer: coarse) {
  .action {
    min-height: 44px;
  }
}
```

- [ ] **Step 8: Write `PlanView`**

`src/components/plan/PlanView.tsx`:

```tsx
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
```

`src/components/plan/PlanView.module.css`:

```css
.view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 12px;
  padding: 12px 16px 0;
}

.previewBar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 10px 14px;
  border-radius: var(--radius-sheet);
  background: color-mix(in oklch, var(--accent) 14%, var(--surface-1));
  border: 1px solid color-mix(in oklch, var(--accent) 40%, var(--border));
}

.previewText {
  flex: 1 1 240px;
  font-weight: 600;
}

.previewActions {
  display: flex;
  gap: 8px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
}

.primary,
.secondary {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 16px;
  border-radius: var(--radius-chip);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.primary {
  background: var(--accent);
  color: var(--on-accent);
}

.primary:hover {
  background: var(--accent-hover);
}

.secondary {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
}

.secondary:hover {
  border-color: var(--text-muted);
}

/* The grid or list fills what is left; its own scroll container handles both axes. */
.schedule {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  margin: 0 -16px;
}

@media (max-width: 699.98px) {
  .view {
    padding: 10px 12px 0;
  }

  .schedule {
    margin: 0 -12px;
  }
}

@media (pointer: coarse) {
  .primary,
  .secondary {
    min-height: 44px;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .schedule {
    animation: planFade 160ms ease-out;
  }
}

@keyframes planFade {
  from {
    opacity: 0;
  }
}
```

- [ ] **Step 9: Confirm the App and entry wiring**

Open `src/App.tsx`. The plan view and print section must be wired exactly as Task 23 step 13 wrote them. The import block contains these two lines:

```tsx
import { PlanView } from "./components/plan/PlanView";
import { PrintPlan } from "./components/plan/PrintPlan";
```

The view switch inside `<main>` contains this line:

```tsx
            {view === "plan" && <PlanView />}
```

And the last two children of the root `<div className={styles.app}>` are:

```tsx
      {tier === "mobile" && <BottomBar />}
      <PrintPlan />
    </div>
```

If either import, the plan route or the `<PrintPlan />` element (rendered once, outside every conditional) is missing, add it as shown. Then open `src/main.tsx` and confirm the style imports read:

```tsx
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/print.css";
```

Add the `print.css` line after `base.css` if it is absent.

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run src/test/PlanView.test.tsx`

Expected: 20 tests pass (3 empty states, 2 summary, 2 conflicts, 2 preview, 1 layout, 7 actions, 3 print). The `App` cases render inside `renderWithData`, so `App` and every component below it (Tasks 23–32) read the fixture through `useData()`; nothing is mocked. If a case sees the real snapshot instead of the fixture (for example `Sob 1` missing from the summary), some component imports `data`, `index` or `search` from the data module directly; switch it to `const { data, index, search } = useData();` like every other component.

Run: `cd /Users/tom/Projects/conference-melt && npm run typecheck`

Expected: no errors.

Run: `cd /Users/tom/Projects/conference-melt && npm test`

Expected: the whole suite is green, including `src/test/shell.test.tsx`'s `App` case (`.print-plan` is now portalled into `document.body`, which `document.querySelector` still finds).

- [ ] **Step 11: Commit**

```bash
cd /Users/tom/Projects/conference-melt && git add src/components/plan src/styles/print.css src/App.tsx src/main.tsx src/test/PlanView.test.tsx && git commit -F - <<'EOF'
feat(plan): add plan view with summary, conflicts, actions and print section

PlanView renders the plan-restricted grid or list per planLayout with a
Segmented toggle, the preview header, the empty-plan and section 9
states; PlanSummary shows per-day counts, the conflict pill and the
next session; ConflictsPanel lists pairs by day with undoable removal;
PlanActions copies text, shares a link (file: warning), downloads .ics
and prints; PrintPlan portals the print-only section and print.css
hides everything else.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2
EOF
```

---

### Task 34: Motion and eye-candy

**Files:**
- Create: `src/components/shell/Grain.tsx`, `src/components/shell/Grain.module.css`
- Create: `scripts/check-tokens.mjs`
- Modify: `src/App.tsx` (drop the inline `Grain` function from Task 23; import `Grain` from `./components/shell/Grain` and render `<Grain />` without the tier guard, which moves into the component)
- Modify: `src/App.module.css` (remove the `.grain` rule, which moves to `Grain.module.css`)
- Modify: `src/components/list/ScheduleList.tsx` (Task 29: give list rows the entrance stagger the grid bodies already apply), `src/components/list/ScheduleList.module.css` (sticky group header on `--surface-glass` with the `-webkit-` blur prefix)
- Modify: `src/components/ui/Chip.module.css`, `src/components/shell/DayTabs.module.css`, `src/components/shell/ViewSwitcher.module.css`, `src/components/shell/FilterChips.module.css` (44 px coarse-pointer targets)
- Modify: `src/components/ui/Popover.module.css` (Task 22), `src/components/shell/Toasts.module.css`, `src/components/shell/TopBar.module.css` (Task 23), `src/components/filters/Facet.module.css`, `src/components/filters/FiltersPanel.module.css` (Task 30), `src/components/detail/SpeakerBlock.module.css`, `src/components/detail/SameTimeList.module.css`, `src/components/detail/DetailSheet.module.css` (Task 32): 44 px coarse-pointer targets on the remaining small controls
- Modify (only if Step 5 finds a sticky rule without the glass declarations; none is expected): `src/components/grid/TimelineBody.module.css`, `src/components/grid/SlotBody.module.css`
- Modify: `package.json` (`tokens` script, added to `check`)
- Test: `src/test/motion.test.tsx`

**Interfaces:**
- Consumes:
  - `useTier(): "wide" | "medium" | "mobile"` and `prefersReducedMotion(): boolean` from `src/state/useMediaQuery.ts` (Task 22). Both read `matchMedia`; the jsdom stub from `src/test/setup.ts` never matches, so `prefersReducedMotion()` is `false` in tests.
  - `SessionCard({ session, compact?, showLocation, style?, variant })` from Task 25, as written: the `<article>` root carries `data-session-id`, `data-live=<LiveState>` (`"past" | "live" | "soon" | "upcoming"`, computed into the local `state` variable) and the incoming `style` prop spread into its inline style. `SessionCard.module.css` already runs `cardIn` (180 ms, 6 px rise, `backwards` fill) on every card and `livePulse` (2 s outline) on `.card[data-live="live"]`, both inside `@media (prefers-reduced-motion: no-preference)`; a caller's inline `animationDelay` staggers the entrance.
  - `TimelineBody` and `SlotBody` (Tasks 26/27), as written: each numbers its cards in DOM order and passes `style={{ …, animationDelay: enterDelay(order++) }}` where `enterDelay(n)` is `` `${Math.min(n * 12, 240)}ms` ``, skipped when `prefersReducedMotion()`.
  - `ScheduleList({ groups })` from Task 29 (rows are `<li className={styles.row}><SessionCard session={s} showLocation variant="row" /></li>`); `ListGroup` from `src/state/derive.ts`.
  - `GridHarness()` from `src/test/gridHarness.tsx` (Task 26): reads the store like `App` and renders `ScheduleGrid`; it reads the schedule through `useData()`.
  - Tokens from `src/styles/tokens.css` (Task 22): `--bg`, `--surface-glass`, `--accent`, `--glow-opacity`, `--grain-opacity`, `--border`, `--text`, `--text-muted`, `--on-accent`, `--surface-1`, `--surface-2`.
  - Tests: `makeData`, `makeSession` from `src/test/fixtures/build.ts`; `DataProvider`, `buildAppData` from `src/data/index.tsx` through a local `renderWithData(ui)` helper as in Task 33.
- Produces:
  - `Grain()` (named export, no props): the fixed full-page `feTurbulence` overlay; renders `null` when `useTier()` is `"mobile"`; the `<svg>` carries `data-grain=""` and `aria-hidden="true"`; its opacity is `var(--grain-opacity)`.
  - `ScheduleList` rows get the same inline `animationDelay` stagger as grid cards: 12 ms per row in DOM order, counted across all groups, capped at 240 ms, absent under reduced motion. Props and the DOM contract of Task 29 (`LIVE_GROUP_ID`, sections, headings, list items) do not change.
  - `scripts/check-tokens.mjs`: exits 1 and lists `file:line: --name` for every `var(--name)` in a CSS file under `src/` whose name is neither declared in `src/styles/tokens.css` nor declared anywhere in `src/` (a `--name:` declaration in a CSS file, or a `"--name"` string in a `.ts`/`.tsx` style object); prints `tokens ok: …` otherwise. `npm run tokens` runs it; `npm run check` includes it.

Spec §8 items already delivered by Tasks 22–29 and only verified here: the radial orange glow (`TopBar.module.css` `.bar::before` with `var(--glow-opacity)`, 0.3 dark / 0.12 light in `tokens.css`), `backdrop-filter: blur(12px)` on the top bar, the bottom bar and the grid's sticky corner, headers and rail, the star pop keyframes (`Star.module.css` `starPop`, 250 ms spring), the live-chip pulse, the card entrance with its 12 ms stagger (`SessionCard.module.css` `cardIn` plus the inline delay from the grid bodies), the live card outline pulse (`livePulse`) and the 160 ms crossfades (`App.module.css` `viewFade` keyed on `${view}:${day}:${resolved.mode}`, `ScheduleGrid.module.css` `gridFade`, `PlanView.module.css` `planFade`). Deliberate simplification, recorded here so the spec can be amended: there is no per-card exit animation (spec §8 "exit is the reverse over 120 ms"). A card that leaves the rendered set unmounts immediately; the container crossfades cover day, view and mode changes, and a filter change simply removes the cards. Nothing later in the plan implements exits.

Steps:

- [ ] **Step 1: Write the failing test**

Create `src/test/motion.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

const tierState = vi.hoisted(() => ({ tier: "wide" as "wide" | "medium" | "mobile" }));

vi.mock("../state/useMediaQuery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../state/useMediaQuery")>();
  return { ...actual, useTier: () => tierState.tier };
});

import { makeData, makeSession } from "./fixtures/build";
import { DataProvider, buildAppData } from "../data/index";
import { Grain } from "../components/shell/Grain";
import { ScheduleList } from "../components/list/ScheduleList";
import type { ListGroup } from "../state/derive";
import { useStore, defaultSettings } from "../state/store";
import { EMPTY_FILTERS } from "../domain/filters";
import { GridHarness } from "./gridHarness";

// 22 back-to-back half-hour sessions in one room: enough to cross the 240 ms stagger cap (20 × 12 ms).
const sessions = Array.from({ length: 22 }, (_, i) =>
  makeSession({
    id: `${i + 1}:pt`,
    eventId: i + 1,
    day: "pt",
    title: `Sesja ${i + 1}`,
    start: 540 + i * 30,
    end: 570 + i * 30,
    locationIds: [233],
  }),
);
const fixture = makeData(sessions);
const appData = buildAppData(fixture);

/** Every component under test reads the schedule through `useData()`, so the tree is always mounted inside the provider. */
function renderWithData(ui: ReactNode) {
  return render(<DataProvider value={appData}>{ui}</DataProvider>);
}

/** Inline animation-delay of every card, in DOM order. */
function delays(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>("article[data-session-id]")).map((a) => a.style.animationDelay);
}

beforeEach(() => {
  tierState.tier = "wide";
  useStore.setState({
    day: "pt",
    view: "list",
    filters: EMPTY_FILTERS,
    // the synthetic set is slot-distinguishable, so the timeline is forced for the grid case
    settings: { ...defaultSettings(1440), timeMode: "timeline" },
    favourites: [],
    previewPlan: null,
    sharedPlan: null,
    selectedSessionId: null,
    openSheet: null,
    toasts: [],
    copyText: null,
    // Thursday: not the fixture's day, so no now line and no first-render scroll
    now: new Date(2026, 8, 3, 10, 0),
  });
});

describe("Grain", () => {
  it("renders the feTurbulence overlay at tier wide, hidden from assistive tech", () => {
    const { container } = render(<Grain />);
    const svg = container.querySelector("svg[data-grain]");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("feTurbulence")).not.toBeNull();
  });

  it("renders at tier medium and nothing at tier mobile", () => {
    tierState.tier = "medium";
    const medium = render(<Grain />);
    expect(medium.container.querySelector("svg[data-grain]")).not.toBeNull();
    medium.unmount();
    tierState.tier = "mobile";
    const mobile = render(<Grain />);
    expect(mobile.container.innerHTML).toBe("");
  });
});

describe("entrance stagger", () => {
  it("delays grid cards 12 ms apart in DOM order and caps the delay at 240 ms", () => {
    renderWithData(<GridHarness />);
    const got = delays();
    expect(got).toHaveLength(22);
    expect(got.slice(0, 3)).toEqual(["0ms", "12ms", "24ms"]);
    expect(got[20]).toBe("240ms");
    expect(got[21]).toBe("240ms");
  });

  it("delays list rows the same way, counting across groups", () => {
    const groups: ListGroup[] = [
      { key: "540", label: "09:00", sessions: sessions.slice(0, 2), total: 2, parallel: 1 },
      { key: "600", label: "10:00", sessions: sessions.slice(2, 4), total: 2, parallel: 1 },
    ];
    renderWithData(<ScheduleList groups={groups} />);
    expect(delays()).toEqual(["0ms", "12ms", "24ms", "36ms"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /Users/tom/Projects/conference-melt && npx vitest run src/test/motion.test.tsx`

Expected: the file fails to load with `Error: Failed to resolve import "../components/shell/Grain" from "src/test/motion.test.tsx"`; no test runs.

- [ ] **Step 3: Extract `Grain` into its own component**

Create `src/components/shell/Grain.tsx`:

```tsx
import { useTier } from "../../state/useMediaQuery";
import styles from "./Grain.module.css";

/** Spec §8: fixed full-page feTurbulence grain at 4 % opacity (`--grain-opacity`), skipped under 700 px for performance. */
export function Grain() {
  const tier = useTier();
  if (tier === "mobile") return null;
  return (
    <svg className={styles.grain} data-grain="" aria-hidden="true" focusable="false">
      <filter id="app-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#app-grain)" />
    </svg>
  );
}
```

Create `src/components/shell/Grain.module.css`:

```css
.grain {
  position: fixed;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  opacity: var(--grain-opacity);
  pointer-events: none;
}
```

In `src/App.tsx` (Task 23 step 13) make three edits. Delete this block in full:

```tsx
/** Spec §8: fixed full-page feTurbulence grain at 4 % opacity, skipped on mobile by the caller. */
function Grain() {
  return (
    <svg className={styles.grain} aria-hidden="true" focusable="false">
      <filter id="app-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#app-grain)" />
    </svg>
  );
}
```

Add the import directly after the `useTier` import, so the two lines read:

```tsx
import { useTier } from "./state/useMediaQuery";
import { Grain } from "./components/shell/Grain";
```

Replace the guarded element

```tsx
      {tier !== "mobile" && <Grain />}
```

with

```tsx
      <Grain />
```

The crossfade wrapper `<div key={`${view}:${day}:${resolved.mode}`} className={styles.fade}>` already keys on view, day and mode; leave it as it is.

In `src/App.module.css` delete this rule in full (the class now lives in `Grain.module.css`); keep `.fade`, `viewFade` and the rest unchanged:

```css
.grain {
  position: fixed;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  opacity: 0.04;
  pointer-events: none;
}
```

- [ ] **Step 4: Stagger the list rows like the grid cards**

`SessionCard.module.css` already animates every card with `cardIn` and pulses live cards; the grid bodies already pass the 12 ms stagger inline. Only the list still mounts all its rows at once. In `src/components/list/ScheduleList.tsx` (Task 29) make four edits.

Add the import directly after the store import, so the two lines read:

```tsx
import { useStore } from "../../state/store";
import { prefersReducedMotion } from "../../state/useMediaQuery";
```

Directly after

```tsx
export const LIVE_GROUP_ID = "list-live";
```

add:

```tsx

/** Spec §8: entrance stagger of 12 ms per row, capped at 240 ms (the same numbers as the grid bodies). */
const STAGGER_MS = 12;
const STAGGER_MAX_MS = 240;

function enterDelay(order: number): string {
  return `${Math.min(order * STAGGER_MS, STAGGER_MAX_MS)}ms`;
}
```

Directly after

```tsx
  if (groups.length === 0) return null;
```

add:

```tsx

  // Rows are numbered in DOM order across every group for the entrance stagger.
  const animate = !prefersReducedMotion();
  let order = 0;
```

Replace the row map

```tsx
              {g.sessions.map((s) => (
                <li key={s.id} className={styles.row}>
                  <SessionCard session={s} showLocation variant="row" />
                </li>
              ))}
```

with

```tsx
              {g.sessions.map((s) => {
                const delay = animate ? enterDelay(order++) : undefined;
                return (
                  <li key={s.id} className={styles.row}>
                    <SessionCard
                      session={s}
                      showLocation
                      variant="row"
                      style={delay === undefined ? undefined : { animationDelay: delay }}
                    />
                  </li>
                );
              })}
```

`SessionCard` derives `data-size` from `style.height` alone, so a style holding only `animationDelay` keeps the row at `"md"`.

In `src/components/list/ScheduleList.module.css` (Task 29) replace the `.header` rule

```css
.header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 8px 0;
  background: color-mix(in oklch, var(--bg) 82%, transparent);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
```

with

```css
.header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 8px 0;
  background: var(--surface-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}
```

so the list's sticky headers use the same glass token as the grid's sticky corner, headers and rail, and Safari gets the prefixed blur.

- [ ] **Step 5: Verify the glow, the crossfade and the glass headers**

Run: `cd /Users/tom/Projects/conference-melt && grep -n "glow-opacity" src/styles/tokens.css src/components/shell/TopBar.module.css`

Expected: `tokens.css` shows `--glow-opacity: 0.3;` on `:root` and `--glow-opacity: 0.12;` under `[data-theme="light"]`; `TopBar.module.css` shows the `.bar::before` radial gradient using `var(--glow-opacity)`. If the gradient line is missing, add this rule after `.bar`:

```css
.bar::before {
  content: "";
  position: absolute;
  inset: -40px 0 0;
  z-index: -1;
  pointer-events: none;
  background: radial-gradient(60% 140% at 18% 0%, oklch(70% 0.2 45 / var(--glow-opacity)), transparent 70%);
}
```

Run: `grep -n "sticky" -A 12 src/components/grid/*.module.css | grep -n "surface-glass\|backdrop-filter\|sticky"`

Expected: five sticky rules carry `background: var(--surface-glass);`, `backdrop-filter: blur(12px);` and `-webkit-backdrop-filter: blur(12px);` inside their block: `.corner` and `.header` in `TimelineBody.module.css`, `.corner`, `.header` and `.railCell` in `SlotBody.module.css`. The sixth sticky rule, `.rail` in `TimelineBody.module.css`, holds only `left: 0` and `z-index: 2`: the same element also carries `TimeRail.module.css`'s `.rail`, which paints the glass and both blur declarations. Nothing to change when the five rules and `TimeRail.module.css` show the three declarations; add the three declarations to any of the five that lacks them.

Run: `grep -n "viewFade\|prefers-reduced-motion" src/App.module.css`

Expected: the `.fade` animation sits inside `@media (prefers-reduced-motion: no-preference)` and `@keyframes viewFade` exists (Task 23). Nothing to change when both lines appear.

- [ ] **Step 6: 44 px targets on coarse pointers**

In `src/components/ui/Chip.module.css` (Task 22) replace the block at the end of the file

```css
@media (pointer: coarse) {
  .chip {
    height: 36px;
  }

  .remove {
    width: 32px;
    height: 32px;
  }
}
```

with

```css
@media (pointer: coarse) {
  .chip {
    min-height: 44px;
  }

  .remove {
    width: 44px;
    height: 44px;
  }
}
```

Append to `src/components/shell/DayTabs.module.css` (Task 23; `.tab` is the day button, 36 px tall by default, and `min-height` wins over its `height`):

```css

@media (pointer: coarse) {
  .tab {
    min-height: 44px;
  }
}
```

Append to `src/components/shell/ViewSwitcher.module.css` (Task 23; `.item` is the view link, 30 px minimum by default):

```css

@media (pointer: coarse) {
  .item {
    min-height: 44px;
  }
}
```

In `src/components/shell/FilterChips.module.css` (Task 23) replace the block at the end of the file

```css
@media (pointer: coarse) {
  .clear {
    min-height: 36px;
  }
}
```

with

```css
@media (pointer: coarse) {
  .clear {
    min-height: 44px;
  }
}
```

In `src/components/ui/Popover.module.css` (Task 22) the close button is 32 px square:

```css
.close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  color: var(--text-muted);
}
```

Append to the end of the file:

```css

@media (pointer: coarse) {
  .close {
    width: 44px;
    height: 44px;
  }
}
```

In `src/components/shell/Toasts.module.css` (Task 23) the action button is 32 px tall and the close button 32 px square:

```css
.action {
  flex: none;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 13px;
  font-weight: 600;
}
```

```css
.close {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  color: var(--text-muted);
}
```

Append to the end of the file (`min-height` wins over `.action`'s `height`):

```css

@media (pointer: coarse) {
  .action {
    min-height: 44px;
  }

  .close {
    width: 44px;
    height: 44px;
  }
}
```

In `src/components/shell/TopBar.module.css` (Task 23) the search field is 36 px tall and its close button 28 px square:

```css
.search {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 1 260px;
  min-width: 120px;
  height: 36px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-muted);
}
```

```css
.inputClose {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  color: var(--text-muted);
}
```

Append to the end of the file (the field grows to 44 px so the button fits inside it; the negative margin lets the button reach the field's rounded edge across the 10 px padding):

```css

@media (pointer: coarse) {
  .search {
    min-height: 44px;
  }

  .inputClose {
    width: 44px;
    height: 44px;
    margin-right: -10px;
  }
}
```

In `src/components/filters/Facet.module.css` (Task 30) the per-facet clear button is text-sized:

```css
.clear {
  padding: 4px 8px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
```

Replace the block at the end of the file

```css
@media (pointer: coarse) {
  .option {
    min-height: 44px;
  }
}
```

with

```css
@media (pointer: coarse) {
  .option {
    min-height: 44px;
  }

  .clear {
    min-height: 44px;
    padding: 0 12px;
  }
}
```

In `src/components/filters/FiltersPanel.module.css` (Task 30) the global clear button is padded to roughly 30 px:

```css
.clearAll {
  margin-left: auto;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
```

Append to the end of the file:

```css

@media (pointer: coarse) {
  .clearAll {
    min-height: 44px;
    padding: 0 14px;
  }
}
```

In `src/components/detail/SpeakerBlock.module.css` (Task 32) the bio disclosure is a bare text button:

```css
.bioToggle {
  align-self: flex-start;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--accent);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
```

Append to the end of the file:

```css

@media (pointer: coarse) {
  .bioToggle {
    min-height: 44px;
  }
}
```

In `src/components/detail/SameTimeList.module.css` (Task 32) each row's main button is sized by its two lines of text:

```css
.main {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 10px;
  row-gap: 2px;
  padding: 8px 48px 8px 10px;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
```

Append to the end of the file:

```css

@media (pointer: coarse) {
  .main {
    min-height: 44px;
  }
}
```

In `src/components/detail/DetailSheet.module.css` (Task 32) the festival-page link is an inline anchor:

```css
.source {
  align-self: flex-start;
  font-size: 14px;
  color: var(--accent);
}
```

Replace the block at the end of the file

```css
@media (pointer: coarse) {
  .signup,
  .planAdd,
  .planRemove {
    min-height: 44px;
  }
}
```

with (`min-height` only applies to a non-inline box, hence `inline-flex`):

```css
@media (pointer: coarse) {
  .signup,
  .planAdd,
  .planRemove {
    min-height: 44px;
  }

  .source {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
}
```

`Star.module.css`, `Segmented.module.css`, `Toggle.module.css`, `Sheet.module.css`, `Slider.module.css`, `BottomBar.module.css`, `LiveChip.module.css`, `ShareBanner.module.css`, `SessionCard.module.css` (chips), `Strips.module.css` and `ScheduleGrid.module.css` already reserve 44 px (Tasks 22–28); the plan components did so in Task 33; `Facet.module.css` (options) and `DetailSheet.module.css` (signup and plan buttons) already had their coarse blocks from Tasks 30 and 32 and only gain the extra selectors above.

- [ ] **Step 7: Write the token check script and wire it into `npm run check`**

Create `scripts/check-tokens.mjs`:

```js
#!/usr/bin/env node
/*
 * Light-theme guard (spec §8): every `var(--name)` referenced from a CSS file under src/
 * must be a token declared in src/styles/tokens.css, or a custom property declared
 * somewhere in src/ (a `--name:` declaration in any CSS file, or a "--name" string used
 * as a key in a TSX/TS style object, such as TimelineBody's `--half-hour`). Anything else
 * is a typo or a leftover from another naming scheme and fails the build.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "src");
const TOKENS = join(SRC, "styles", "tokens.css");

const DECLARED = /(--[A-Za-z0-9_-]+)\s*:/g;
const QUOTED = /["'](--[A-Za-z0-9_-]+)["']/g;
const REFERENCED = /var\(\s*(--[A-Za-z0-9_-]+)/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function names(text, re) {
  return [...text.matchAll(re)].map((m) => m[1]);
}

const files = walk(SRC);
const cssFiles = files.filter((f) => f.endsWith(".css"));
const codeFiles = files.filter((f) => /\.(tsx?|jsx?)$/.test(f));

const tokens = new Set(names(readFileSync(TOKENS, "utf8"), DECLARED));
const declared = new Set(tokens);
for (const f of cssFiles) for (const n of names(readFileSync(f, "utf8"), DECLARED)) declared.add(n);
for (const f of codeFiles) for (const n of names(readFileSync(f, "utf8"), QUOTED)) declared.add(n);

const problems = [];
let references = 0;
for (const f of cssFiles) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const name of names(line, REFERENCED)) {
      references += 1;
      if (!declared.has(name)) problems.push(`${relative(ROOT, f)}:${i + 1}: ${name} is not a token and is declared nowhere`);
    }
  });
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} unknown custom propert${problems.length === 1 ? "y" : "ies"}; tokens live in src/styles/tokens.css`);
  process.exit(1);
}

console.log(`tokens ok: ${references} var() references across ${cssFiles.length} CSS files, ${tokens.size} tokens`);
```

In `package.json` the `scripts` block gains `tokens` and `check` runs it right after the type check:

```json
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json",
    "tokens": "node scripts/check-tokens.mjs",
    "fetch": "tsx scripts/fetch-schedule.ts",
    "size": "node scripts/check-size.mjs",
    "check": "npm run typecheck && npm run tokens && npm test && npm run build && npm run size"
```

- [ ] **Step 8: Run the token check and fix any offender**

Run: `cd /Users/tom/Projects/conference-melt && node scripts/check-tokens.mjs`

Expected on a tree built from Tasks 22–33 as written: exit code 0 and one line `tokens ok: <N> var() references across <M> CSS files, 42 tokens`. The 42 are the names declared on `:root` in `tokens.css` (the `[data-theme="light"]` block only redeclares a subset): `--bg`, `--surface-1`, `--surface-2`, `--surface-glass`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-hover`, `--on-accent`, `--success`, `--danger`, `--warning`, `--hue-l`, `--hue-c`, `--chroma-neutral`, `--hue-prelekcja`, `--hue-prelekcja-z-sesja`, `--hue-warsztaty`, `--hue-fotospacer`, `--hue-fotogra`, `--hue-playground`, `--hue-strefa-sprzetu`, `--hue-teleobiektywy`, `--hue-ogolne`, `--hue-other`, `--text-base`, `--text-card`, `--text-min`, `--radius-card`, `--radius-sheet`, `--radius-chip`, `--shadow-1`, `--shadow-2`, `--font-display`, `--font-body`, `--rail-width`, `--topbar-height`, `--bottombar-height`, `--sidebar-width`, `--glow-opacity`, `--grain-opacity`. Component-local properties (`--card-h`, `--card-c`, `--edge` in `SessionCard.module.css` and `ContinuationStub.module.css`, `--half-hour` set by `TimelineBody.tsx`) pass because they are declared in `src/`.

If the script exits 1 instead, every line names a real typo or a spec prose name used where a token is meant: open the file at that line, replace the name with the intended token from the list above, and rerun until the `tokens ok:` line appears.

- [ ] **Step 9: Light-theme pass**

Run: `cd /Users/tom/Projects/conference-melt && find src/components -name "*.module.css" | sort`

Expected: one file per component of Tasks 22–33 (`ui/*`, `shell/*` including `Grain.module.css`, `grid/*`, `list/ScheduleList.module.css`, `filters/*`, `settings/*`, `detail/*`, `plan/*`). Every file in that list was covered by Step 8; none hard-codes a colour other than the `oklch(0% 0 0 / …)` backdrop and shadow blacks, the `oklch(20% 0.02 85)` conflict-badge ink in `SessionCard.module.css`, `#ff6600` in `Burst.tsx` and the print stylesheet.

Run: `npm run build` and open `dist/index.html`. Click the theme toggle until it shows the sun (light). Check: page ground is near-white, cards are white on a warm off-white, the top-bar glow is faint (0.12), muted text is readable, the conflict pill is a dark amber on light, the live pulse outline is the darker light-theme accent. Switch back to dark and confirm the glow returns to 0.3 opacity. Under macOS "Reduce motion" (System Settings → Accessibility → Display) reload: cards appear without the stagger, live cards do not pulse, day switches do not fade.

- [ ] **Step 10: Run the tests and the type check**

Run: `npx vitest run src/test/motion.test.tsx`

Expected: 4 tests pass (2 Grain, 2 entrance stagger).

Run: `npx vitest run src/test/ScheduleList.test.tsx src/test/shell.test.tsx`

Expected: still green. The list rows only gained an inline `animation-delay`; `shell.test.tsx`'s `App` case renders `Grain`, which now reads the tier itself.

Run: `npm run typecheck`

Expected: no errors.

Run: `npm test`

Expected: the whole suite is green, including `src/test/PlanView.test.tsx`'s `App` cases.

- [ ] **Step 11: Commit**

```bash
cd /Users/tom/Projects/conference-melt && git add src/components/shell/Grain.tsx src/components/shell/Grain.module.css scripts/check-tokens.mjs package.json src/App.tsx src/App.module.css src/components/list/ScheduleList.tsx src/components/list/ScheduleList.module.css src/components/ui/Chip.module.css src/components/shell/DayTabs.module.css src/components/shell/ViewSwitcher.module.css src/components/shell/FilterChips.module.css src/components/ui/Popover.module.css src/components/shell/Toasts.module.css src/components/shell/TopBar.module.css src/components/filters/Facet.module.css src/components/filters/FiltersPanel.module.css src/components/detail/SpeakerBlock.module.css src/components/detail/SameTimeList.module.css src/components/detail/DetailSheet.module.css src/test/motion.test.tsx && git commit -F - <<'EOF'
feat(ui): add grain, list row stagger, coarse targets and a token check

Grain moves to its own tier-aware component; list rows get the same
12 ms entrance stagger (240 ms cap) the grid bodies already apply and
the list's sticky headers use the surface-glass token; chips, day tabs,
the view switcher, every clear button, the popover, toast and search
close buttons, the toast action, the bio toggle, same-time rows and the
festival link reserve 44 px on coarse pointers; scripts/check-tokens.mjs
fails on custom properties missing from tokens.css and runs inside
npm run check.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2
EOF
```

---

### Task 35: Build and verification

**Files:**
- Create: `README.md`
- Modify: nothing else; this task runs the checks, records the manual verification and commits the README.
- Test: none new; `npm run check` runs the full suite.

**Interfaces:**
- Consumes: `npm run check` (`typecheck`, `tokens`, `test`, `build`, `size` from Tasks 1 and 34), `scripts/check-size.mjs` (Task 1, fails when `dist/index.html` exceeds 1.5 MB = 1 572 864 bytes), `dist/index.html` from `vite build` with `vite-plugin-singlefile`, the `?now=` override from `src/domain/now.ts` (`resolveNow` / `createClock`), the hash format `#d=<day>&v=<view>&plan=<encoded>` from `src/state/hash.ts` and `src/domain/share.ts`.
- Produces: `README.md` and the final commit. Nothing later depends on this task.

Steps:

- [ ] **Step 1: Run the full check**

Run: `npm run check`

Expected, in order:
1. `tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json` prints nothing and exits 0.
2. `node scripts/check-tokens.mjs` prints one line starting with `tokens ok:`.
3. `vitest run` ends with `Test Files  <N> passed (<N>)` and `Tests  <M> passed (<M>)`, no `failed`, no `skipped`; the list includes the domain tests spec §10 names (`time`, `slots`, `overlaps`, `normalize`, `filters`, `share`, `ics`, `text`, `now`, `plan`), every `scripts/__tests__` file, the state tests (`hash`, `theme`, `clipboard`, `store`, `boot`, `derive`), `gridLayout.test.ts`, the component tests (`ui`, `shell`, the grid tests of Tasks 25–28, `ScheduleList`, `FiltersPanel`, `SettingsPanel`, `DetailSheet`, `PlanView`, `motion`) and whatever further test files earlier tasks added. No `validateDOMNesting` warning appears in the output (spec §10).
4. `vite build` prints the single output line for `dist/index.html` with its size in kB and `✓ built in …`.
5. `node scripts/check-size.mjs` prints the size of `dist/index.html` and the 1 572 864-byte limit and exits 0.

If any step fails, fix the cause in the task that owns the file and rerun `npm run check` from the top; do not continue with a red check.

- [ ] **Step 2: Print the bundle size**

Run: `cd /Users/tom/Projects/conference-melt && wc -c dist/index.html && ls -la dist/`

Expected: `wc -c` prints a number below `1572864` (with the ~400 KB `schedule.json` inlined, React, Zustand and lucide-react the file lands well under 1 MB); `dist/` contains only `index.html` (the single-file plugin inlines every script and stylesheet; speaker photos are hotlinked, not bundled).

- [ ] **Step 3: Write `README.md`**

Create `README.md` (the outer fence below uses four backticks only because the file itself contains fenced blocks; the file starts at `# ŚwiatłoSiła`):

````markdown
# ŚwiatłoSiła 2026 · harmonogram

Interaktywna przeglądarka programu festiwalu [ŚwiatłoSiła 2026](https://swiatlosila.pl/harmonogram-2026/): siatka z wykrywaniem slotów czasowych, lista, osobisty plan z wykrywaniem konfliktów, filtry, wyszukiwarka i tryb ciemny/jasny. Wszystko działa w przeglądarce, bez serwera, kont i statystyk. Dane to migawka pobrana skryptem, nie synchronizacja na żywo.

## Skrypty npm

| polecenie | co robi |
|---|---|
| `npm run dev` | serwer deweloperski Vite z przeładowaniem na żywo |
| `npm run build` | buduje jeden samowystarczalny plik `dist/index.html` |
| `npm run preview` | serwuje zbudowany plik lokalnie |
| `npm test` | uruchamia wszystkie testy Vitest raz |
| `npm run test:watch` | testy w trybie ciągłym |
| `npm run typecheck` | sprawdza typy TypeScript (aplikacja i skrypty) |
| `npm run tokens` | sprawdza, czy każde `var(--nazwa)` w CSS jest zdefiniowane w `src/styles/tokens.css` |
| `npm run fetch` | pobiera aktualny program z API festiwalu do `src/data/schedule.json` |
| `npm run size` | sprawdza, czy `dist/index.html` mieści się w 1,5 MB |
| `npm run check` | typecheck, tokens, testy, build i rozmiar, jedno po drugim |

Wymagany Node 20 lub nowszy.

## Odświeżanie danych

```sh
npm run fetch
```

Skrypt pobiera wydarzenia, taksonomie i prelegentów z WordPress REST API strony festiwalu, normalizuje je (godziny z treści, prelegenci z linków, sale, statusy zapisów, strefy całodniowe) i zapisuje `src/data/schedule.json` w stałej kolejności, więc kolejne uruchomienia dają małe diffy. Na końcu wypisuje podsumowanie: liczbę wydarzeń na dzień i ostrzeżenia (wydarzenia bez godziny, nierozpoznani prelegenci, sale spoza mapy skrótów itd.). Przy błędzie sieci nic nie jest zapisywane.

```sh
npm run fetch -- --fixtures
```

Dodatkowo zapisuje fixture'y testowe `src/test/fixtures/slot-sets.json` i `src/test/fixtures/fri-lectures.json`. Testy wykrywania slotów są przypięte do tych plików; jeśli po odświeżeniu zmienią się liczby w tabeli kalibracyjnej w specyfikacji (`docs/superpowers/specs/2026-09-03-schedule-viewer-design.md`, sekcja 5.2), zaktualizuj tabelę w tym samym commicie.

Po `npm run fetch` uruchom `npm run check`, a potem `npm run build`, żeby nowy program trafił do `dist/index.html`.

## Otwieranie z dysku

`dist/index.html` jest jednym plikiem: skrypty, style i dane są w nim osadzone. Wystarczy otworzyć go w Chrome, Safari lub Firefoksie z dysku (`file://`). Zdjęcia prelegentów są ładowane ze strony festiwalu, więc bez internetu pokazują się inicjały.

Ulubione, ustawienia widoku i ostatni widok zapisują się w `localStorage` przeglądarki pod kluczem `swiatlosila-2026:v1`. Dzień i widok są też w adresie (`#d=pt&v=grid`), więc zakładki działają.

## Podgląd innej godziny

Dodaj `?now=` do adresu, np.:

```
dist/index.html?now=2026-09-04T10:30
```

Aplikacja zachowa się tak, jakby był piątek 4 września, 10:30 czasu lokalnego: pokaże chip „Teraz”, linię bieżącej godziny, karty „trwa”, „wkrótce” i wyszarzone minione. Zegar od tej chwili idzie dalej. Wartość bez strefy czasowej jest lokalna; sama data (`?now=2026-09-05`) oznacza północ lokalną. Niepoprawna wartość jest ignorowana.

## Udostępnianie planu

„Udostępnij” w widoku Mój plan kopiuje link `#d=<dzień>&v=plan&plan=<kod>` z całym planem. Link działa tylko wtedy, gdy odbiorca otworzy tę samą aplikację pod tym samym adresem. Z pliku otwartego z dysku powstaje adres `file://…`, który zadziała wyłącznie u osób z tym samym plikiem w tej samej ścieżce. Aby dzielić się planem, opublikuj `dist/index.html` na dowolnym hostingu statycznym pod adresem http(s), na przykład GitHub Pages, Netlify albo zwykły katalog na serwerze WWW. Nie jest potrzebne nic poza jednym plikiem.

---

## English

A client-side schedule viewer for the ŚwiatłoSiła 2026 photography festival: a grid with automatic time-slot detection (a slot table when the visible sessions share regular start times, a proportional timeline otherwise), a list view, a personal plan with conflict detection, facets, search and dark/light themes. No server, no accounts, no analytics; the data is a snapshot.

- `npm run dev`, `npm run build`, `npm run preview`, `npm test`, `npm run test:watch`, `npm run typecheck`, `npm run tokens`, `npm run size`, `npm run check` (all of the above in sequence). Node 20+.
- `npm run fetch` refreshes `src/data/schedule.json` from the festival's WordPress REST API and prints per-day counts and warnings; `npm run fetch -- --fixtures` also regenerates the committed test fixtures.
- `dist/index.html` is a single self-contained file that opens straight from disk. Favourites and settings persist in `localStorage`; day and view live in the URL hash.
- Append `?now=2026-09-04T10:30` to preview the live states at a chosen local time.
- Share links encode the whole plan in the hash and need the app to be hosted on an http(s) URL; a `file://` link only works for people with the same file at the same path.
````

- [ ] **Step 4: Manual verification, desktop Chrome at 1440 px**

Open `dist/index.html` in Chrome directly from disk (File → Open File) with `?now=2026-09-04T10:30` appended to the address, window 1440 px wide. Check, in this order:

1. Top bar: burst mark and "ŚwiatłoSiła 2026", day tabs with Piątek selected, Siatka / Lista / Mój plan switcher, search box, "Widok", theme toggle, and the live chip "Teraz 10:30 · trwa N" where N ≥ 1. The faint orange glow sits behind the top bar.
2. Sidebar (wide tier): Typ, Miejsce (grouped by Poziom), Tematyka, Marka, Zapisy with counts; "Ukryj strefy całodniowe" and "Tylko ulubione" toggles.
3. Grid, Friday, no filters: the "Całodniowe (10)" strip above the grid, one column per room in `Location.order`, a timeline (not a slot table) with hour labels on the sticky rail, the now line at 10:30 with a chip in the rail, cards for 09:30–11:00 sessions outlined with a "Teraz" pill, cards before 10:30 at 0.6 opacity. Scroll horizontally inside the grid: the "Stoiska · Plenum" column is wider (8 lanes) and no two cards overlap.
4. Open "Widok": the time-mode hint reads "Auto (oś czasu)". Set Kolumny to "Bez grupowania": one column with 17 lanes wide enough to scroll; cards still never overlap. Set it back to "Sale".
5. Tick Typ → Prelekcja and switch to Sobota. The grid becomes a slot table with 8 rail rows (09:15 … the last afternoon slot), "Auto (sloty)" in the settings hint, one or two cards per cell, no stubs under the location axis. Untick Prelekcja: the timeline returns.
6. Settings → Tryb czasu → Sloty on the unfiltered Friday: a forced slot table; scroll every row and confirm no card is painted over another (continuation stubs and "+N w trakcie" appear instead). Then Oś czasu: the timeline with lanes. Back to Auto.
7. Search "swiatlo": only matching cards remain, the columns narrow to those with results, the rail and row set do not move. Clear the search.
8. Star three overlapping Friday sessions on cards: the star fills, the "Mój plan" badge counts 3, the starred cards show a conflict triangle with a number. Reload: the badge still reads 3.
9. Click a card: the detail side sheet (420 px) opens with type chip, title, "Piątek, 4 września", time and duration, venue · Poziom · room, theme and brand chips, speaker photo with "Pokaż bio", the signup button, "Usuń z planu" (for a starred card), "W tym samym czasie" with stars, "Zobacz na stronie festiwalu". Escape closes it and focus returns to the card.
10. Lista: groups with "N wydarzeń" and "M równolegle", rows with time, colour dot, title, location, avatars, star; clicking "Teraz" in the top bar scrolls to the first live group.
11. Mój plan: summary "Pt 3", an amber "N konflikt…" pill, "Następne: … za N min", the Siatka / Lista toggle, "Kopiuj jako tekst", "Udostępnij", "Pobierz .ics", "Drukuj", the conflicts panel with pairs side by side and "Usuń z planu" on each side. Remove one: toast "Usunięto z planu: …" with "Cofnij"; click Cofnij and the pair returns. "Kopiuj jako tekst" shows "Skopiowano plan jako tekst"; "Udostępnij" from disk shows the long file: toast; "Pobierz .ics" downloads `swiatlosila-2026-plan.ics` that imports into Calendar with floating local times; "Drukuj" opens the print dialog whose preview shows only "Mój plan · ŚwiatłoSiła 2026" with one heading per day and the lines.
12. Paste the copied share link into a new tab: the banner "Ktoś udostępnił Ci plan: 3 wydarzeń" with Wczytaj / Tylko podgląd / close; "Tylko podgląd" opens the plan view with "Podgląd udostępnionego planu · nie zapisano", no stars anywhere, no "Udostępnij", no "Usuń z planu"; "Zamknij podgląd" restores the normal view.
13. Theme toggle: dark → light → system; in light the ground is near-white and everything stays readable (Task 34 step 10).
14. Console: no errors, no warnings.

- [ ] **Step 5: Manual verification, desktop Safari at 1440 px**

Repeat Step 4 items 1, 3, 5, 6, 9, 11 and 13 in Safari with the same file and `?now=`. Additionally confirm the `backdrop-filter` blur on the top bar and grid headers (Safari needs the `-webkit-` prefix, present in Tasks 22–34), that `oklch()` and `color-mix()` colours render (Safari 16.4+), and that the .ics download and print preview work.

- [ ] **Step 6: Manual verification, 900 px (medium tier)**

In Chrome, open the device toolbar and set a responsive width of 900 px. Check: the sidebar is gone and a "Filtry" button with the active count sits in the top bar; it opens the filters as a drawer that slides in from the left (spec §7.1); the grid scrolls horizontally inside its own container while the page does not; the day tabs stay in the top bar; the detail sheet is still the right-hand side sheet; the plan view's conflict pairs are still side by side.

- [ ] **Step 7: Manual verification, 390 px (mobile tier)**

Set the responsive width to 390 px with `?now=2026-09-04T10:30`, Friday. Check:

1. The bottom tab bar shows Siatka, Lista, Mój plan (badge) and Filtry; the top bar holds the burst glyph alone, the search icon, "Widok" and the collapsed live dot "· N" that expands on tap; the theme toggle is inside "Widok" (bottom sheet); day tabs are a second scrollable row.
2. The default view on a fresh profile (clear site data first) is Lista; the grid axis defaults to "Bez grupowania" and zoom to 1.6.
3. Switch to Siatka with axis none and time mode Oś czasu, no filters: a single column with lanes that scrolls sideways inside the grid. In the console run `document.documentElement.scrollWidth === document.documentElement.clientWidth` and expect `true`; then, in the Elements panel, select the grid's scroll container (the ancestor of the `[data-now-line]` element whose computed style has `overflow: auto`) and run `$0.scrollWidth > $0.clientWidth` in the console, expecting `true`. The horizontal overflow lives in the grid, not the page. Also swipe the page: it never scrolls sideways.
4. The filters open as a bottom sheet from the tab bar; the detail panel is a 90 % bottom sheet; the plan view's conflict pairs stack vertically and every button, star, chip and tab is at least 44 px tall (toggle "Show device frame" and use the element inspector's box model).
5. The grain overlay is absent (no `<svg data-grain>` in the DOM at this width).

- [ ] **Step 8: Commit**

```bash
cd /Users/tom/Projects/conference-melt && git add README.md && git commit -F - <<'EOF'
chore: verification pass and README

npm run check is green (typecheck, tokens, tests, build, size);
dist/index.html stays under 1.5 MB; manual checks done in Chrome and
Safari at 1440, 900 and 390 px across grid, list, plan and detail with
the ?now= override. README documents the scripts, data refresh,
opening from disk, the now override and hosting for share links.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M4QdynGxmwa4dyP5DwVni2
EOF
```
