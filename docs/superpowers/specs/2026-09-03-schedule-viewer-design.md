# ŚwiatłoSiła 2026 schedule viewer: design spec

Date: 2026-09-03
Status: approved in brainstorming, pending user review of this document

## 1. Goal

Turn the festival schedule published at https://swiatlosila.pl/harmonogram-2026/ into a static data file plus a fully interactive, browser-renderable schedule viewer. The viewer must:

- make simultaneous events obvious and easy to compare,
- let the user favourite sessions and see them as a personal plan with conflict detection,
- detect distinguishable time slots in the visible data and render a slot grid when they exist, a proportional timeline when they do not,
- be fully configurable (column axis, time mode, zoom, density, colour coding, filters),
- look and feel excellent on desktop and mobile.

Everything runs client-side. There is no server, no accounts, no analytics.

## 2. Non-goals

- Live sync with the festival site at runtime. The data is a snapshot refreshed by a script.
- Drag-to-reorder columns. Columns are hidden through the location filter instead.
- Playwright end-to-end tests. Verification is Vitest plus manual checks on desktop and a mobile viewport.
- Downloading speaker photos. They are hotlinked from swiatlosila.pl.

## 3. Source data facts

Gathered on 2026-09-03 from the WordPress REST API, which returns the same 153 events the page renders through its AJAX filter plugin.

- Post type `cyfrowe-event`, 153 published events. Taxonomies: `cyfrowe-event-type` (16 terms, 9 in use), `cyfrowe-event-theme` (80 terms), `cyfrowe-event-brand` (65 terms), `cyfrowe-event-location` (26 terms), `cyfrowe-event-day` (5 terms, 3 in use: Thursday 3 Sep with 1 event, Friday 4 Sep with 82, Saturday 5 Sep with 80), `cyfrowe-event-zapisy` (5 terms).
- Ten events carry both Friday and Saturday, so Friday and Saturday counts overlap and the sum of day counts (163) exceeds the event count (153).
- The time is not a structured field. It is the start of the first paragraph of the content, in the form `HH:MM-HH:MM` (150 events) or a lone `HH:MM` (3 point events: opening 09:30 Friday, results 13:30 Friday, closing 19:30 Saturday). Hyphen may be `-`, `–` or `—`.
- After the time, the first paragraph holds a comma, then speaker links (`<a href="https://swiatlosila.pl/cyfrowe-prelegent/<slug>/">Surname Firstname</a>`, several separated by ` / `) or plain text such as a brand name, then optionally a signup link to cyfrowe.pl whose text is `Zapisz się` or `Brak miejsc`.
- Post type `cyfrowe-prelegent`, 120 speakers, 119 with a square featured image (sizes thumbnail 150, medium 300, large 1024, full). Content is a bio followed by talk descriptions separated by paragraphs of dashes. Speakers do not link back to events.
- Start times are staggered across rooms (09:30, 09:35, 09:45, 10:00) and the lecture rooms run a 75-minute cadence offset from one another. Equipment-zone activities start every 15 to 30 minutes throughout the day.
- Brand identity: black ground, vivid orange burst logo (`#ff6600` in the theme CSS), accent pink `#fd62c9` and yellow `#ffd101`, fonts Bricolage Grotesque and Inter.

## 4. Data pipeline

### 4.1 Fetch script

`scripts/fetch-schedule.ts`, run with `npm run fetch` (`tsx`). Node 20 or newer, native `fetch`, no runtime dependencies beyond `tsx`.

Steps:

1. Fetch all pages of `/wp-json/wp/v2/cyfrowe-event?per_page=100&page=N` until the API returns `rest_post_invalid_page_number`.
2. Fetch the six event taxonomies with `per_page=100`, plus `cyfrowe-prelegent-type`.
3. Fetch all pages of `/wp-json/wp/v2/cyfrowe-prelegent?per_page=100&page=N&_embed=1` for photos.
4. Normalize (section 4.2) and validate (section 4.4).
5. Write `src/data/schedule.json`, pretty-printed with two spaces, object keys in a fixed order and arrays sorted by id, so re-runs produce minimal diffs.
6. Print a summary: counts per day, sessions without a parseable time, speaker links that did not resolve, locations that did not match the parsing rules.

The script sets a browser-like `User-Agent`. On any network error or non-2xx response it exits non-zero and writes nothing. It never writes a partial file.

### 4.2 Normalization rules

