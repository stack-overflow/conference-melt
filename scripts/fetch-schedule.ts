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
