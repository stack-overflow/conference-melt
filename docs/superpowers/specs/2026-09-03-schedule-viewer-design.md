# ŚwiatłoSiła 2026 schedule viewer: design spec

Date: 2026-09-03
Status: approved in brainstorming, revised after adversarial review, pending user review of this document

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
- A collapsible sidebar. On wide screens the sidebar is always visible.
- Browser Back traversing day or view changes. The hash makes links and bookmarks work; Back leaves the app.
- Playwright end-to-end tests. Verification is Vitest plus manual checks on desktop and a mobile viewport.
- Downloading speaker photos. They are hotlinked from swiatlosila.pl.

## 3. Source data facts

Gathered on 2026-09-03 from the WordPress REST API, which returns the same 153 events the page renders through its AJAX filter plugin.

- Post type `cyfrowe-event`, 153 published events. Taxonomies: `cyfrowe-event-type` (16 terms, 9 in use), `cyfrowe-event-theme` (80 terms), `cyfrowe-event-brand` (65 terms), `cyfrowe-event-location` (26 terms, 20 in use), `cyfrowe-event-day` (5 terms, 3 in use: Thursday 3 Sep with 1 event, Friday 4 Sep with 82, Saturday 5 Sep with 80), `cyfrowe-event-zapisy` (5 terms).
- Ten events carry both Friday and Saturday, so Friday and Saturday counts overlap and the sum of day counts (163) exceeds the event count (153). 163 is the session count.
- The time is not a structured field. It is the start of the first non-empty paragraph of the content, in the form `HH:MM-HH:MM` (150 events) or a lone `HH:MM` (3 point events: opening 09:30 Friday, results 13:30 Friday, closing 19:30 Saturday). The hyphen may be `-`, `–` or `—`.
- After the time, 141 events have a comma, then speaker links (`<a href="https://swiatlosila.pl/cyfrowe-prelegent/<slug>/">Surname Firstname</a>`, several usually separated by ` / `, once by a bare space) or plain text (a brand name in events 39549 `Sony` and 39565 `Cyfrowe.pl`; a person's name written surname-first with no anchor in 46722 `Sorger Fabian` and 46568 `Danaj Katarzyna BUDZISZYNA`; and 39589 `KLIK FILM`; these five are the only non-null bylines on the current data and are displayed as-is); 17 events then carry a signup link to www.cyfrowe.pl whose text is `Zapisz się`, `Brak miejsc` or `Brak Miejsc`; 12 events have nothing after the time. The link text can contradict the `cyfrowe-event-zapisy` term (event 41152), and the page displays the term, so status comes from the term and the URL from the anchor host, never from the text.
- 147 speaker anchors exist. 137 carry a slug that matches a speaker record. Nine carry stale slugs (`jimmy-salatka` in seven events, `zenon-wujtaszek` in two) whose anchor text names an existing speaker, and one (event 41154) links to the event's own page with the speaker's name as text. One anchor (event 46769) has a correct slug but a `data-id` pointing at a different speaker.
- 36 of 153 titles contain HTML entities such as `&#8211;` or `&amp;`.
- Post type `cyfrowe-prelegent`, 120 speakers, 119 with a near-square featured image (speaker 46704 has none). Every image has `thumbnail` 150 and `medium` 300; `large` 1024 exists for 57 speakers, the other 62 top out at `full` (about 600 px). Content is a bio followed by talk descriptions separated by paragraphs made of dashes (runs of `&#8212;`, sometimes ending in `&#8211;` or `-`). Speakers do not link back to events.
- 18 events run 300 minutes or longer: ten are zones typed `Ogólne` (registration, equipment zone, shop, exhibition, food truck, running 09:00 to 18:00 on both days), eight are paid `Warsztaty` masterclasses with `Zapisy` or `Brak miejsc` status.
- Start times are staggered across rooms (09:30, 09:35, 09:45, 10:00) and the lecture rooms run a 75-minute cadence offset from one another. Equipment-zone activities start every 15 to 30 minutes throughout the day. On the unfiltered Friday, up to 17 timed sessions run at once (14:00), four of them 300-minute-plus `Warsztaty` sessions; the ten all-day zones, set aside as the all-day rule in 4.2 sets them aside, would raise it to 27. Saturday peaks at 16 (11:30).
- Brand identity: black ground, vivid orange burst logo (`#ff6600` in the theme CSS), accent pink `#fd62c9` and yellow `#ffd101`, fonts Bricolage Grotesque and Inter.

## 4. Data pipeline

### 4.1 Fetch script

`scripts/fetch-schedule.ts`, run with `npm run fetch` (`tsx`). Node 20 or newer, native `fetch`, no runtime dependencies beyond `tsx`. The script imports `normalizeText` from `src/domain/normalize.ts` so the fetch script and the app share one text-folding rule.

Steps:

1. Fetch all pages of `/wp-json/wp/v2/cyfrowe-event?per_page=100&page=N` until the API returns `rest_post_invalid_page_number`.
2. Fetch the six event taxonomies with `per_page=100`, plus `cyfrowe-prelegent-type`.
3. Fetch all pages of `/wp-json/wp/v2/cyfrowe-prelegent?per_page=100&page=N&_embed=1` for photos.
4. Normalize (section 4.2) and validate (section 4.4).
5. Write `src/data/schedule.json`, pretty-printed with two spaces, object keys in a fixed order, and every array in the deterministic order defined in section 4.2: `days` by `date`; `locations` by `order`; `types`, `themes`, `brands`, `signupStatuses` by `name` with Polish collation (`new Intl.Collator("pl").compare`), ties by `id`; `speakers` by `id`; `sessions` by `eventId`, then by the position of their day in `days`. Re-runs then produce minimal diffs.
6. Print a summary: counts per day, then every warning defined in section 4.4.
7. With `--fixtures`, additionally write the test fixtures described in section 5.2: `src/test/fixtures/slot-sets.json` (for each of the eight calibration sets, whose predicates live in `scripts/lib/slot-sets.ts` keyed by set id, the `{ id, start, end }` of every matching session with `allDay = false` and a non-null `start`, in `sessions` order) and `src/test/fixtures/fri-lectures.json`.

The script sets a browser-like `User-Agent`. On any network error or non-2xx response it exits non-zero and writes nothing. It never writes a partial file.

### 4.2 Normalization rules

**Days.** Only day terms with `count > 0`. The name matches `/(Czwartek|Piątek|Sobota|Niedziela|Poniedziałek|Wtorek|Środa)\s*\((\d{1,2})\s+(\S+)\)/`. The month name maps Polish genitive names to numbers (września = 9). The year comes from the script constant `YEAR = 2026`. Day id is the weekday's short code: `czw`, `pt`, `sob`, `nd`, `pon`, `wt`, `sr`. `label` is capture group 1; `short` comes from the map Czwartek→Czw, Piątek→Pt, Sobota→Sob, Niedziela→Nd, Poniedziałek→Pon, Wtorek→Wt, Środa→Śr; `labelLong` is `"<label>, <group 2> <group 3>"`. The raw term name (`⏱️ Piątek (4 września)`) is never displayed. Days are sorted by date.

**Sessions.** One session per (event, day). `id = "<eventId>:<dayId>"`. Sessions of the same event share `eventId`. `title` is `title.rendered` with entities decoded. `url` is the post's `link`. `typeIds`, `themeIds`, `brandIds` and `locationIds` are written in the order of the corresponding term array, so "first brand" and "first location" are deterministic.

**Time.** From the text of the first non-empty paragraph (a `<p>` whose stripped, decoded text is not blank), after stripping tags and decoding entities:

```
/^\s*(\d{1,2})[:.](\d{2})(?:\s*[-–—]\s*(\d{1,2})[:.](\d{2}))?/
```

`start` and `end` are minutes since midnight. Hours must be 0 to 23 and minutes 0 to 59, otherwise the time is treated as unparseable. If `end <= start` the end is discarded and the session is reported. No match gives `start = null, end = null, timeText = ""`. Otherwise the matched text is kept verbatim in `timeText`.

**Speakers on a session.** A speaker anchor is any anchor in the first paragraph whose `href` host is swiatlosila.pl (cyfrowe.pl anchors are signup links). Each resolves to a speaker record by the first tier that succeeds:

1. Slug: `/cyfrowe-prelegent\/([^/]+)\/?$/` on `href`, looked up by speaker slug.
2. Name: `nameKey(s)` = decode entities, apply `normalizeText` (section 5.4), split into word tokens (`/\p{L}+|\p{N}+/gu`) as a set. Accept the single speaker whose token set equals the anchor's token set. If there is none and the anchor has at least two tokens, accept the single speaker whose token set contains every anchor token. Zero or several candidates fail this tier. Anchor text is "Surname Firstname" while speaker names are "Firstname Surname", hence set comparison.
3. `data-id`: when the anchor has `data-type="cyfrowe-prelegent"` and a numeric `data-id`, look up by speaker id.

Slug precedes both fallbacks because event 46769 carries a correct slug with a wrong `data-id`. Name precedes `data-id` because the anchor text is what editors see, while `data-id` is hidden and already wrong once in this data. Anchors still unresolved are reported and their text stays in the byline. On the 2026-09-03 data all 147 anchors resolve: 137 by slug, 10 by name (`jimmy-salatka` → Emil Biliński in seven events, `zenon-wujtaszek` → Karol Bartnik in events 39590 and 46540, event 41154 → Filip Blank); the `data-id` tier is unused today.

**Byline.** The first paragraph text with the time match removed, the signup anchor text removed (the signup anchor is the first anchor whose `href` host is not swiatlosila.pl, the same anchor that supplies `signup.url`, regardless of its text), speaker anchor texts removed, then trimmed of commas, slashes and whitespace at both ends, with internal runs of whitespace collapsed to one space. Empty becomes `null`. Examples: `17:00-19:00, Sony <a cyfrowe.pl>Zapisz się</a>` → `"Sony"`; `16:00-18:00, <a prelegent>Wąs Mateusz MUSTACHE LENS</a> <a cyfrowe.pl>Brak Miejsc</a>` → `null`; `13:30, Cyfrowe.pl` → `"Cyfrowe.pl"`.

**Signup.** Status from the `cyfrowe-event-zapisy` term: `Zapisy` → `open`, `Brak miejsc` → `full`, `W ramach festiwalu` → `included`, `WSTĘP WOLNY` → `free`, `Zapisy wkrótce` → `soon`, none → `unknown`. `url` is the `href` of the signup anchor defined above, else `null`. `label` is the term name or `"Brak informacji"`.

**All-day.** `allDay` is `true` when `end != null`, `end - start >= 300`, and `typeIds` contains the type term with slug `ogolne` in any position; otherwise `false`. On the 2026-09-03 data this marks the 20 zone sessions (ten dual-day events) and none of the eight `Warsztaty` sessions of 300 minutes or more.

**Description.** All non-empty paragraphs after the first, sanitized (section 4.3). Usually empty.

**Locations.** Only terms with `count > 0` are emitted, but every fetched term is parsed and checked against the `short` map for the validation warning. Each name is parsed with the first rule that matches, in this order (level alternation is longest-first so `II` is never read as `I`):

1. `/^(.*?)\s*-\s*poziom\s*(0|III|II|I)\s*-\s*(.+)$/i` → venue, level, room. Eight current terms, for example `So Salsa - poziom II - Sala wykładowa nr 1`.
2. `/^(.*?)\s*-\s*poziom\s*I\s*\(([^)]+)\)\s*i\s*poziom\s*II\s*\(([^)]+)\)$/i` → venue, level `"I+II"`, room `"<g2> · <g3>"`. One term: `Stoiska wystawców - poziom I (PLENUM) i poziom II (SOSALSA)`.
3. `/^(.*?)\s*-\s*poziom\s*(0|III|II|I)\s*\(([^)]+)\)(?:\s*-\s*(.+))?$/i` → venue, level, room = g3, followed by ` · ` + g4 when g4 is present. Five terms, for example `Stoiska wystawców - poziom II (SOSALSA) - Playground` → room `SOSALSA · Playground`.
4. `/^(.*?)\s*-\s*poziom\s*(0|III|II|I)$/i` → venue, level, room `null`. Three terms, for example `Strefa sprzętu - poziom I`.
5. `/^(.*?)\s*-\s*(Sala .+)$/` → venue, room, level `null`. Five terms, for example `Studio Luksfera - Sala warsztatowa III`.
6. Otherwise venue is the full name, level `null`, room `null`. Four terms on the current data: `Rejestracja`, `W4`, `Wkrótce`, `ZERO ZERO (przed wejściem)`. Any other term reaching this rule is reported in the summary.

`short` comes from a map in the script keyed by term id. Terms not in the map fall back to the room with `Sala wykładowa` shortened to `Sala wykł.` and `Sala warsztatowa` to `Warsztat.`, else the venue, and are reported. The current map:

| id | name | short |
|---|---|---|
| 282 | Drizzly Grizzly - poziom 0 - Sala wykładowa nr 3 | Sala wykł. 3 |
| 292 | Klub bokserski - poziom II - Sala warsztatowa II | Warsztat. II |
| 279 | Klub bokserski - poziom II - Sala wykładowa nr 4 | Sala wykł. 4 |
| 241 | Playground Cyfrowe.pl - poziom II | Playground |
| 318 | Rejestracja | Rejestracja |
| 293 | So Salsa - poziom II - Sala warsztatowa I | Warsztat. I |
| 233 | So Salsa - poziom II - Sala wykładowa nr 1 | Sala wykł. 1 |
| 281 | SoSalsa - poziom II - Sala wykładowa nr 2 | Sala wykł. 2 |
| 308 | Stoiska wystawców - poziom I (PLENUM) | Stoiska · Plenum |
| 311 | Stoiska wystawców - poziom I (PLENUM) - Canon | Stoiska · Canon |
| 307 | Stoiska wystawców - poziom I (PLENUM) i poziom II (SOSALSA) | Stoiska · Plenum i SoSalsa |
| 309 | Stoiska wystawców - poziom II (SOSALSA) | Stoiska · SoSalsa |
| 313 | Stoiska wystawców - poziom II (SOSALSA) - Playground | Stoiska · Playground |
| 310 | Stoiska wystawców - poziom II (SOSALSA) - wyjście na dach | Stoiska · Dach |
| 239 | Strefa sprzętu - poziom I | Strefa sprzętu I |
| 240 | Strefa sprzętu - poziom II | Strefa sprzętu II |
| 236 | Studio Cukier by Luksfera - Sala warsztatowa IV | Warsztat. IV |
| 237 | Studio Elektryków - Sala warsztatowa V | Warsztat. V |
| 235 | Studio Luksfera - Sala warsztatowa III | Warsztat. III |
| 234 | Studio na ringu - poziom II - Sala warsztatowa II | Warsztat. II (ring) |
| 312 | W4 | W4 |
| 280 | W4 - poziom I - Sala wykładowa nr 5 | Sala wykł. 5 |
| 291 | Wkrótce | Wkrótce |
| 283 | ZERO ZERO (przed wejściem) | Zero Zero · wejście |
| 238 | Zero Zero - Sala warsztatowa VI | Warsztat. VI |
| 290 | ZERO ZERO Antresola - Sala warsztatowa VI | Warsztat. VI (antresola) |

`order` sorts by level (`0`, `I`, `I+II`, `II`, `III`, `null`) then by name with Polish collation. The `locations` array is written in `order` order.

**Speakers.** `name` is the post title with entities decoded. `photo` is the `large` size URL if present, else `full`; `photoThumb` is `medium`, else `thumbnail`, else `photo`. Missing image gives `null` for both. `url` is the post's `link`. `bioHtml` is the sanitized content (blank paragraphs, including whitespace-only ones such as the `<p> </p>` in speaker 46683, already removed by section 4.3) with every remaining paragraph whose decoded text matches `/^\s*[-–—][\s\-–—]*$/` replaced by `<hr>`; on the 2026-09-03 data this affects 22 paragraphs across 8 speakers. `brands` are the names of the speaker's `cyfrowe-prelegent-type` terms, excluding `Prelegent`.

**Terms.** `types`, `themes`, `brands`, `signupStatuses` include only terms with `count > 0`, sorted by name with Polish collation.

### 4.3 HTML sanitization

A dependency-free allowlist rewriter used for bios and descriptions:

- Allowed tags: `p`, `br`, `strong`, `b`, `em`, `i`, `ul`, `ol`, `li`, `a`, `hr`.
- Any other tag is removed; its text content is kept. WordPress block comments (`<!-- wp:... -->`) are removed.
- All attributes are dropped except `href` on `a`, which is kept only when it starts with `http://` or `https://`. Every kept `a` gets `target="_blank" rel="noopener noreferrer"`.
- Entities are decoded once and the result is re-escaped for `<`, `>` and `&` in text nodes.
- Paragraphs whose decoded text is blank after trimming are removed.

The app renders the result with `dangerouslySetInnerHTML`. The source is the festival's own CMS; the allowlist limits what can reach the page.

### 4.4 Validation

The script fails (exit 1, nothing written) when:

- fewer than 3 days or fewer than 50 events come back,
- any day term in use has no parseable date,
- any session has a location id, type id or day id that is not in the fetched terms.

It warns (summary output, file still written) about: sessions without a parseable time; sessions whose end was discarded; speaker anchors that did not resolve, and every anchor resolved by the name or `data-id` tier (so stale slugs stay visible); locations that reached parsing rule 6 other than the four listed; locations missing from the `short` map; sessions of 300 minutes or more that are not `allDay`; speakers without a photo.

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
  id: string;         // "czw" | "pt" | "sob" | "nd" | "pon" | "wt" | "sr"
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
  allDay: boolean;
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
- `durationLabel(start, end)` → `"1 h 10 min"`, `"2 h"` (no minutes part when the remainder is 0), `"45 min"`; `null` when `end` is null.
- `isAllDay(session)` → `session.allDay`.
- `isPoint(session)` → `start != null && end == null`.
- `visualEnd(session)` → `end ?? start + 20` for layout purposes.

### 5.2 `slots.ts`

`detectSlots(sessions, { tolerance = 15 })` runs on a **slot set**: sessions with non-null `start`, already reduced by the caller to the layout set defined in section 7.2 (all-day sessions are excluded while the strip is on).

1. Collect distinct start times, sorted ascending.
2. Walk them. Start a new cluster when either the gap to the previous start exceeds `tolerance` or the span from the cluster's first start would exceed `2 × tolerance`. Otherwise append to the current cluster. The span guard stops chains of 15-minute staggers from merging an entire morning.
3. Each cluster becomes `Slot { index, start: cluster[0], lastStart: cluster[cluster.length - 1], end: nextSlot.start ?? max(visualEnd of members), sessionIds }`. A session belongs to the slot whose cluster contains its start.
4. `rowSpan(session, slots, tolerance)`: the session occupies its own slot row and every later row `r` where `slots[r].start + tolerance < visualEnd(session)`. Point sessions occupy one row.
5. `spanAllowed(session, columnSessions, slots, tolerance)` → `true` when no other session in `columnSessions` has a row interval `[startRow, startRow + rowSpan)` intersecting the session's own. The grid engine (7.2) renders a spanning card only when it returns `true`, and passes the column's layout-set sessions.

`detectSlots([])` returns `[]`. `slotRegularity(slots, sessions, tolerance)` returns `{ medianGap, sharedRatio, distinguishable }`. `medianGap` is the median of the gaps between consecutive slot starts (mean of the two middle values for an even count, 0 with fewer than two slots). `sharedRatio` is the fraction of sessions in slots containing two or more sessions, 0 for an empty session list. Then:

```
distinguishable = slots.length >= 2 && medianGap >= 3 * tolerance && sharedRatio >= 0.75
```

Calibration on the real data at `tolerance = 15` with all-day sessions excluded (the default). Each set is a predicate over `src/data/schedule.json` using WordPress term ids. The fixture `src/test/fixtures/slot-sets.json` is a frozen snapshot holding, per set, `{ id, start, end }` for every session in the set, generated once by `npm run fetch -- --fixtures` and committed, so a later `npm run fetch` cannot silently change the domain tests. The same flag writes `src/test/fixtures/fri-lectures.json`: a `ScheduleData` subset with the complete `Session` records of the `fri-lectures` set (27 sessions) and the `days`, `types` and `locations` records they reference, with empty `themes`, `brands`, `speakers` and `signupStatuses`. `src/test/fixtures/build.ts` exports `makeSession(overrides: Partial<Session>): Session` and `makeData(sessions: Session[], terms?): ScheduleData` for synthetic cases.

| set | predicate | n | slots | median gap | shared | distinguishable |
|---|---|---|---|---|---|---|
| `sat-lectures` | day `sob`, any type in {184, 278} | 29 | 8 | 75 | 0.97 | yes |
| `sat-prelekcja-only` | day `sob`, type 184 | 26 | 8 | 75 | 0.96 | yes |
| `fri-lectures` | day `pt`, any type in {184, 278} | 27 | 13 | 45 | 0.78 | yes |
| `fri-prelekcja-only` | day `pt`, type 184 | 25 | 14 | 45 | 0.72 | no |
| `fri-lecture-rooms` | day `pt`, any location in {282, 279, 233, 281, 280} | 29 | 12 | 45 | 0.83 | yes |
| `fri-all` | day `pt` | 72 | 16 | 40 | 0.93 | no |
| `sat-all` | day `sob` | 70 | 15 | 40 | 0.96 | no |
| `fri-equipment` | day `pt`, any type in {214, 215} | 31 | 12 | 40 | 0.87 | no |

`shared` is `sharedRatio` rounded to two decimals; tests use `toBeCloseTo(x, 2)`. Filtering to lectures yields a slot table on both days (on Friday only when both lecture types are visible, because the two Friday `Prelekcja z sesją` talks, at 09:35 and 12:20, join otherwise single-occupant cells; the other three are on Saturday); a full day yields a timeline. These eight sets are encoded as fixture tests. If regenerating the fixture ever changes a number, the table is updated in the same commit.

### 5.3 `overlaps.ts`

- `overlaps(a, b)` → `false` when `a.day !== b.day`, when either session is `allDay`, or when either lacks a start; otherwise `a.start < visualEnd(b) && b.start < visualEnd(a)`. The `allDay` guard lives only here, so all-day zones never appear in `planConflicts`, the card conflict badge or "W tym samym czasie". Layout never consults the flag: `overlapGroups`, `packLanes`, `maxConcurrency`, `detectSlots`, `rowSpan` and `spanAllowed` work on raw intervals and lay out every session they receive; whether zones take part is decided solely by the layout set in 7.2 (excluded while `allDayStrip` is on, included when it is off).
- `overlapGroups(sessions, endOf = visualEnd)` → connected components of the graph in which `a` and `b` are connected when `a.day === b.day && a.start < endOf(b) && b.start < endOf(a)` (no-start sessions excluded), via a sweep line sorted by start. Used by `packLanes` for the component lane count. The detail panel's "W tym samym czasie" uses `overlaps` pairwise against the selected session, never the whole component.
- `packLanes(sessions, minMinutes)` → `Map<sessionId, { lane, lanes }>`. The packing end of a session is `max(visualEnd(s), s.start + minMinutes)` so cards stretched to the minimum height never paint over the next card in their lane. Sort by start ascending, then by packing end descending. Greedy: assign the lowest lane whose last end is `<= start`. `lanes` is the lane count of the session's connected component from `overlapGroups(sessions, packingEnd)`, so widths are `1 / lanes` and two sessions that collide only through packing ends still share a component.
- `maxConcurrency(sessions)` → the largest number of sessions running at one minute, by sweeping start and `visualEnd` events. Used by list-group headers.
- `planConflicts(planSessions)` → list of `{ a, b }` pairs for which `overlaps` is true, sorted by `a.day` then `a.start`.

### 5.4 `normalize.ts` and `filters.ts`

`normalizeText(s)` = replace `ł`→`l` and `Ł`→`L` (they have no canonical decomposition), then `s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()`. Shared by the fetch script (speaker name matching) and the search.

```ts
interface Filters {
  types: number[]; themes: number[]; brands: number[]; locations: number[];
  signup: SignupStatus[]; query: string; onlyFavourites: boolean; hideAllDay: boolean;
}
```

`applyFilters(sessions, filters, planSet, index, opts?)` keeps a session when it matches every non-empty facet (OR within a facet, AND across facets), the query, favourites-only against `planSet` and the all-day rule (`hideAllDay` removes `allDay` sessions). `opts` is `{ ignoreQuery?: boolean; ignoreFavourites?: boolean }` so callers can build the layout set with one function. The query is normalized with `normalizeText` and matched as a substring against title, speaker names, byline, theme names, brand names, location names and type names. `index` is a prebuilt map from session id to its normalized searchable text so typing stays cheap.

The `signup` facet is keyed by status value, not term id: options are the `SignupStatus` values in the order `open, full, included, free, soon, unknown`, labelled with the matching `signupStatuses` term name or `"Brak informacji"` for `unknown`; a session matches when `filters.signup.includes(session.signup.status)`.

`facetCounts(sessions, filters, facet, planSet, index)` returns counts per option of `facet` over `applyFilters(sessions, { ...filters, [facet]: [] }, planSet, index)`, so every other facet, the query, favourites-only and the all-day rule apply and the count is exactly how many results ticking that option would leave.

### 5.5 `plan.ts`, `share.ts`, `ics.ts`, `text.ts`

- `plan.ts`: the plan set is a memoized `Set<string>` selector over `previewPlan ?? favourites`. `planSessions(planSet, sessions)` → the plan's `Session[]` in data order; `planForDay(planSessions, dayId)`; `planSummary(planSessions, days)` → `{ perDay: { day: Day; count: number }[]; conflicts: { day: Day; pairs: { a: Session; b: Session }[] }[] }` via `planConflicts`; `nextUp(planSessions, days, now)` → the earliest plan session with `start >= nowFor(day, now)` on the day whose `date` is today's local date, else `null`.
- `share.ts`: `DAY_CODES` is a fixed map unique across every id the normalizer can emit: `czw→c`, `pt→p`, `sob→s`, `nd→n`, `pon→m`, `wt→t`, `sr→r`. `encodePlan(ids)` → `"1~" + ids.map(id => eventId.toString(36) + DAY_CODES[dayId]).join(".")`. `decodePlan(str, sessionIds: Set<string>)` → `{ ids: string[]; unknown: number }`: after the `1~` prefix, each `.`-separated token must match `/^([0-9a-z]+)([cpsnmtr])$/` (group 1 the base-36 event id, group 2 the day code); empty tokens are ignored so `decodePlan("1~", ids)` → `{ ids: [], unknown: 0 }`; tokens that do not match, or whose `"<eventId>:<dayId>"` is not in `sessionIds`, are counted as unknown. An unknown version prefix returns `{ ids: [], unknown: 0 }`.
- `ics.ts`: `buildIcs(sessions, data)` emits `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//swiatlosila-plan//PL`, `CALSCALE:GREGORIAN`, then per session a `VEVENT` with `UID:<sessionId>@swiatlosila-plan`, `DTSTAMP` from `meta.fetchedAt` in UTC basic form, `DTSTART`/`DTEND` as floating local times (`DTSTART:20260904T093000`; point sessions end 20 minutes later), `SUMMARY`, `LOCATION` (location names joined by `, `), `DESCRIPTION` (speakers, byline and source URL separated by `\n`), `URL`. TEXT values escape `\` → `\\`, `;` → `\;`, `,` → `\,`, newline → `\n`. Lines are folded at 75 octets without splitting a UTF-8 sequence, CRLF endings. Sessions without a start are skipped.
- `text.ts`: `planLines(sessions, data)` → `{ day: Day | null; lines: string[] }[]` in `days` order plus a final `{ day: null, lines }` entry for sessions without a start (omitted when empty). Each line is `09:30–10:30 · Title · Sala wykł. 1 · Speaker` with speaker names joined by `, ` and location shorts joined by ` / `; the location part is omitted when there are none and the speaker part is replaced by the byline when no speaker resolved (omitted when both are absent). `planAsText(sessions, data)` renders `planLines` as `labelLong` headings (`Bez godziny` for the last entry) followed by their lines, separated by blank lines.

### 5.6 `now.ts`

All date logic uses the browser's local time.

- `resolveNow(search)` → `new Date(v)` for `?now=v` when the result is a finite time (a date-time without a UTC offset is local; a date-only value is UTC per ECMAScript, so `resolveNow` appends `T00:00` to values matching `/^\d{4}-\d{2}-\d{2}$/` before parsing), else the real clock.
- `createClock(search)` → `{ now(): Date }` where `now()` returns `base + (Date.now() − bootedAt)`, so an override still advances. The store holds `now: Date`, set at boot and refreshed by a 30-second `setInterval` started in `App` (cleared on unmount); tests set it with `useStore.setState({ now })`. Every consumer (`liveState`, the live chip, `nextUp`, the now line) reads the store value.
- `nowFor(day, now)` → `now.getHours() * 60 + now.getMinutes()` when `now`'s local `YYYY-MM-DD` equals `day.date`, else `null`.
- `liveState(session, nowMinutes)` → `"upcoming"` when `start == null` or `nowMinutes == null`; `"past"` when `visualEnd(session) <= nowMinutes`; `"live"` when `start <= nowMinutes < visualEnd(session)`; `"soon"` when `0 < start - nowMinutes <= 15`; otherwise `"upcoming"`.
- `defaultDay(days, now, sessionsPerDay)` → the first day whose local date is on or after today with more than 5 sessions, else the first day with more than 5 sessions, else the first day.

Tests build dates with `new Date(2026, 8, 4, 10, 30)`, never ISO strings with `Z`, so they hold in any timezone.

## 6. State and persistence

Single Zustand store in `src/state/store.ts`.

```ts
interface Settings {
  columnAxis: "location" | "type" | "brand" | "level" | "none"; // default: see Defaults
  timeMode: "auto" | "slots" | "timeline";   // default "auto"
  slotTolerance: number;                     // 5..45 step 5, default 15
  zoom: number;                              // px per minute, 1.2..4 step 0.2, default: see Defaults
  density: "compact" | "comfortable";        // default "comfortable"
  colorBy: "type" | "location" | "brand";    // default "type"
  showAvatars: boolean;                      // default true
  allDayStrip: boolean;                      // default true
  planLayout: "grid" | "list";               // layout inside the plan view, default "list"
  theme: "system" | "dark" | "light";        // default "system"
}

interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };  // present → shown 6 s, else 3 s
}