**Days.** Only day terms with `count > 0`. Name matches `/(Czwartek|Piątek|Sobota|Niedziela|Poniedziałek|Wtorek|Środa)\s*\((\d{1,2})\s+(\S+)\)/`. Month name maps Polish genitive names to numbers (września = 9). Year comes from the script constant `YEAR = 2026`. Day id is the weekday's short code: `czw`, `pt`, `sob`, `nd`, `pon`, `wt`, `sr`. Days are sorted by date.

**Sessions.** One session per (event, day). `id = "<eventId>:<dayId>"`. Sessions of the same event share `eventId`.

**Time.** From the text of the first non-empty paragraph, after stripping tags and decoding entities:

```
/^\s*(\d{1,2})[:.](\d{2})(?:\s*[-–—]\s*(\d{1,2})[:.](\d{2}))?/
```

`start` and `end` are minutes since midnight. Hours must be 0 to 23 and minutes 0 to 59, otherwise the time is treated as unparseable. If `end <= start` the end is discarded and the session is reported. No match gives `start = null, end = null`. The matched text is kept verbatim in `timeText`.

**Speakers on a session.** Every anchor in the first paragraph whose `href` matches `/cyfrowe-prelegent\/([^/]+)\/?$/` resolves by slug to a speaker record. Unresolved slugs are reported and the anchor text is kept in the byline instead.

**Byline.** The first paragraph text with the time match removed, the signup anchor text removed, speaker anchor texts removed, then trimmed of leading commas, slashes and whitespace. Empty becomes `null`. Example: `17:00-19:00, Sony Zapisz się` gives `"Sony"`.

**Signup.** Status from the `cyfrowe-event-zapisy` term: `Zapisy` → `open`, `Brak miejsc` → `full`, `W ramach festiwalu` → `included`, `WSTĘP WOLNY` → `free`, `Zapisy wkrótce` → `soon`, none → `unknown`. `url` is the `href` of the first anchor in the first paragraph whose host is not swiatlosila.pl, else `null`. `label` is the term name or `"Brak informacji"`.

**Description.** All paragraphs after the first, sanitized (section 4.3). Usually empty.

**Locations.** Each term is parsed with, in order:

1. `/^(.*?)\s*-\s*poziom\s*(0|I|II|III)\s*-\s*(.*)$/i` → venue, level, room.
2. `/^(.*?)\s*-\s*(Sala .*)$/` → venue, room, level `null`.
3. Otherwise venue is the full name, room `null`. If the name contains `poziom I` and `poziom II` the level is `"I+II"`, else a single `poziom X` sets the level.

`short` comes from an override map in the script keyed by term slug, covering all 26 current terms (for example `so-salsa-1` → `Sala wykł. 1`, `stoiska-wystawcow-poziom-i-plenum` → `Stoiska · Plenum`). Terms not in the map fall back to the room with `Sala wykładowa` shortened to `Sala wykł.` and `Sala warsztatowa` to `Warsztat.`, else the venue. `order` sorts by level (`0`, `I`, `I+II`, `II`, `III`, `null`) then by name.

**Speakers.** `name` is the post title with entities decoded. `photo` is the `large` size URL if present, else `full`; `photoThumb` is `medium`, else `thumbnail`, else `photo`. Missing image gives `null`. `bioHtml` is the sanitized content with paragraphs consisting only of dashes or em dashes replaced by `<hr>`. `brands` are the names of the speaker's `cyfrowe-prelegent-type` terms, excluding `Prelegent`.

**Terms.** `types`, `themes`, `brands`, `signupStatuses` include only terms with `count > 0`, sorted by name with Polish collation.

### 4.3 HTML sanitization

A dependency-free allowlist rewriter used for bios and descriptions:

- Allowed tags: `p`, `br`, `strong`, `b`, `em`, `i`, `ul`, `ol`, `li`, `a`, `hr`.
- Any other tag is removed; its text content is kept. WordPress block comments (`<!-- wp:... -->`) are removed.
- All attributes are dropped except `href` on `a`, which is kept only when it starts with `http://` or `https://`. Every kept `a` gets `target="_blank" rel="noopener noreferrer"`.
- Entities are decoded once and the result is re-escaped for `<`, `>` and `&` in text nodes.
- Empty paragraphs are removed.

The app renders the result with `dangerouslySetInnerHTML`. The source is the festival's own CMS; the allowlist limits what can reach the page.

### 4.4 Validation

The script fails (exit 1, nothing written) when:

- fewer than 3 days or fewer than 50 events come back,
- any day term in use has no parseable date,
- any session has a location id, type id or day id that is not in the fetched terms.

It warns (summary output, file still written) about sessions without a parseable time, unresolved speaker slugs, locations that fell through to the fallback `short`, and speakers without a photo.

### 4.5 Schema (`src/data/schedule.json`)

```ts
interface ScheduleData {
  meta: {
    source: string;        // page URL
    fetchedAt: string;     // ISO timestamp
    year: number;
    version: 1;
    eventCount: number;
    sessionCount: number;
    speakerCount: number;
  };
  days: Day[];
  locations: Location[];
  types: Term[];
  themes: Term[];
  brands: Term[];
  signupStatuses: Term[];
  speakers: Speaker[];
  sessions: Session[];
}

interface Term { id: number; slug: string; name: string; count: number }

interface Day {
  id: string;         // "czw" | "pt" | "sob" ...
  termId: number;
  date: string;       // "2026-09-04"
  label: string;      // "Piątek"
  short: string;      // "Pt"
  labelLong: string;  // "Piątek, 4 września"
}

interface Location extends Term {
  venue: string;
  level: "0" | "I" | "II" | "III" | "I+II" | null;
  room: string | null;
  short: string;
  order: number;
}

interface Speaker {
  id: number;
  slug: string;
  name: string;
  photo: string | null;
  photoThumb: string | null;
  bioHtml: string;
  url: string;
  brands: string[];
}

type SignupStatus = "open" | "full" | "included" | "free" | "soon" | "unknown";

interface Session {
  id: string;            // "<eventId>:<dayId>"
  eventId: number;
  day: string;
  title: string;
  start: number | null;  // minutes since midnight
  end: number | null;
  timeText: string;
  speakerIds: number[];
  byline: string | null;
  typeIds: number[];
  themeIds: number[];
  brandIds: number[];
  locationIds: number[];
  signup: { status: SignupStatus; url: string | null; label: string };
  descriptionHtml: string;
  url: string;           // source page
}
```

Expected size: roughly 400 KB pretty-printed, dominated by speaker bios. It is imported as a module so the single-file build inlines it.

## 5. Domain modules

All in `src/domain/`, pure TypeScript, no React, each with a Vitest file.

### 5.1 `time.ts`

- `formatTime(minutes)` → `"09:05"`.
- `formatRange(start, end)` → `"09:05–10:15"` or `"09:05"` when `end` is null.
- `durationLabel(start, end)` → `"1 h 10 min"`, `"45 min"`, `"20 min"`.
- `isAllDay(session)` → `end != null && end - start >= 300`.
- `isPoint(session)` → `start != null && end == null`.
- `visualEnd(session)` → `end ?? start + 20` for layout purposes.

### 5.2 `slots.ts`

`detectSlots(sessions, { tolerance = 15 })` for one day's visible sessions with non-null `start`:

1. Collect distinct start times, sorted ascending.
2. Walk them. Start a new cluster when either the gap to the previous start exceeds `tolerance` or the span from the cluster's first start would exceed `2 × tolerance`. Otherwise append to the current cluster. The span guard stops chains of 15-minute staggers from merging an entire morning.
3. Each cluster becomes `Slot { index, start: cluster[0], lastStart: cluster[cluster.length - 1], end: nextSlot.start ?? max(visualEnd of members), sessionIds }`. A session belongs to the slot whose cluster contains its start.
4. `rowSpan(session, slots, tolerance)`: the session occupies its own slot row and every later row `r` where `slots[r].start + tolerance < visualEnd(session)`. Point sessions occupy one row.

`slotRegularity(slots, sessions, tolerance)` returns `{ medianGap, sharedRatio, distinguishable }` where `medianGap` is the median gap between consecutive slot starts, `sharedRatio` is the fraction of sessions in slots containing two or more sessions, and

```
distinguishable = slots.length >= 2 && medianGap >= 3 * tolerance && sharedRatio >= 0.75
```

Calibration on the real data at `tolerance = 15`:

| visible set | slots | median gap | shared | distinguishable |
|---|---|---|---|---|
| Saturday, lectures only | 8 | 75 | 0.97 | yes |
| Friday, lectures only | 13 | 45 | 0.78 | yes |
| Friday, lecture rooms by location | 12 | 45 | 0.83 | yes |
| Friday, all 82 sessions | 17 | 37.5 | 0.93 | no |
| Saturday, all 80 sessions | 15 | 40 | 0.96 | no |
| Friday, equipment-zone activities | 13 | 37.5 | 0.84 | no |

