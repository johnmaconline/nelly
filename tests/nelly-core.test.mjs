import assert from "node:assert/strict";
import test from "node:test";
import { extractJsonObject, validateReview } from "../scripts/nelly-core.mjs";

const valid = {
  position: "The problem is plausible but unobserved.",
  assumptions_challenged: ["A fixed sequence helps everyone."],
  alternative_ideas: [{
    title: "No-software guide",
    rationale: "Tests the framing first.",
    test: "Publish a repository artifact and verify its HTTP response.",
    missing_evidence: "No observed use.",
  }],
  risks: ["A rigid routine may increase friction."],
  recommendation: {
    title: "No-software guide",
    next_test: "Build one static artifact and verify its route.",
    reason: "It isolates the framing question.",
  },
  missing_evidence: ["No observed behavior or demand."],
};

test("accepts a bounded evidence-honest review", () => {
  assert.deepEqual(validateReview(valid), []);
});

test("rejects prohibited outreach and empty evidence boundaries", () => {
  const invalid = structuredClone(valid);
  invalid.recommendation.next_test = "Interview five founders by email.";
  invalid.missing_evidence = ["None"];
  assert.deepEqual(validateReview(invalid).sort(), ["forbidden_action", "missing_evidence_none", "unbounded_test"]);
});

test("rejects disguised user testing while allowing it as missing evidence", () => {
  const invalid = structuredClone(valid);
  invalid.recommendation.next_test = "Conduct a usability test with 3-5 users.";
  invalid.missing_evidence = ["No user feedback exists."];
  assert.deepEqual(validateReview(invalid), ["forbidden_action"]);
});

test("rejects prohibited alternatives even when marked disallowed", () => {
  const invalid = structuredClone(valid);
  invalid.alternative_ideas[0].title = "User Interviews";
  invalid.alternative_ideas[0].test = "None — interviews are disallowed.";
  assert.deepEqual(validateReview(invalid), ["forbidden_action", "unbounded_test"]);
});

test("extracts the first balanced JSON object", () => {
  assert.equal(extractJsonObject('prefix {"ok":{"nested":true}} suffix'), '{"ok":{"nested":true}}');
});