interface State {
  day: string; view: "grid" | "list" | "plan";
  filters: Filters; settings: Settings;
  favourites: string[];
  selectedSessionId: string | null;
  openSheet: "filters" | "settings" | "detail" | "copy" | null;
  sharedPlan: { ids: string[]; unknown: number } | null;  // decoded share link awaiting the banner choice, not persisted
  previewPlan: string[] | null;   // from a share link, not persisted
  now: Date;                      // see 5.6, not persisted
  toasts: Toast[];
}
```

**Defaults.** `defaultSettings(viewportWidth)` returns the annotated values; `columnAxis` is `"none"` below 700 px, else `"location"`, and `zoom` is 1.6 below 700 px, else 2. It is called at first boot (nothing in storage) and by the reset button (section 7.8).

**Persistence.** `favourites`, `settings` and `view` are written to `localStorage` under `swiatlosila-2026:v1` through Zustand's `persist` middleware configured with `version: 1`, a `migrate` that returns the state unchanged (reserved for future shape changes), and `merge: (persisted, current) => ({ ...current, ...persisted, settings: { ...defaultSettings(window.innerWidth), ...persisted?.settings } })`, which runs on every hydration so a `Settings` field missing from storage gets its default without a version bump and without wiping other choices. `day` is never persisted, so a visitor who used the app on Friday lands on Saturday's schedule on Saturday. If storage throws (private mode, quota) the store keeps working in memory and shows one toast: "Nie mogę zapisać ulubionych w tej przeglądarce". Session ids in stored favourites that do not exist in the data are dropped at boot with a toast stating how many.

**Boot precedence.** `view`: a valid `v` in the hash, else the persisted value, else `"list"` below 700 px and `"grid"` otherwise. `day`: a valid `d` in the hash, else `defaultDay`. A value naming an unknown day or view is skipped at that step. After resolution the hash is rewritten to the resolved `d` and `v`, keeping an existing `plan` parameter verbatim until the share banner loads or dismisses it.

**URL hash.** `#d=<dayId>&v=<view>` is written on change with `history.replaceState(null, "", "#" + params)` (a fragment-only URL, so `?now=` and the file path are preserved) and read on boot and on `hashchange`, so bookmarks and hand-edited links work. Back does not traverse day or view changes. A shared plan adds `&plan=<encoded>`; every hash write keeps `plan` while `sharedPlan` is set and drops it once the banner is answered.