This matches the intent: filter to lectures and you get a slot table, look at everything and you get a timeline. These six rows are encoded as fixture tests.

### 5.3 `overlaps.ts`

- `overlaps(a, b)` → `a.start < visualEnd(b) && b.start < visualEnd(a)` for same-day sessions with non-null starts. Sessions without a start never overlap anything.
- `overlapGroups(sessions)` → connected components of the overlap graph via a sweep line sorted by start. Used by the detail panel ("W tym samym czasie" shows every session that overlaps the selected one, not the whole component) and by the plan summary.
- `packLanes(sessions)` → `Map<sessionId, { lane, lanes }>`. Sort by start ascending, then by visualEnd descending. Greedy: assign the lowest lane whose last end is `<= start`. `lanes` is the lane count of the session's connected component, so widths are `1 / lanes`.
- `planConflicts(favouriteSessions)` → list of `{ a, b }` pairs that overlap, sorted by `a.start`.

### 5.4 `filters.ts`

```ts
interface Filters {
  types: number[]; themes: number[]; brands: number[]; locations: number[];
  signup: SignupStatus[]; query: string; onlyFavourites: boolean; hideAllDay: boolean;
}
```

`applyFilters(sessions, filters, favourites, index)` keeps a session when it matches every non-empty facet (OR within a facet, AND across facets), the query, favourites-only and the all-day rule. The query is normalized with `normalize(s) = s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()` and matched as a substring against title, speaker names, byline, theme names, brand names, location names and type names. `index` is a prebuilt map from session id to its searchable text so typing stays cheap.

`facetCounts(sessions, filters, facet)` returns counts per term computed with every facet except the one being counted, so the sidebar shows how many results each choice would leave.

### 5.5 `plan.ts`, `share.ts`, `ics.ts`, `text.ts`

- `plan.ts`: `planForDay(favourites, day)`, `planSummary(favourites)` → sessions per day and conflicts via `planConflicts`, `nextUp(favourites, now)` → the earliest favourite with `start >= now` on the current festival day.
- `share.ts`: `encodePlan(ids)` → `"1~" + ids.map(id => eventId.toString(36) + dayCode).join(".")` where `dayCode` is the first letter of the day id (`c`, `p`, `s`); `decodePlan(str, days)` → valid session ids plus the count of unknown ones. Unknown version prefixes decode to nothing.
- `ics.ts`: `buildIcs(sessions, data)` → an `iCalendar` string with one `VEVENT` per session. Floating local times (`DTSTART:20260904T093000`), `UID` = `<sessionId>@swiatlosila-plan`, `SUMMARY` = title, `LOCATION` = location name, `DESCRIPTION` = speakers, byline and source URL, lines folded at 75 octets, CRLF endings. Point sessions get a 20-minute `DTEND`.
- `text.ts`: `planAsText(sessions, data)` → one heading per day, then `09:30–10:30 · Title · Sala wykł. 1 · Speaker` lines.

### 5.6 `now.ts`

- `resolveNow(search)` → `Date` from `?now=<ISO>` when present and valid, else the real clock. The override is read once at boot and then advanced with the real clock delta so the cursor still moves.
- `nowFor(day, now)` → minutes since midnight when `now` falls on `day.date`, else `null`.
- `liveState(session, nowMinutes)` → `"past" | "live" | "soon" | "upcoming"`, where `soon` means starting within 15 minutes.
- `defaultDay(days, now, sessionsPerDay)` → the first day on or after today's date with more than 5 sessions, else the first day with more than 5 sessions, else the first day.

## 6. State and persistence

Single Zustand store in `src/state/store.ts`.

```ts
interface Settings {
  columnAxis: "location" | "type" | "brand" | "level" | "none";
  timeMode: "auto" | "slots" | "timeline";
  slotTolerance: number;          // 5..45 step 5, default 15
  zoom: number;                   // px per minute, 1.2..4 step 0.2, default 2
  density: "compact" | "comfortable";
  colorBy: "type" | "location" | "brand";
  showAvatars: boolean;
  allDayStrip: boolean;           // default true
  theme: "system" | "dark" | "light";
}

interface State {
  day: string; view: "grid" | "list" | "plan";
  filters: Filters; settings: Settings;
  favourites: string[];
  selectedSessionId: string | null;
  openSheet: "filters" | "settings" | "detail" | null;
  previewPlan: string[] | null;   // from a share link, not persisted
  toasts: Toast[];
}
```

