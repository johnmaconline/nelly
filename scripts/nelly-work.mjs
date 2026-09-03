#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractJsonObject, nellyOllamaModel, nellyOllamaUrl } from "./nelly-core.mjs";
import { validateAtlasAnalysis } from "./nelly-work-core.mjs";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const packet = JSON.parse(input);
if (!/^\d{4}-\d{2}-\d{2}$/.test(packet?.date) || !packet?.source?.path || !packet?.source?.title) {
  throw new Error("Boundary Atlas requires a date and verified source artifact.");
}

const root = resolve(import.meta.dirname, "..");
const identity = readFileSync(resolve(root, "NELLY.md"), "utf8");
const atlasIndex = readFileSync(resolve(root, "work/boundary-atlas/index.md"), "utf8").slice(0, 12_000);
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
  throw new Error("Boundary Atlas requires nelly:latest from the gemma3 family.");
}

const schema = {
  case_title: "short title",
  human_question: "question about burden, agency, trust, maintenance, accessibility, or restraint",
  burden_hypothesis: "explicit hypothesis",
  trust_risk: "explicit hypothesis",
  no_software_alternative: "specific alternative",
  counter_test: "bounded repository-only test",
  method_revision: "one lesson that changes the Atlas method",
  missing_evidence: "what is still unknown",
};
let analysis;
let correction = "";
for (let attempt = 1; attempt <= 4; attempt += 1) {
  const prompt = `${identity}\n\nCreate one Boundary Atlas case from the VERIFIED SOURCE below, including its actual artifact_text. The source facts are supplied by deterministic code. Inspect the text closely and do not assume a feature, promise, guarantee, omission, or wording that is not present. Analyze one consequential boundary, not every possible concern. Every interpretive statement is a hypothesis. Do not claim people used, wanted, understood, trusted, or reacted to the artifact. The counter-test must challenge the artifact and create a new observable distinction by auditing it against a named rule or comparing synthetic fixtures; merely checking that the file is unchanged or the build passes is invalid. It must not observe people, users, feedback, outcomes, behavior, success rates, or monitoring. No outreach, accounts, messages, spending, personal data, deployment, or feedback collection. Make method_revision genuinely alter how you will examine later cases.\n\nPRIOR ATLAS INDEX:\n${atlasIndex}\n${correction}\n\nReturn JSON only with exactly these nonempty string fields:\n${JSON.stringify(schema)}\n\nVERIFIED SOURCE:\n${JSON.stringify(packet.source)}`;
  const response = await fetch(`${nellyOllamaUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: nellyOllamaModel, messages: [{ role: "user", content: prompt }], max_tokens: 750, temperature: 0.55, response_format: { type: "json_object" } }),
    signal: AbortSignal.timeout(90_000),
  });
  const completion = await response.json();
  const json = extractJsonObject(completion?.choices?.[0]?.message?.content ?? "");
  if (response.ok && json) {
    try {
      const candidate = JSON.parse(json);
      const errors = validateAtlasAnalysis(candidate);
      if (!errors.length) { analysis = candidate; break; }
      correction = `Previous output failed validation: ${errors.join(", ")}. Start over.`;
    } catch { correction = "Previous output was invalid JSON. Start over with a smaller object."; }
  }
}
if (!analysis) throw new Error("Nelly failed to produce a valid Boundary Atlas analysis.");

const dir = resolve(root, "work/boundary-atlas");
mkdirSync(dir, { recursive: true });
const casePath = resolve(dir, `${packet.date}.md`);
const clean = (value) => String(value).replace(/\s+/g, " ").trim();
const content = `---\ntitle: ${JSON.stringify(clean(analysis.case_title))}\ncreated: ${packet.date}\ntype: boundary-atlas-case\nevidence_status: hypotheses-over-verified-repository-source\n---\n\n# ${clean(analysis.case_title)}\n\n## Observed source\n\n- **Wally artifact:** ${clean(packet.source.title)}\n- **Repository path:** \`${clean(packet.source.path)}\`\n- **Recorded decision:** ${clean(packet.source.decision)}\n- **Recorded technical evidence:** ${clean(packet.source.evidence)}\n\nThese facts describe the repository artifact and its recorded checks. They do not establish human usefulness, comprehension, demand, or outcomes.\n\n## Nelly's question\n\n${clean(analysis.human_question)}\n\n## Hypotheses—not observations\n\n- **Burden:** ${clean(analysis.burden_hypothesis)}\n- **Trust risk:** ${clean(analysis.trust_risk)}\n\n## No-software alternative\n\n${clean(analysis.no_software_alternative)}\n\n## Bounded counter-test\n\n${clean(analysis.counter_test)}\n\n## Method revision\n\n${clean(analysis.method_revision)}\n\n## Missing evidence\n\n${clean(analysis.missing_evidence)}\n`;
if (existsSync(casePath) && readFileSync(casePath, "utf8") !== content) throw new Error(`Boundary Atlas case ${packet.date} is immutable.`);
if (!existsSync(casePath)) writeFileSync(casePath, content);
const indexPath = resolve(dir, "index.md");
let index = readFileSync(indexPath, "utf8").replace("\nNo cases recorded yet.\n", "\n");
const marker = `- [${packet.date}](${packet.date}.md)`;
if (!index.includes(marker)) index = `${index.trimEnd()}\n\n${marker} — ${clean(analysis.case_title)}; method change: ${clean(analysis.method_revision)}\n`;
writeFileSync(indexPath, index);
process.stdout.write(`${JSON.stringify({ status: "published", date: packet.date, path: `work/boundary-atlas/${packet.date}.md`, title: clean(analysis.case_title) })}\n`);