**Share flow.** On boot with `plan` present: `decodePlan` into `sharedPlan`. While `sharedPlan` is set, `ShareBanner` renders in the shell directly under the day tabs (above the filter-chip row), in every view: "Ktoś udostępnił Ci plan: N wydarzeń" (N = `sharedPlan.ids.length`, plus "M nie pasuje do tej wersji harmonogramu" when `unknown > 0`) with three actions. "Wczytaj" unions `sharedPlan.ids` into `favourites`. "Tylko podgląd" sets `previewPlan = sharedPlan.ids` and switches to the plan view. The close icon dismisses. Every action clears `sharedPlan` and removes `plan` from the hash. When `ids` is empty (every id unknown, or an unrecognised version prefix) the banner says the link points to a schedule version that no longer matches and offers only close.

**Plan set.** Everywhere the plan is read, the plan set is `previewPlan ?? favourites`. While `previewPlan` is set: the plan view header reads "Podgląd udostępnionego planu · nie zapisano" with "Zapisz jako mój plan" (unions into `favourites`, clears `previewPlan`) and "Zamknij podgląd" (clears it); "Udostępnij" and every control that changes plan membership are hidden: the conflicts panel's "Usuń z planu" buttons, the stars on grid cards, list rows, strip chips and "W tym samym czasie" rows, and the detail panel's "Dodaj do planu" / "Usuń z planu" button. Nothing writes `favourites` during preview except "Zapisz jako mój plan". Summary, conflicts list, "Kopiuj jako tekst", "Pobierz .ics" and "Drukuj" use the plan set. Switching to another view clears `previewPlan`.

