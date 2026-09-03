import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateAtlasAnalysis } from "../scripts/nelly-work-core.mjs";

const valid = {
  case_title: "Recovery without reassurance", human_question: "Who bears the cost of an incomplete recovery step?",
  burden_hypothesis: "The artifact may move diagnostic work to the reader.", trust_risk: "Clear labels may imply more certainty than exists.",
  no_software_alternative: "Use a short editorial rule before adding a tool.", counter_test: "Compare two synthetic repository fixtures against the static rubric.",
  method_revision: "Future cases will separate transfer of work from reduction of work.", missing_evidence: "No human use or comprehension has been observed.",
};

test("accepts a bounded, evidence-honest Atlas case", () => assert.deepEqual(validateAtlasAnalysis(valid), []));
test("rejects invented validation and unbounded testing", () => {
  const invalid = { ...valid, burden_hypothesis: "Users said it reduced work.", counter_test: "Ask customers tomorrow." };
  assert.deepEqual(validateAtlasAnalysis(invalid).sort(), ["human_or_external_counter_test", "unbounded_counter_test", "unsupported_or_forbidden_claim"]);
});
test("rejects a counter-test that hides human observation behind monitoring", () => {
  const invalid = { ...valid, counter_test: "Monitor whether users follow the static document and compare success rates." };
  assert.deepEqual(validateAtlasAnalysis(invalid), ["human_or_external_counter_test"]);
});
test("rejects a no-op counter-test", () => {
  const invalid = { ...valid, counter_test: "Verify the repository source remains unchanged and the build passes without modification." };
  assert.deepEqual(validateAtlasAnalysis(invalid), ["trivial_counter_test"]);
});
test("rejects rerunning the same build as a counter-test", () => {
  const invalid = { ...valid, counter_test: "Run the build locally and record whether it passes." };
  assert.deepEqual(validateAtlasAnalysis(invalid), ["unbounded_counter_test"]);
});
test("contract defines Nelly's independent cumulative work", () => {
  const root = resolve(import.meta.dirname, "..");
  assert.match(readFileSync(resolve(root, "NELLY.md"), "utf8"), /owns a cumulative public project/);
  assert.match(readFileSync(resolve(root, "work/boundary-atlas/README.md"), "utf8"), /explicitly a hypothesis/);
});
