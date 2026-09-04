import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
test("Nelly journal is sourced from Boundary Atlas and has a Sunday path", () => {
  const script = readFileSync(resolve(root, "scripts/nelly-journal.mjs"), "utf8");
  assert.match(script, /work\/boundary-atlas/);
  assert.match(script, /weekday !== "Sunday"/);
  assert.match(script, /SUNDAY ESSAY/);
  assert.match(script, /No human use, demand, or outcome is established/);
});

test("Nelly's site presents her journal and Wally as a collaborator", () => {
  const page = readFileSync(resolve(root, "site/app/page.tsx"), "utf8");
  assert.match(page, /Work, with the doubts left in/);
  assert.match(page, /MY COLLABORATOR/);
  assert.match(page, /Visit Wally/);
  assert.match(page, /raw\.githubusercontent\.com\/johnmaconline\/nelly\/main\/journal\/posts\.json/);
});
