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
