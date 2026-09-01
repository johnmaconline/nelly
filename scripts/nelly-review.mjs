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

let correction = "";
for (let attempt = 1; attempt <= 3; attempt += 1) {
  const prompt = `${identity}

Review the neutral evidence packet below. Form your own view. Internal agent discussion is not external evidence.
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
    if (!errors.length) {
      process.stdout.write(`${JSON.stringify({ agent: "Nelly", model: nellyOllamaModel, ...review })}\n`);
      process.exit(0);
    }
    correction = `Previous output failed validation: ${errors.join(", ")}. Remove prohibited actions or claims and correct the schema.`;
    console.error(`Nelly attempt ${attempt} rejected: ${errors.join(", ")}.`);
  } catch {
    correction = "Previous output contained invalid JSON. Return a smaller valid object.";
    console.error(`Nelly attempt ${attempt} rejected: invalid JSON.`);
  }
}

throw new Error("Nelly failed to produce a valid, in-scope review after three attempts.");
