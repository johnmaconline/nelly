import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

test("Nelly treats recorded exchanges as experience without inventing a human life", () => {
  const contract = readFileSync(resolve(root, "NELLY.md"), "utf8");
  const review = readFileSync(resolve(root, "scripts/nelly-review.mjs"), "utf8");
  const dialogue = readFileSync(resolve(root, "scripts/nelly-dialogue.mjs"), "utf8");
  assert.match(contract, /life experience consists only of her recorded agent history/);
  assert.match(contract, /compact episode from every saved conversation/);
  assert.match(contract, /must never invent a childhood, body, family/);
  assert.match(review, /shared_agent_history/);
  assert.match(dialogue, /record establishes the exchange, not the truth/);
});

test("Nelly owns a source-linked immutable personal wiki", () => {
  const memory = readFileSync(resolve(root, "scripts/nelly-memory.mjs"), "utf8");
  const experience = readFileSync(resolve(root, "wiki/experiences/2026-09-02.md"), "utf8");
  assert.match(memory, /experience .* is immutable/);
  assert.match(experience, /wallybuilds:wiki\/conversations\/2026-09-02\.md/);
  assert.match(experience, /does not verify claims/);
});