## 7. UI

### 7.1 Shell

- Top bar: mark (orange burst glyph plus "ŚwiatłoSiła 2026"), day tabs, view switcher (Siatka, Lista, Mój plan; the Mój plan item shows the favourite count as a badge, hidden when zero), search input, "Widok" settings button, theme toggle (cycles system → dark → light, showing the current value as its icon), live chip. `ShareBanner` (section 6) renders under the day tabs when a shared plan is pending.
- Live chip: "Teraz HH:MM · trwa N" when the selected day is today (N = the day's sessions, before filtering, whose `liveState` is `live`); "Jutro od HH:MM" when the selected day is the calendar day after today (HH:MM = the earliest non-null start of that day, before filtering); hidden otherwise. In grid view clicking the "Teraz" chip scrolls to the now line; in list view it scrolls to the first group containing a `live` or `soon` session; the "Jutro" chip is not interactive.
- Wide (1100 px and up): filters in a 280 px left sidebar, always visible.
- Medium (700 to 1099 px): filters in a left drawer opened from a "Filtry" button that shows the active count.
- Mobile (under 700 px): the view switcher leaves the top bar and is replaced by a bottom tab bar with Siatka, Lista, Mój plan (favourite count badge) and Filtry. The mark is the glyph alone. Day tabs sit in a second, horizontally scrollable row under the top bar. Search collapses to an icon that expands the input across the top bar. "Widok" stays in the top bar and opens the settings as a bottom sheet (`openSheet = "settings"`), which then also holds the theme control; the top-bar theme toggle is hidden. The live chip collapses to a pulsing dot with the count ("· 6") that expands to the full text on tap.
- Active filters render as removable chips in a row under the day tabs with "Wyczyść wszystko" at the end. The row scrolls horizontally on mobile.
- Toasts appear bottom-centre, one at a time in insertion order, three seconds (six with an action), announced through an `aria-live="polite"` region.

### 7.2 Grid engine (`ScheduleGrid`)

**Session sets.** The grid distinguishes two sets for the selected day.

- The *layout set*: the day's sessions after the facets (types, themes, brands, locations, signup) and the all-day rule only, with `query` treated as empty and `onlyFavourites` ignored (`applyFilters` with `ignoreQuery` and `ignoreFavourites`); minus sessions with `start == null` (they go to the no-time strip); minus `allDay` sessions while `allDayStrip` is on (they go to the all-day strip).
- The *visible set*: `applyFilters` with everything applied.

In the plan view the day's sessions are first intersected with the plan set (`previewPlan ?? favourites`) and both sets are built from that intersection, so columns, strips, header counts, list rows and empty states see plan sessions only; the list view (7.4) inherits this because its groups and rows come from the same two sets.

The timeline range, `detectSlots`, `slotRegularity`, `packLanes`, `spanAllowed`, column widths and the now line are computed from the layout set. Cards are rendered for sessions in both sets; call that intersection the *rendered set*. Typing in the search box or toggling "Tylko ulubione" therefore never changes the time mode, the rail, the row set, the vertical scale, lane widths or spanning decisions: non-matching cards unmount and matching cards stay exactly where they were. Under every axis a column exists only when it holds at least one rendered-set session, so a search still narrows the grid to columns with results, and a location, type, brand or level whose sessions all sit in a strip gets no column while `allDayStrip` is on.

The scroll container renders only when the rendered set is non-empty. Otherwise the strips still render when they have content, and the empty state (section 9) takes the scroll container's place: no range, rail, columns, wrappers or now line exist and the "Teraz" chip is a no-op. `detectSlots` and `slotRegularity` are still evaluated (they are pure) so the resolved time mode stays defined for the settings readout and the list view.

Input: the layout set, the visible set, settings, plan set, now. Output: a scroll container that scrolls in both axes with a sticky time rail on the left and sticky column headers on top.

**Strips.** Both strips render outside the scroll container, directly above it, full width, in this order: the all-day strip (when `allDayStrip` is on and there are `allDay` sessions in the visible set), then the "Bez godziny" strip (when there are visible sessions without a start). Each is a single horizontally scrolling row of chips at most 44 px tall, prefixed with "Całodniowe (N)" or "Bez godziny (N)". A chip opens the detail panel and carries its own star. Strips are not sticky.

**Columns.** Determined by `columnAxis`:

- `location`: one column per location with at least one rendered-set session, ordered by `Location.order`. A session with several locations appears in each.
- `type`: one column per primary type, columns in the priority order below, then remaining types by name with Polish collation, plus a trailing "Bez typu" column when a session has no type. The primary type is the session's first type in this priority order: Prelekcja, Prelekcja z sesją, Warsztaty, Fotospacer, Fotogra, PLAYGROUND, DZIAŁANIA W STREFIE SPRZĘTU, STREFA TELEOBIEKTYWÓW, Ogólne, then any other type by name.
- `brand`: one column per session's first brand in `brandIds`, columns in `brands` array order, plus a trailing "Bez marki" for sessions with no brand.
- `level`: one column per location level present, in the `order` sequence, labelled "Poziom 0", "Poziom I", "Poziom I i II", "Poziom II", "Poziom III", and "Inne" for `null`. A session whose locations span several levels appears in each.
- `none`: a single column labelled "Wszystkie" holding every rendered-set session.

Column headers show the label, a count of rendered-set sessions in that column, and for locations the venue as a second line.

**Column width.** `minColumnWidth` is 200 px comfortable, 160 px compact. In slot mode every column is `minColumnWidth` wide and `none` fills the container. In timeline mode the column header and body carry an inline `min-width: <columnWidth>px` with `columnWidth = max(minColumnWidth, columnLanes × laneMin)`, where `columnLanes` is the largest `lanes` value among the `packLanes` components formed by that column's layout-set sessions and `laneMin` is 150 px compact, 180 px comfortable; the `none` track is additionally declared in CSS as `minmax(calc(100% - var(--rail-width)), auto)` so it fills the container. Card geometry is relative to the column body: `width: calc(100% / lanes)` and `left: calc(<lane> * 100% / lanes)` of the card's own component, so components with fewer lanes than the column maximum get wider cards and no container measurement is needed. When the summed column widths exceed the container, the grid scrolls horizontally inside its own scroll container; the page never scrolls horizontally. On the real data the unfiltered Friday `none` column has 17 lanes (2550 px compact, 3060 px comfortable, the same at every `minMinutes` from 0 to 22): the four Friday `Warsztaty` sessions of 300 minutes or more stay in the layout set because they are not `allDay`, and 17 sessions run at 14:00. The "Stoiska · Plenum" column has 8 lanes. Lecture-only views under the location axis have one lane per column and fit without scrolling; under `type` or `none` the lecture-only component has 4 lanes (720 px comfortable), which still fits on desktop. With `allDayStrip` off, each zone becomes a full-day lane in every column it belongs to (the `none` column gains 10 lanes on both days) and the grid scrolls as usual.

**Time modes.** `auto` resolves to `slots` when `slotRegularity(...).distinguishable` is true for the layout set, else `timeline`. `slots` and `timeline` force the mode. The resolved mode is shown in the settings popover as "Auto (sloty)" or "Auto (oś czasu)".

*Timeline mode.* The day range runs from the earliest layout-set start rounded down to the half hour to the latest layout-set `visualEnd` rounded up to the half hour, with 15 minutes of padding on each side. Vertical scale is `zoom` px per minute. The rail shows hour labels and half-hour ticks. The scroll container is a CSS grid with the corner, one header cell per column, the rail and one column body per column; each column body is `position: relative` and holds absolutely positioned cards with inline styles `top = (start - rangeStart) × zoom` px, `height = max((visualEnd - start) × zoom, minCardHeight)` px, and `left` and `width` from the lane rule above. `minCardHeight` is resolved in JavaScript, not CSS: 44 when `window.matchMedia?.("(pointer: coarse)")?.matches` is true (false when `matchMedia` is unavailable, as in jsdom), otherwise 28 compact, 44 comfortable. The same value sets the card's inline height and `minMinutes = ceil(minCardHeight / zoom)` for `packLanes`; cards get no CSS `min-height`. Cards shorter than 56 px show the title on one line plus the time; cards shorter than 40 px show the title alone (time stays in the `aria-label` and `title` attribute).

*Slot mode.* Rows come from `detectSlots` over the layout set. The scroll container is itself the CSS grid: its direct children are the corner cell, one header cell per column, one rail cell per slot row, one cell wrapper per (column, row) that has content, spanning cards, and the now line. The rail cell shows the slot start in the display font and, when the cluster has more than one distinct start, the range `09:30–10:00` underneath in small text. The grid declares `grid-template-rows: auto` for the header row (grid row 1) and `grid-auto-rows: minmax(<rowMin>, auto)` for the slot rows, with `rowMin` 64 px compact, 88 px comfortable, so a slot row grows to its tallest wrapper. Slot row `r` (0-based) is grid row `r + 2`; column `c` (0-based) is grid column `c + 2`; the rail is grid column 1. Placement is written as inline `grid-column` and `grid-row` styles on wrappers and spanning card items. A cell wrapper stacks its children vertically with an 8 px gap: continuation stubs first, then cards sorted by start then title.

Row spanning is decided per column over that column's layout-set sessions, exactly as lane widths are in timeline mode, so search and "Tylko ulubione" never change it. For a session with `rowSpan` k > 1, the card renders as its own grid item at `grid-row: <startRow> / span k` only when `spanAllowed` (5.2) is true; because rendered cards are a subset of the layout set, nothing else occupies those cells, no wrapper is placed there and nothing can overlap. A layout-set session outside the visible set renders no card and no stubs and is not counted in "+N w trakcie", but it still blocks spanning, so a matching card may stay confined with stubs in rows that currently show nothing else. Otherwise the card is confined to the wrapper of its start row and each of the next k − 1 wrappers in that column receives a continuation stub: a single-line element with the card's colour edge, the title muted and clamped to one line, and "do 16:00" (the session's end). Stubs are plain elements, carry `aria-hidden="true"` and no tab stop; a pointer click on one opens the session's detail panel. When a wrapper would hold more than three stubs it shows the first three and a muted "+N w trakcie" line; those sessions stay reachable from their start row and from "W tym samym czasie". Cards keep their exact time text so the approximation is never hidden. Under the location axis on the real data every spanning session spans; under `type`, `none` and `level` the Friday 13:20–14:20 lecture is confined with a stub in the 13:40 row.

**Now line.** When `nowFor(day, now)` is not null: in timeline mode a horizontal line across every column at the exact position, with a time chip rendered inside the sticky rail so it survives horizontal scroll; in slot mode a column-spanning item on the row `r` with `slots[r].start <= now < slots[r].end`, aligned to the row's top edge (`align-self: start`, `pointer-events: none`), with the chip showing the exact time rendered inside the rail cell of row `r` so it survives horizontal scroll, hidden when no slot contains now. On first render for that day the container scrolls so the line sits a third of the way down the viewport.

**Point sessions.** Rendered as a pin: a 20-minute-tall card with a diamond marker on the left edge and the single time.

### 7.3 Session card

A card is an `<article>` wrapper, positioned by the grid engine, containing exactly two sibling controls. The primary control is a `<button class="card__main">` that fills the card, holds the content below as phrasing content (`<span>` and `<img>` only), and opens the detail panel. The star is a separate `<button class="card__star">` positioned absolutely in the top-right corner of the `<article>` above the primary button, with padding reserved on the primary button so the title never sits under it; it uses `aria-pressed` with the constant accessible name "Do planu". Because the two are siblings, no propagation handling is needed. No interactive element is ever nested inside another anywhere in the app; the same two-sibling-controls structure is used for list rows (7.4), strip chips (7.2) and "W tym samym czasie" rows (7.6). DOM order inside a column follows start time so Tab order matches reading order.

Content, in order: colour edge on the left (hue from `colorBy`: the primary type by the 7.2 priority order, the first location by `locationIds`, or the first brand by `brandIds`; sessions with no brand or no location use the neutral hue), title clamped to three lines (two in compact), time range, short location label (hidden when the column axis is location), up to three overlapping speaker avatars with initials fallback when `showAvatars` is on (the setting governs cards and list rows only; the detail panel always shows photos), a signup badge when status is `open` (green "Zapisy") or `full` (red "Brak miejsc"), and the star.

States: default, hover (lift by 2 px, deeper shadow), focus (2 px accent ring), in plan (star filled in accent, faint accent tint on the surface), live (animated 2 px accent outline pulse and a "Teraz" pill), past (opacity 0.6 when the day is today), conflict (a small triangle badge with the number of plan sessions it overlaps, shown only when the card itself is in the plan).

### 7.4 List view

Groups of sessions under headers. Grouping follows the resolved time mode from 7.2 (which honours a forced `timeMode`): in `slots` the groups are the detected slots; otherwise hourly buckets by start time labelled `10:00–11:00`. Groups are computed from the layout set; rows are the visible set; a group with no visible rows is omitted. Each header shows the label, "N wydarzeń", and "M równolegle" where M is `maxConcurrency` of the group's visible sessions, shown only when M ≥ 2 and omitted when M equals N. Rows are compact cards in a single column: time, colour dot, title, location, speakers (avatars when `showAvatars` is on, else names), star. When `allDayStrip` is on, `allDay` sessions form a leading "Całodniowe" group; when off they sit in their start group. Sessions without a start appear last under "Bez godziny".

### 7.5 Plan view

The same grid and list components rendering the selected day (day tabs stay active), restricted to the plan set, with `planLayout` choosing grid or list through a segmented toggle inside the view. Plus:

- a summary bar across all days: "Pt 6 · Sob 4", the conflict count (the number of `planConflicts` pairs) in an amber pill when non-zero, and "Następne: <title> za 25 min" from `nextUp` when applicable.
- a conflicts panel listing every overlapping pair across all days, grouped by day. Each side shows the session's time, title and location with its own "Usuń z planu" button; the two sit side by side at 700 px and up and stack vertically below. Removing shows a toast "Usunięto z planu: <title>" with a "Cofnij" action that restores it.
- actions, in this order: "Kopiuj jako tekst", "Udostępnij", "Pobierz .ics", "Drukuj".
  - "Udostępnij" copies `u.href` where `u = new URL(location.href); u.search = ""; u.hash = "#d=<day>&v=plan&plan=" + encodePlan(favourites)` (the whole plan, every day). Toast: "Skopiowano link do planu". When `location.protocol` is `file:` the toast instead reads "Skopiowano. Link zadziała tylko u osób z tym samym plikiem. Opublikuj aplikację w sieci, aby udostępniać plan".
  - Copy actions use `navigator.clipboard.writeText`; when it is missing or rejects, a "Skopiuj ręcznie" sheet (`openSheet = "copy"`) shows the text in a read-only, pre-selected textarea.
  - "Pobierz .ics" builds `new Blob([ics], { type: "text/calendar;charset=utf-8" })` and clicks a temporary anchor with `download="swiatlosila-2026-plan.ics"`.
  - "Drukuj" calls `window.print()`. `App` always renders `<section class="print-plan">` (hidden on screen) in every view, built from `planLines` over the plan set: one `<h2>` per entry (`labelLong`, or "Bez godziny") and a `<ul>` of its lines; `print.css` sets `body > * { display: none }` and `.print-plan { display: block }`, so sheets and toasts are hidden too.
- empty state: when the plan set is empty on every day, an illustration made of the orange burst, "Twój plan jest pusty", and a button that switches to the grid; when the plan set has sessions but none on the selected day or none passing the filters, the section 9 empty state renders instead, its "Wyczyść filtry" button shown only when a filter is active.

### 7.6 Detail panel

Opens on card click. At 700 px and up: 420 px side sheet from the right, content scrolls, grid stays visible. Under 700 px: bottom sheet at 90 % height. Both trap focus, close on Escape, backdrop click and the close button, and restore focus to the control that opened them (a card's primary button, a list row, a chip).

Content: type chip, title, day and time with duration (single time and no duration for point sessions), venue, level and room, theme chips, brand chips, speakers (photo, name, brands, a "Pokaż bio" disclosure that renders `bioHtml`), byline when no speakers resolved, the signup button (external link, disabled with the label when `full`), "Dodaj do planu" / "Usuń z planu", "W tym samym czasie" listing every same-day session for which `overlaps` is true (all-day zones excluded by definition), whether or not currently visible, each with time, title, location and a star, and a "Zobacz na stronie festiwalu" link.

### 7.7 Filters sidebar and sheet

Facets in this order: Typ, Miejsce (grouped by level with the level as a sub-header), Tematyka, Marka, Zapisy. Each facet is a disclosure; Typ, Miejsce and Zapisy are open by default, Tematyka and Marka closed. Tematyka and Marka have a small inline search. Options are checkboxes with the count from `facetCounts`; zero-count options are dimmed, never hidden. Toggles at the bottom: "Ukryj strefy całodniowe", "Tylko ulubione". A "Wyczyść" button per facet and one for all.

### 7.8 Settings popover ("Widok")

A popover at 700 px and up, a bottom sheet below. Segmented controls and sliders for every `Settings` field except `theme` (top bar at 700 px and up, inside this sheet below) and `planLayout` (inside the plan view). Each control has a one-line hint. Slot tolerance and zoom are sliders with the current value shown. A "Przywróć domyślne" button replaces every field the popover shows with `defaultSettings(window.innerWidth)`, so `columnAxis` and `zoom` are re-evaluated against the current viewport; `theme`, `planLayout`, `day`, `view`, `filters` and `favourites` are untouched.

### 7.9 Keyboard and accessibility

- Day tabs use the roving tabindex pattern with arrow keys.
- Each card's primary button has an `aria-label` of "title, time, location" plus "Zapisy" or "Brak miejsc" when a badge is shown; the star is a separate tab stop with `aria-pressed`.
- Sheets use `role="dialog"` with `aria-modal`, focus trap and focus restore.
- The now line, live pills and continuation stubs are decorative; the live chip in the top bar carries the text.
- Colour never carries meaning alone: signup and conflicts have text or icons, types have labels in the detail panel.
- All interactive targets are at least 44 by 44 px on coarse pointers; the star's hit area is padded to 44 px even where its glyph is smaller.
- Reduced motion disables the pulse, the entrance stagger and the crossfades.

### 7.10 Responsive summary

| tier | width | filters | default view | grid columns |
|---|---|---|---|---|
| wide | ≥ 1100 px | sidebar | grid | by location |
| medium | 700–1099 px | drawer | grid | by location, horizontal scroll inside the grid |
| mobile | < 700 px | bottom sheet | list | none (single column; in timeline mode lanes scroll horizontally inside the grid); location available with horizontal swipe |

## 8. Visual design

**Tokens** in `src/styles/tokens.css`, dark values on `:root`, light values under `[data-theme="light"]`; when `theme` is `system`, `data-theme` is set from `prefers-color-scheme` at boot and on change.

- Dark: ground `oklch(14% 0.01 60)`, surface 1 `oklch(19% 0.012 60)`, surface 2 `oklch(24% 0.014 60)`, border `oklch(32% 0.02 60)`, text `oklch(96% 0.01 80)`, muted text `oklch(72% 0.02 80)`, accent `oklch(70% 0.2 45)`, accent hover `oklch(76% 0.2 45)`, on-accent `oklch(14% 0.02 45)`, success `oklch(75% 0.17 150)`, danger `oklch(68% 0.2 25)`, warning `oklch(80% 0.16 85)`.
- Light: ground `oklch(98% 0.005 80)`, surface 1 `oklch(100% 0 0)`, surface 2 `oklch(95% 0.01 80)`, border `oklch(86% 0.015 80)`, text `oklch(20% 0.02 60)`, muted text `oklch(45% 0.02 60)`, accent `oklch(60% 0.2 45)`, accent hover `oklch(54% 0.2 45)`, on-accent `oklch(98% 0.01 45)`; status colours keep hue and chroma at lightness 45 %.
- Type hues at lightness 72 % and chroma 0.16 in dark, lightness 55 % in light: Prelekcja 45 (orange), Prelekcja z sesją 25 (red-orange), Warsztaty 340 (magenta), Fotospacer and Fotogra 95 (yellow), PLAYGROUND 175 (teal), DZIAŁANIA W STREFIE SPRZĘTU 240 (blue), STREFA TELEOBIEKTYWÓW 260, Ogólne 0 chroma (neutral), any other type 300. Location and brand colouring assign hues by hashing the id into 12 evenly spaced hues.
- Radii 8 px (cards), 12 px (sheets, popovers), 999 px (chips). Shadows two layers, stronger on hover.

**Typography.** Bricolage Grotesque 500 to 800 for the mark, day tabs, slot labels, section headings and big times; Inter 400 to 600 for everything else. Google Fonts `<link>` with `display=swap` and fallbacks `system-ui, -apple-system, Segoe UI, Roboto, sans-serif`. Base size 15 px, cards 13 px, minimum 12 px.

**Eye-candy, all cheap.**

- A soft radial orange glow behind the top bar, 30 % opacity dark, 12 % light.
- A fixed full-page SVG `feTurbulence` grain at 4 % opacity, `pointer-events: none`, skipped under 700 px for performance.
- Sticky headers use `backdrop-filter: blur(12px)` over a semi-transparent surface.
- Card entrance on day or filter change: opacity and 6 px translate, 180 ms, staggered 12 ms per card up to 240 ms total. Cards that leave unmount immediately; the container crossfade below covers mode and day changes.
- Star toggle scales 1 → 1.3 → 1 over 250 ms with a spring-like cubic-bezier.
- Live cards pulse their outline over 2 s.
- Day and view switches, and a change of the resolved time mode caused by a day, facet, tolerance or time-mode change, crossfade the grid over 160 ms.
- All motion is wrapped in `@media (prefers-reduced-motion: no-preference)`.

## 9. Error handling and edge cases

- A session without a start never breaks layout: it goes to the "Bez godziny" strip or list group.
- The timeline range derives from the layout set, so no card exceeds it; nothing is clamped.
- Speaker photo load errors swap in an initials avatar with the same hue as the card.
- Storage failures degrade to memory with one toast.
- Unknown session ids in storage or share links are dropped with a count in a toast or banner.
- The `?now=` override with an invalid value is ignored silently.
- The grid shows an empty state instead of the scroll container whenever the rendered set is empty; it never renders an empty scroll area. With an empty visible set it reads "Brak wydarzeń dla tych filtrów" with the active filter chips and a "Wyczyść filtry" button (shown only when a filter is active). With a non-empty visible set (everything visible sits in the strips, for example the location facet set to Rejestracja) it reads "Wszystkie pasujące wydarzenia są całodniowe lub bez godziny. Znajdziesz je powyżej", keeps the chips and the clear button, and when the all-day strip holds them adds a "Pokaż w siatce" button that sets `allDayStrip` to false. The list view needs no such rule: its "Całodniowe" and "Bez godziny" groups come from the visible set.
- The Thursday tab exists even though it holds one session; its grid shows one column and the list one group.

## 10. Testing

Vitest with `jsdom` for component tests and node environment for domain and script tests.

Domain tests (each case a named `it`):

- `time`: range formatting, duration labels including whole hours and null end, point detection, `isAllDay` reading the flag.
- `slots`: clustering with the gap and span guards; `detectSlots([])` and `slotRegularity` on an empty list; row spans including the 09:30–16:00 workshop (event 41151) against the `fri-lectures` fixture's slot rows; the eight calibration sets from section 5.2 loaded from `src/test/fixtures/slot-sets.json`, asserting slot count, `medianGap`, `sharedRatio` to two decimals and `distinguishable`; `spanAllowed(session, columnSessions, slots, tolerance)` returning false when any other interval in the column intersects and true for the same session once the intersecting sessions are removed from `columnSessions`.
- `overlaps`: pairwise overlap including touching ends (10:00–11:00 and 11:00–12:00 do not overlap); sessions on different days never overlap, including the two sessions of one dual-day event; all-day exclusion; lane packing for a three-way overlap; with a 09:00–18:00 all-day session and a 10:00–10:20 session in one set `packLanes` returns `lanes = 2` for both while `overlaps` is still false for the pair; two sessions that overlap only through packing ends share a component and get `lanes = 2`; components with a bridging session; `maxConcurrency`; plan conflicts.
- `normalize` and `filters`: `swiatlo` finds `Światło`, `pawel` finds `Paweł`; facet AND/OR semantics; the signup facet by status; favourites-only; all-day hiding; `ignoreQuery` and `ignoreFavourites`; facet counts excluding their own facet while applying the query.
- `share`: round trip; unknown ids counted; unmapped day code counted; empty payload `1~` gives no unknowns; bad version ignored.
- `ics`: header properties, one event per session, escaping of commas and semicolons in a real title, folding of a long summary without splitting a multi-byte character, CRLF.
- `text`: `planLines` entries per day plus the no-start entry, speaker and location joining, byline fallback; `planAsText` headings and chronological lines.
- `now`: override parsing with and without offset, a date-only override resolving to local midnight, live state at each boundary (`now == start`, `now == end`, `start - now == 15`, point session), default day before, during and after the festival.
- `plan`: `planSummary` per-day counts and conflict pairs grouped by day; `nextUp` on and off a festival day.

Script tests (`scripts/__tests__`):

- time parsing against the raw first paragraphs observed in the data (`17:00-19:00, Sony <a ...>Zapisz się</a>`, `09:30`, `13:30, Cyfrowe.pl`, en dash and em dash variants, `end <= start`);
- first non-empty paragraph selection when the first `<p>` is blank;
- speaker resolution: a `jimmy-salatka` anchor with text "Biliński Emil" resolves to speaker 134 by name; the 39590 anchor (`data-type="link"`, URL in `data-id`) resolves to 128 by name; the 41154 event-page anchor "Blank Filip" resolves to 293; the 46769 anchor resolves by slug and its wrong `data-id` is ignored; "Leja Michal" matches "Michał Leja"; a stale-slug anchor with ambiguous text and a valid numeric `data-id` resolves by `data-id`; an anchor matching two speakers with no usable `data-id` stays unresolved and keeps its text in the byline;
- byline cleanup for the three examples in 4.2;
- all-day classification: a 09:00–18:00 `Ogólne` session is all-day; a 09:30–16:00 `Warsztaty` session is not; a 09:30–14:30 `Warsztaty` session (exactly 300 minutes) is not; a 09:30 `Ogólne` point session is not; a 09:30–18:00 session with types `Ogólne` and `STREFA TELEOBIEKTYWÓW` is all-day;
- location parsing for all 26 names against `scripts/__tests__/locations.fixture.json`, written by hand from the rules and the table in 4.2 (one `it` per id, asserting venue, level, room and short); in particular 307 → `I+II`, 309, 310 and 313 → `II`, 308 → `I`, 312 → `null`;
- sanitizer allowlist behaviour and the `<hr>` rule for dash paragraphs ending in an en dash;
- day parsing including `label`, `short` and `labelLong`.

Component tests (React Testing Library):

Fixtures: `makeSession` and `makeData` from `src/test/fixtures/build.ts` for synthetic cases, `fri-lectures.json` for real-data cases.

- star toggle on a card updates the Mój plan badge in the view switcher and persists across `useStore.persist.rehydrate()`;
- removing a filter chip restores the sessions;
- the detail panel, for a `makeData` fixture of five sessions (three overlapping the selected one, one touching its end, one all-day zone), lists exactly the three;
- the share banner offers load and preview; preview hides every star (list rows, grid cards, strip chips, "W tym samym czasie"), the detail panel's plan button, the conflict buttons and "Udostępnij", and `favourites` is unchanged after opening a preview card;
- timeline mode gives a 60-minute card an inline height of `60 × zoom` px; a column with an 8-lane component has inline `min-width` of 8 × `laneMin` px and its cards `width: calc(100% / 8)`, while a 2-lane component in the same column gets `width: calc(100% / 2)`; for every pair of cards in the same column body the inline `[top, top + height)` intervals are disjoint or the `[left, left + width)` expressions differ in lane;
- forced slot mode (`timeMode: "slots"`, `slotTolerance: 15`, `columnAxis: "none"`; the synthetic set's `sharedRatio` is 0 so `auto` would resolve to timeline): sessions 09:30–10:45, 10:15–11:30 and 11:00–12:15 produce rows 09:30, 10:15, 11:00; the first two each yield one card in their start row and one `aria-hidden` stub in the following row, the third yields one card and no stub, every wrapper lists stubs before cards, and no wrapper holds two elements for the same session; with `fri-lectures.json` and axis `type` the 13:20–14:20 card is confined with a stub in the 13:40 row, with axis `location` it spans two rows, and with axis `type` plus a query matching only that card (`sportowa`) it stays confined and its stub remains; for every cell wrapper and spanning card item the inline `grid-column` and `grid-row` values, expanded to the set of (column, row) cells covered, are pairwise disjoint, and every session id appears at most once per column as a card;
- with the location facet set to Rejestracja (318) on Friday and `allDayStrip` on, the all-day strip renders one chip, the strip-only empty state is shown and no scroll container exists; setting `allDayStrip` off renders one column with that card;
- the plan view with an empty plan shows "Twój plan jest pusty"; with a plan on another day only, the section 9 empty state without the clear button;
- the print section is present in every view and both plan layouts;
- no `validateDOMNesting` warning is logged while rendering a grid with cards.

Build check: `npm run build` must produce `dist/index.html` under 1.5 MB, verified by a small script run in `npm run check`.

Manual verification before completion: open `dist/index.html` from disk in Chrome and Safari, check grid, list, plan and detail on a desktop window and in the responsive device toolbar at 390 px, with `?now=2026-09-04T10:30` to see live states. At 390 px with axis `none`, timeline mode and no filters on Friday, confirm in the console that `document.documentElement.scrollWidth === document.documentElement.clientWidth` while the grid's scroll container has `scrollWidth > clientWidth`, so the horizontal overflow lives in the grid, not the page.

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
    lib/                    parse.ts, sanitize.ts, locations.ts, speakers.ts, slot-sets.ts (tested)
    __tests__/              including locations.fixture.json
  src/
    main.tsx
    App.tsx
    data/schedule.json
    domain/                 time, slots, overlaps, normalize, filters, plan, share, ics, text, now
    state/store.ts
    components/
      shell/                TopBar, DayTabs, ViewSwitcher, BottomBar, LiveChip, ShareBanner, Toasts
      grid/                 ScheduleGrid, TimeRail, ColumnHeader, SessionCard, ContinuationStub, NowLine, Strips
      list/                 ScheduleList
      plan/                 PlanView, PlanSummary, ConflictsPanel, PlanActions, PrintPlan
      detail/               DetailSheet, SpeakerBlock, SameTimeList
      filters/              FiltersPanel, Facet
      settings/             SettingsPanel
      ui/                   Sheet, Popover, Chip, Avatar, Segmented, Slider, Toggle, EmptyState, CopySheet
    styles/                 tokens.css, base.css, print.css
    test/                   component tests and fixtures (slot-sets.json, fri-lectures.json, build.ts)
  docs/superpowers/specs/
```

Dependencies: `react`, `react-dom`, `zustand`, `lucide-react`. Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@types/react`, `@types/react-dom`, `@types/node`, `vite-plugin-singlefile`, `tsx`.

Supporting modules not listed in the tree above: `src/domain/lookup.ts` (data index, primary type, location and speaker lookups), `src/domain/colors.ts` (hue assignment), `src/state/{hash,boot,derive,theme,clipboard,clock,useMediaQuery}.ts`, `src/data/index.tsx` (the snapshot plus a React context so tests inject fixtures), `scripts/lib/{api,normalize,validate,fixtures,slot-sets}.ts`, `src/components/ui/{Star,Burst}`, `src/test/setup.ts`, `scripts/check-size.mjs` and `scripts/check-tokens.mjs`.

npm scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `typecheck`, `fetch`, `size`, `tokens` (every `var(--name)` used under `src` must be declared in `tokens.css` or set by a component), `check` (typecheck, tokens, test, build, size check).

## 12. Acceptance criteria

1. `src/data/schedule.json` holds all 153 events as 163 sessions with parsed times, every speaker anchor resolved, and `npm run fetch` regenerates it.
2. Opening `dist/index.html` from disk renders the schedule with no build tools present.
3. Simultaneous sessions are visible as side-by-side lanes in the timeline, as shared cells in the slot grid, as "M równolegle" counts in the list, and as the "W tym samym czasie" list in the detail panel. No two cards ever overlap on screen.
4. A star on any card or in the detail panel adds the session to the plan, survives a reload, and the plan tab badge updates.
5. The plan view shows the plan in grid and list form, lists conflicts with removal and undo, and offers text copy, share link, .ics download and print.
6. With the type filter set to Prelekcja on Saturday, auto mode renders a slot grid with eight rows; with no filters it renders a timeline. Forcing either mode works and never produces overlapping cards.
7. Column axis, time mode, tolerance, zoom, density, colour-by, avatars, all-day strip, plan layout and theme are all changeable and persisted.
8. The layout is usable and attractive at 1440 px, 900 px and 390 px widths, with no horizontal page scroll on mobile.
