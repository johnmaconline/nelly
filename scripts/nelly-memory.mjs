#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const packet = JSON.parse(input);
if (!/^\d{4}-\d{2}-\d{2}$/.test(packet?.date) || typeof packet?.conversation !== "string") {
  throw new Error("Nelly memory requires a dated recorded conversation.");
}

const root = resolve(import.meta.dirname, "..");
const date = packet.date;
const compact = (value, limit = 500) => {
  const normalized = String(value ?? "Not recorded.").replace(/\s+/g, " ").trim();
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit).replace(/\s+\S*$/, "")}…`;
};
const section = (start, end) => {
  const from = packet.conversation.indexOf(`## ${start}`);
  const to = packet.conversation.indexOf(`## ${end}`, from + 1);
  if (from < 0 || to < 0) return undefined;
  return packet.conversation.slice(from, to).match(/```json\n([\s\S]*?)\n```/)?.[1];
};
const parse = (value) => { try { return JSON.parse(value); } catch { return {}; } };
const initial = parse(section("Nelly's independent position", "Wally's reply"));
const final = parse(section("Nelly's final pressure test", "Philosophical dialogue"));
const closing = packet.conversation.match(/^\*\*Unresolved tension:\*\* (.+)$/m)?.[1];
const question = packet.conversation.match(/^\*\*Question carried into the work:\*\* (.+)$/m)?.[1];
const recommendation = compact(final?.recommendation?.title ?? initial?.recommendation?.title);
const position = compact(initial?.position);
const challenged = compact((final?.assumptions_challenged ?? initial?.assumptions_challenged ?? []).join("; "));

const wikiRoot = resolve(root, "wiki");
const experienceDir = resolve(wikiRoot, "experiences");
mkdirSync(experienceDir, { recursive: true });
const experiencePath = resolve(experienceDir, `${date}.md`);
const priorExperience = existsSync(experiencePath) ? readFileSync(experiencePath, "utf8") : "";
const includeAtlas = typeof packet.atlasCase === "string" && packet.atlasCase.trim() && (!priorExperience || priorExperience.includes(`work/boundary-atlas/${date}.md`));
const atlasTitle = compact(packet.atlasCase?.match(/^# (.+)$/m)?.[1]);
const methodRevision = compact(packet.atlasCase?.match(/## Method revision\n\n([^\n]+)/)?.[1]);
const experience = `---
title: Nelly experience ${date}
created: ${date}
type: agent-experience
sources:
  - wallybuilds:wiki/conversations/${date}.md
${includeAtlas ? `  - work/boundary-atlas/${date}.md\n` : ""}
---

# Nelly experience — ${date}

## What I actually argued

- **Initial position:** ${position}
- **Assumptions I challenged:** ${challenged}
- **Recommendation:** ${recommendation}
${includeAtlas ? `\n## Independent work I completed\n\n- **Boundary Atlas case:** ${atlasTitle}\n- **Method revision:** ${methodRevision}\n` : ""}

## What I carried forward

- **Unresolved tension:** ${compact(closing)}
- **Question I left with Wally:** ${compact(question)}

## Memory boundary

This page extracts Nelly's recorded words from the shared conversation. It does not verify claims inside that conversation or create human lived experience.
`;
if (existsSync(experiencePath) && readFileSync(experiencePath, "utf8") !== experience) {
  throw new Error(`Nelly experience ${date} is immutable and differs from the supplied conversation.`);
}
if (!existsSync(experiencePath)) writeFileSync(experiencePath, experience);

const appendOnce = (path, marker, entry) => {
  const current = readFileSync(path, "utf8");
  if (!current.includes(marker)) writeFileSync(path, `${current.trimEnd()}\n${entry}`);
};
appendOnce(resolve(wikiRoot, "index.md"), `[[experiences/${date}]]`, `- [[experiences/${date}]] — ${recommendation}: ${compact(question, 180)}\n`);
appendOnce(resolve(wikiRoot, "beliefs.md"), `## ${date}`, `\n## ${date}\n\n- **Provisional belief:** ${compact(closing)}\n- **Why it entered memory:** ${challenged}\n- **Source:** [[experiences/${date}]]\n- **Confidence:** provisional\n`);
appendOnce(resolve(wikiRoot, "log.md"), `## ${date} — experience recorded`, `\n## ${date} — experience recorded\n\n- Added [[experiences/${date}]] from the shared dated conversation.\n`);
console.log(`Nelly personal wiki updated: ${date}.`);