**Persistence.** `favourites`, `settings`, `day` and `view` are written to `localStorage` under `swiatlosila-2026:v1` through Zustand's `persist` middleware with a `version` and a `migrate` hook. If storage throws (private mode, quota) the store keeps working in memory and shows one toast: "Nie mogę zapisać ulubionych w tej przeglądarce". Session ids in stored favourites that do not exist in the data are dropped at boot with a toast stating how many.

**First-run defaults.** `columnAxis` is `"none"` when the viewport is narrower than 700 px at first boot, otherwise `"location"`. `zoom` is 1.6 on narrow viewports, 2 otherwise. `view` is `"list"` on narrow viewports, `"grid"` otherwise. `day` comes from `defaultDay`.

**URL hash.** `#d=<dayId>&v=<view>` is written on change with `history.replaceState` and read on boot and on `hashchange`, so bookmarks and back navigation work. A shared plan adds `&plan=<encoded>`. The app strips `plan` from the hash after it is loaded or dismissed.

**Share flow.** On boot with `plan` present: decode, then show a banner "Ktoś udostępnił Ci plan: N wydarzeń" with three actions. "Wczytaj" unions the ids into favourites. "Tylko podgląd" sets `previewPlan` and switches to the plan view, which then shows the preview with a "Zapisz jako mój plan" button and a note that it is not saved. The close icon dismisses. If every id was unknown the banner says the link points to a schedule version that no longer matches.

## 7. UI

### 7.1 Shell

- Top bar: mark (orange burst glyph plus "ŚwiatłoSiła 2026"), day tabs, view switcher, search input, "Widok" settings button, theme toggle, live chip. The live chip reads "Teraz 10:42 · trwa 6" when the selected day is today, "Jutro od 09:00" the day before, and is hidden otherwise. Clicking it scrolls the grid to the now line.
- Desktop (1100 px and up): filters in a 280 px left sidebar that collapses to icons.
- Medium (700 to 1099 px): filters in a left drawer opened from a "Filtry" button that shows the active count.
- Mobile (under 700 px): bottom tab bar with Siatka, Lista, Mój plan (favourite count badge) and Filtry. Search collapses to an icon that expands the input across the top bar. The "Widok" button stays in the top bar.
- Active filters render as removable chips in a row under the top bar with "Wyczyść wszystko" at the end. The row scrolls horizontally on mobile.
- Toasts appear bottom-centre, one at a time, three seconds, announced through an `aria-live="polite"` region.

### 7.2 Grid engine (`ScheduleGrid`)

Input: visible sessions for the day, settings, favourites, now. Output: a scroll container that scrolls in both axes with a sticky time rail on the left and sticky column headers on top. Both headers use `position: sticky` inside the same scroll container; corner cell is sticky in both directions.

**Columns.** Determined by `columnAxis`:

- `location`: one column per location with at least one visible session, ordered by `Location.order`. A session with several locations appears in each.
- `type`: one column per primary type. The primary type is the session's first type in this priority order: Prelekcja, Prelekcja z sesją, Warsztaty, Fotospacer, Fotogra, PLAYGROUND, DZIAŁANIA W STREFIE SPRZĘTU, STREFA TELEOBIEKTYWÓW, Ogólne, then any other type by name.
- `brand`: one column per first brand, plus "Bez marki".
- `level`: one column per location level, labelled "Poziom 0", "Poziom I", "Poziom I i II", "Poziom II", "Inne".
- `none`: a single column that fills the width.

Column headers show the label, a count of visible sessions, and for locations the venue as a second line. Minimum column width is 200 px (comfortable) or 160 px (compact); in `none` mode the column is the container width.

**Time modes.** `auto` resolves to `slots` when `slotRegularity(...).distinguishable` is true for the current visible set, else `timeline`. The resolved mode is shown in the settings popover as "Auto (sloty)" or "Auto (oś czasu)".

*Timeline mode.* The day range runs from the earliest visible start rounded down to the half hour to the latest visible end rounded up to the half hour, with 15 minutes of padding on each side. Vertical scale is `zoom` px per minute. The rail shows hour labels and half-hour ticks. Inside each column, cards are absolutely positioned: `top = (start - rangeStart) * zoom`, `height = max((visualEnd - start) * zoom, minCardHeight)`, and `left`/`width` from `packLanes` so overlapping cards sit side by side. `minCardHeight` is 28 px compact, 44 px comfortable. Cards shorter than 56 px hide everything except the title and time.

