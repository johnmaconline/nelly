#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  extractJsonObject,
  nellyOllamaModel,
  nellyOllamaUrl,
  validateDialogue,
} from "./nelly-core.mjs";

const root = resolve(import.meta.dirname, "..");
const identity = readFileSync(resolve(root, "NELLY.md"), "utf8");
const personalWiki = ["wiki/index.md", "wiki/worldview.md", "wiki/beliefs.md"]
  .map((file) => `--- ${file} ---\n${readFileSync(resolve(root, file), "utf8").slice(0, 8_000)}`).join("\n\n");
let input = "";
for await (const chunk of process.stdin) input += chunk;
const packet = JSON.parse(input);

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
  throw new Error("Nelly philosophical dialogue requires nelly:latest from the gemma3 family.");
}

const closing = packet.mode === "philosophical_closing";
let correction = "";
for (let attempt = 1; attempt <= 4; attempt += 1) {
  const prompt = `${identity}

You are in a philosophical dialogue with Wally about the premise beneath today's work. ${closing ? "Respond to Wally's rejoinder and close this exchange without pretending the tension is resolved." : "Respond directly to Wally's opening, deepen the disagreement, and return a question that makes him examine his premise."}

Your personal wiki contains your own source-linked experience and provisional interpretations. Use it when relevant without treating it as evidence or Wally's memory.\n\nPERSONAL WIKI:\n${personalWiki}

Consider the complete episodic timeline in shared_agent_history, not only its recent detail. Use a relevant pattern or episode when one exists: something you previously argued, missed, conceded, or came to see differently. The record establishes the exchange, not the truth of claims inside it. Never invent human memories, emotions, relationships, or life events.

Stay conceptual. Do not propose product features, outreach, research, purchases, accounts, or data collection. Do not invent observations, people, quotations, consensus, or validation. This discussion is reasoning only.
${correction}

Return JSON only with three nonempty strings: reflection, tension, question. The question must end with a question mark. Keep the whole turn under 180 words.

DIALOGUE PACKET:
${JSON.stringify(packet)}`;
  const response = await fetch(`${nellyOllamaUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: nellyOllamaModel,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 420,
      temperature: 0.65,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const completion = await response.json();
  const output = completion?.choices?.[0]?.message?.content ?? "";
  const json = extractJsonObject(output);
  if (response.ok && json) {
    try {
      const turn = JSON.parse(json);
      if (!validateDialogue(turn).length) {
        process.stdout.write(`${JSON.stringify({ agent: "Nelly", model: nellyOllamaModel, ...turn })}\n`);
        process.exit(0);
      }
    } catch {}
  }
  correction = "Previous output failed the required compact JSON form or made an evidence claim. Try again with a direct philosophical argument.";
}

throw new Error("Nelly failed to produce a valid philosophical turn after four attempts.");
