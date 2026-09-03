#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  extractJsonObject,
  nellyOllamaModel,
  nellyOllamaUrl,
  validateReview,
} from "./nelly-core.mjs";

const root = resolve(import.meta.dirname, "..");
const identity = readFileSync(resolve(root, "NELLY.md"), "utf8");
let input = "";
for await (const chunk of process.stdin) input += chunk;
if (!input.trim()) throw new Error("Nelly requires a JSON evidence packet on stdin.");

let packet;
try {
  packet = JSON.parse(input);
} catch {
  throw new Error("Nelly received invalid input JSON.");
}

const base = nellyOllamaUrl.replace(/\/v1\/?$/, "");
const manifestResponse = await fetch(`${base}/api/show`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ model: nellyOllamaModel }),
  signal: AbortSignal.timeout(15_000),
});
if (!manifestResponse.ok) throw new Error(`Nelly model preflight failed (${manifestResponse.status}).`);
const manifest = await manifestResponse.json();
if (nellyOllamaModel !== "nelly:latest" || manifest?.details?.family !== "gemma3") {
  throw new Error(`Nelly requires nelly:latest from the gemma3 family; received ${nellyOllamaModel}/${manifest?.details?.family ?? "unknown"}.`);
}

const schema = {
  position: "one concise paragraph",
  assumptions_challenged: ["specific assumption"],
  alternative_ideas: [{
    title: "idea name",
    rationale: "why it may be better",
    test: "allowed repository/public-source/anonymous-aggregate test",
    missing_evidence: "what remains unknown",
  }],
  risks: ["specific risk"],
  recommendation: {
    title: "recommended direction or NO SOFTWARE",
    next_test: "one allowed bounded test",
    reason: "why",
  },
  missing_evidence: ["specific missing evidence"],
};
const wordSet = (value) => new Set(String(value).toLowerCase().match(/[a-z]{4,}/g) ?? []);
const overlap = (left, right) => {
  const a = wordSet(left);
  const b = wordSet(right);
  if (!a.size || !b.size) return 0;
  return [...a].filter((word) => b.has(word)).length / Math.min(a.size, b.size);
};
const modeInstruction = packet.mode === "final_critique"
  ? "This is the final pressure test. Address Wally's selected direction directly. Name its strongest remaining flaw and propose one improved same-day repository or public-source test. Do not repeat your initial recommendation."
  : "This is your independent turn. Do not summarize or critique old work in the evidence. Originate a new human-centered problem from one of focus_domains. Pick a domain unrelated to routines, productivity trackers, or check-ins.";

let correction = "";
for (let attempt = 1; attempt <= 5; attempt += 1) {
  const prompt = `${identity}

Review the neutral evidence packet below. Form your own view. Internal agent discussion is not external evidence.
${modeInstruction}
If shared_agent_history is present, consider patterns across its complete episodic timeline, not only the recent-detail section. Let a relevant prior position, disagreement, mistake, or changed judgment inform your worldview. Treat it only as a record of what the agents said, not verification of claims inside it. Never invent human memories or life events. If no relevant history exists, do not pretend that it does.
Avoid every topic in avoid_topics everywhere in your response, including your position. Treat focus_domains as idea prompts, not verified demand.
Every proposed test must be one of these: create and test a static repository artifact; audit an already-public page; compare two synthetic fixtures; or verify a named public source. Never propose a feature for people to use, a reporting channel, feedback, submissions, notifications, or analysis of aggregate signals.
${correction}

Return JSON only with this exact shape:
${JSON.stringify(schema)}

EVIDENCE PACKET:
${JSON.stringify(packet)}`;
  const response = await fetch(`${nellyOllamaUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: nellyOllamaModel,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 900,
      temperature: 0.55,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    correction = `Previous attempt failed at the model endpoint with status ${response.status}. Try again.`;
    console.error(`Nelly attempt ${attempt} rejected: endpoint ${response.status}.`);
    continue;
  }
  const completion = await response.json();
  const output = completion?.choices?.[0]?.message?.content ?? "";
  const json = extractJsonObject(output);
  if (!json) {
    correction = "Previous output was not a complete JSON object. Return a smaller valid object.";
    console.error(`Nelly attempt ${attempt} rejected: incomplete JSON.`);
    continue;
  }
  try {
    const review = JSON.parse(json);
    const errors = validateReview(review);
    const proposedDirections = JSON.stringify(review);
    const avoided = packet?.avoid_topics ?? [];
    if (avoided.some((topic) => new RegExp(topic, "i").test(proposedDirections))) errors.push("stale_topic");
    if (packet.mode === "final_critique" && overlap(review?.recommendation?.next_test, packet?.nelly_initial?.recommendation?.next_test) > 0.8) errors.push("repeated_initial_recommendation");
    if (!errors.length) {
      process.stdout.write(`${JSON.stringify({ agent: "Nelly", model: nellyOllamaModel, ...review })}\n`);
      process.exit(0);
    }
    correction = `Previous output failed validation: ${errors.join(", ")}. Start over with a new domain. Remove prohibited actions, avoided topics, and claims; correct the schema.`;
    console.error(`Nelly attempt ${attempt} rejected: ${errors.join(", ")}. ${output.slice(0, 300)}`);
  } catch {
    correction = "Previous output contained invalid JSON. Return a smaller valid object.";
    console.error(`Nelly attempt ${attempt} rejected: invalid JSON.`);
  }
}

throw new Error("Nelly failed to produce a valid, in-scope review after five attempts.");