*Slot mode.* Rows come from `detectSlots`. The rail shows the slot start in the display font and, when a cluster has more than one distinct start, the range `09:30–10:00` underneath in small text. Rows use `grid-auto-rows: minmax(<rowMin>, auto)` with `rowMin` 64 px compact, 88 px comfortable. A card is placed at `grid-row: startRow / span rowSpan`. Several sessions in the same cell and row stack vertically. Cards keep their exact time text so the approximation is never hidden.

**All-day strip.** When `allDayStrip` is on, sessions with `isAllDay` true render in a horizontal strip above the column headers, one chip per session, instead of as tall cards. When off they render as normal cards. The strip is sticky with the headers.

**No-time strip.** Sessions with `start == null` render in a "Bez godziny" strip below the all-day strip, only when there are any.

**Now line.** When `nowFor(day, now)` is not null, a horizontal line with a time chip spans the grid at the corresponding position (timeline: exact; slot mode: at the slot row containing now, aligned to the row's top edge with the chip saying the exact time). On first render for that day, the container scrolls so the line sits a third of the way down the viewport.

**Point sessions.** Rendered as a pin: a 20-minute-tall card with a diamond marker on the left edge and the single time.

### 7.3 Session card

Content, in order: colour edge on the left (hue from `colorBy`), title clamped to three lines (two in compact), time range, room short label (hidden when the column axis is location), up to three overlapping speaker avatars with initials fallback, a signup badge when status is `open` (green "Zapisy") or `full` (red "Brak miejsc"), and a star button. Cards are `<button>` elements; the star is a nested focusable control and stops propagation.

States: default, hover (lift by 2 px, deeper shadow), focus (2 px accent ring), favourited (star filled in accent, faint accent tint on the surface), live (animated 2 px accent outline pulse and a "Teraz" pill), past (opacity 0.6 when the day is today), conflict (a small triangle badge with the number of favourite sessions it overlaps, shown only when the card itself is favourited).

### 7.4 List view

Groups of sessions under headers. When `slotRegularity` is distinguishable the groups are the detected slots; otherwise they are hourly buckets by start time. Each header shows the slot or hour label and "N równolegle" when the group has two or more sessions. Rows are compact cards in a single column: time, colour dot, title, room, speakers, star. Sessions with no start appear last under "Bez godziny". All-day sessions appear in a leading "Całodniowe" group when the strip setting is on.

### 7.5 Plan view

The same grid and list components with `onlyFavourites` forced, plus:

- a summary bar: "Pt 6 · Sob 4" counts, conflict count in an amber pill when non-zero, "Następne: <title> za 25 min" when applicable.
- a conflicts panel listing each overlapping pair with the two titles, the overlap length, and buttons "Zostaw lewe" / "Zostaw prawe" that remove the other one.
- actions: "Udostępnij" (copies the share URL, toast confirms), "Kopiuj jako tekst", "Pobierz .ics", "Drukuj" (opens the print dialog; a print stylesheet renders the plan as a plain list).
- a toggle between grid and list inside the plan view, remembered in `settings`.
- empty state: an illustration made of the orange burst, "Twój plan jest pusty", and a button that switches to the grid.

### 7.6 Detail panel

Opens on card click. Desktop: 420 px side sheet from the right, content scrolls, grid stays visible. Mobile: bottom sheet at 90 % height. Both trap focus, close on Escape, backdrop click and the close button, and restore focus to the opening card.

Content: type chip, title, day and time with duration, venue, level and room, theme chips, brand chips, speakers (photo, name, brands, a "Pokaż bio" disclosure that renders `bioHtml`), byline when no speakers resolved, the signup button (external link, disabled with the label when `full`), "Dodaj do planu" / "Usuń z planu", "W tym samym czasie" listing every overlapping visible-or-not session of the same day with time, title, room and a star, and a "Zobacz na stronie festiwalu" link.

### 7.7 Filters sidebar and sheet

Facets in this order: Typ, Miejsce (grouped by level with the level as a sub-header), Tematyka, Marka, Zapisy. Each facet is a disclosure, open by default for Typ and Miejsce, closed for the long ones. Options are checkboxes with the facet count from `facetCounts`; zero-count options are dimmed, never hidden. Long facets have a small inline search. Toggles at the bottom: "Ukryj strefy całodniowe", "Tylko ulubione". A "Wyczyść" button per facet and one for all.

### 7.8 Settings popover ("Widok")

Segmented controls and sliders for every `Settings` field except `theme`, which lives in the top bar. Each control has a one-line hint. Slot tolerance and zoom are sliders with the current value shown. A "Przywróć domyślne" button resets settings only.

### 7.9 Keyboard and accessibility

- Day tabs use the roving tabindex pattern with arrow keys.
- Cards are buttons with an `aria-label` of "title, time, room".
- Sheets use `role="dialog"` with `aria-modal`, focus trap and focus restore.
- The now line and live pills are decorative; the live chip in the top bar carries the text.
- Colour never carries meaning alone: signup and conflicts have text or icons, types have labels in the detail panel.
- All interactive targets are at least 44 by 44 px on touch devices.
- Reduced motion disables the pulse, the entrance stagger and the crossfades.

### 7.10 Responsive summary

| tier | width | filters | default view | grid columns |
|---|---|---|---|---|
| wide | ≥ 1100 px | sidebar | grid | by location |
| medium | 700–1099 px | drawer | grid | by location, horizontal scroll |
| mobile | < 700 px | bottom sheet | list | none (single column with lanes); location available with horizontal swipe |

## 8. Visual design

**Tokens** in `src/styles/tokens.css`, dark values on `:root`, light values under `[data-theme="light"]`, and `prefers-color-scheme` honoured when `theme` is `system` by setting `data-theme` from JavaScript at boot.

- Ground `oklch(14% 0.01 60)`, surface 1 `oklch(19% 0.012 60)`, surface 2 `oklch(24% 0.014 60)`, border `oklch(32% 0.02 60)`, text `oklch(96% 0.01 80)`, muted text `oklch(72% 0.02 80)`.
- Accent (brand orange) `oklch(70% 0.2 45)`, accent hover `oklch(76% 0.2 45)`, on-accent `oklch(14% 0.02 45)`.
- Type hues at lightness 72 % and chroma 0.16 in dark, lightness 55 % in light: Prelekcja 45 (orange), Prelekcja z sesją 25 (red-orange), Warsztaty 340 (magenta), Fotospacer and Fotogra 95 (yellow), PLAYGROUND 175 (teal), DZIAŁANIA W STREFIE SPRZĘTU 240 (blue), STREFA TELEOBIEKTYWÓW 260, Ogólne 0 chroma (neutral). Location and brand colouring assign hues by hashing the id into 12 evenly spaced hues.
- Status: success `oklch(75% 0.17 150)`, danger `oklch(68% 0.2 25)`, warning `oklch(80% 0.16 85)`.
- Radii 8 px (cards), 12 px (sheets, popovers), 999 px (chips). Shadows two layers, stronger on hover.

**Typography.** Bricolage Grotesque 500 to 800 for the mark, day tabs, slot labels, section headings and big times; Inter 400 to 600 for everything else. Google Fonts `<link>` with `display=swap` and fallbacks `system-ui, -apple-system, Segoe UI, Roboto, sans-serif`. Base size 15 px, cards 13 px, minimum 12 px.

**Eye-candy, all cheap.**

- A soft radial orange glow behind the top bar, 30 % opacity dark, 12 % light.
- A fixed full-page SVG `feTurbulence` grain at 4 % opacity, `pointer-events: none`, skipped on mobile for performance.
- Sticky headers use `backdrop-filter: blur(12px)` over a semi-transparent surface.
- Card entrance on day or filter change: opacity and 6 px translate, 180 ms, staggered 12 ms per card up to 240 ms total.
- Star toggle scales 1 → 1.3 → 1 over 250 ms with a spring-like cubic-bezier.
- Live cards pulse their outline over 2 s.
- Day and view switches crossfade over 160 ms.
- All motion is wrapped in `@media (prefers-reduced-motion: no-preference)`.

## 9. Error handling and edge cases

- A session without a start never breaks layout: it goes to the "Bez godziny" strip or list group.
- A session ending before midnight but spanning the padded range is clamped to the range.
- Speaker photo load errors swap in an initials avatar with the same hue as the card.
- Storage failures degrade to memory with one toast.
- Unknown session ids in storage or share links are dropped with a count in a toast or banner.
- The `?now=` override with an invalid value is ignored silently.
- An empty visible set shows an empty state with the active filter chips and a "Wyczyść filtry" button; the grid does not render an empty scroll area.
- The Thursday tab exists even though it holds one session; its grid shows one column and the list one group.

## 10. Testing

Vitest with `jsdom` for component tests and node environment for domain tests.

Domain tests (each case a named `it`):

- `time`: range formatting, duration labels, all-day and point detection.
- `slots`: clustering with the gap and span guards, row spans including a 09:30–16:00 workshop, the six calibration fixtures from section 5.2 loaded from a JSON fixture of real start times, and `distinguishable` for each.
- `overlaps`: pairwise overlap including touching ends (10:00–11:00 and 11:00–12:00 do not overlap), lane packing for a three-way overlap, components with a bridging session, plan conflicts.
- `filters`: facet AND/OR semantics, diacritic-insensitive search (`swiatlo` finds `Światło`), favourites-only, all-day hiding, facet counts excluding their own facet.
- `share`: round trip, unknown ids counted, bad version ignored.
- `ics`: header, one event per session, folding of a long summary, CRLF.
- `text`: one heading per day, chronological lines.
- `now`: override parsing, live state boundaries, default day selection before, during and after the festival.

Script tests (`scripts/__tests__`): time parsing against the raw paragraph strings observed in the data (`17:00-19:00, Sony <a ...>Zapisz się</a>`, `09:30`, `13:30, Cyfrowe.pl`, en dash variants), speaker anchor extraction, byline cleanup, location parsing for all 26 names, sanitizer allowlist behaviour, day parsing.

Component tests (React Testing Library): star toggle updates the plan tab badge and persists; a filter chip removal restores the sessions; the detail panel lists the correct overlapping sessions for a known fixture; the share banner offers load and preview; timeline mode positions a 60-minute card at the expected height for a given zoom.

Build check: `npm run build` must produce `dist/index.html` under 1.5 MB, verified by a small script run in `npm run check`.

Manual verification before completion: open `dist/index.html` from disk in Chrome and Safari, check grid, list, plan and detail on a desktop window and in the responsive device toolbar at 390 px, with `?now=2026-09-04T10:30` to see live states.

## 11. Project structure and tooling

```
conference-melt/
  package.json
  vite.config.ts            react plugin + vite-plugin-singlefile
  vitest.config.ts
  tsconfig.json
  index.html
  scripts/
    fetch-schedule.ts
    lib/                    parse.ts, sanitize.ts, locations.ts (tested)
    __tests__/
  src/
    main.tsx
    App.tsx
    data/schedule.json
    domain/                 time, slots, overlaps, filters, plan, share, ics, text, now
    state/store.ts
    components/
      shell/                TopBar, DayTabs, ViewSwitcher, BottomBar, LiveChip, Toasts
      grid/                 ScheduleGrid, TimeRail, ColumnHeader, SessionCard, NowLine, AllDayStrip
      list/                 ScheduleList
      plan/                 PlanView, PlanSummary, ConflictsPanel, PlanActions, ShareBanner
      detail/               DetailSheet, SpeakerBlock, SameTimeList
      filters/              FiltersPanel, Facet
      settings/             SettingsPopover
      ui/                   Sheet, Popover, Chip, Avatar, Segmented, Slider, Toggle, EmptyState
    styles/                 tokens.css, base.css, print.css
    test/                   component tests and fixtures
  docs/superpowers/specs/
```

Dependencies: `react`, `react-dom`, `zustand`, `lucide-react`. Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `vite-plugin-singlefile`, `tsx`.

npm scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `typecheck`, `fetch`, `check` (typecheck, test, build, size check).

## 12. Acceptance criteria

1. `src/data/schedule.json` holds all 153 events as 163 sessions with parsed times, and `npm run fetch` regenerates it.
2. Opening `dist/index.html` from disk renders the schedule with no build tools present.
3. Simultaneous sessions are visible as side-by-side lanes in the timeline, as shared cells in the slot grid, as "N równolegle" groups in the list, and as the "W tym samym czasie" list in the detail panel.
4. A star on any card or in the detail panel adds the session to the plan, survives a reload, and the plan tab badge updates.
5. The plan view shows favourites in grid and list form, lists conflicts with resolution buttons, and offers share link, text copy, .ics download and print.
6. With the type filter set to Prelekcja on Saturday, auto mode renders a slot grid with eight rows; with no filters it renders a timeline. Forcing either mode works.
7. Column axis, time mode, tolerance, zoom, density, colour-by, avatars, all-day strip and theme are all changeable and persisted.
8. The layout is usable and attractive at 1440 px, 900 px and 390 px widths, with no horizontal page scroll on mobile.
