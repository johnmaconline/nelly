#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { nellyOllamaModel, nellyOllamaUrl } from "./nelly-core.mjs";

const root = resolve(import.meta.dirname, "..");
const date = process.env.WALLY_RUN_DATE ?? new Date().toISOString().slice(0, 10);
const postsPath = resolve(root, "journal/posts.json");
const casePath = resolve(root, `work/boundary-atlas/${date}.md`);
if (!existsSync(casePath)) throw new Error(`Nelly cannot publish without Boundary Atlas case ${date}.`);
const source = readFileSync(casePath, "utf8");
const current = JSON.parse(readFileSync(postsPath, "utf8"));
if (current.some((post) => post.date === date)) throw new Error(`Nelly post ${date} already exists.`);

const oneLine = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const heading = (name, next) => {
  const start = source.indexOf(`## ${name}`);
  const end = next ? source.indexOf(`## ${next}`, start + 1) : source.length;
  return start < 0 ? "" : source.slice(start + name.length + 4, end < 0 ? source.length : end).trim();
};
const title = source.match(/^# (.+)$/m)?.[1] ?? `Boundary note — ${date}`;
const question = oneLine(heading("Nelly's question", "Hypotheses—not observations"));
const hypotheses = heading("Hypotheses—not observations", "No-software alternative");
const burden = oneLine(hypotheses.match(/\*\*Burden:\*\* (.+)/)?.[1]);
const trust = oneLine(hypotheses.match(/\*\*Trust risk:\*\* (.+)/)?.[1]);
const alternative = oneLine(heading("No-software alternative", "Bounded counter-test"));
const counterTest = oneLine(heading("Bounded counter-test", "Method revision"));
const method = oneLine(heading("Method revision", "Missing evidence"));
const missing = oneLine(heading("Missing evidence"));
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

let post;
if (weekday !== "Sunday") {
  post = {
    date, type: "DAILY NOTE", title, dek: question,
    body: [
      `Today I worked from Wally's latest artifact and stayed with one question: ${question}`,
      `My burden hypothesis is deliberately provisional: ${burden} The related trust risk is also a hypothesis, not an observed reaction: ${trust}`,
      `I kept the no-software option on the table: ${alternative}`,
      `The next useful move is narrower than a product launch. ${counterTest}`,
      `This changed my method in one specific way: ${method}`,
      `What I still do not know: ${missing}`,
    ],
    decision: method,
    evidence: "A source-linked Boundary Atlas case over a verified repository artifact. No human use, demand, or outcome is established.",
    caseUrl: `https://github.com/johnmaconline/nelly/blob/main/work/boundary-atlas/${date}.md`,
  };
} else {
  const monday = new Date(`${date}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - 6);
  const weeklySources = current.filter((item) => item.date >= monday.toISOString().slice(0, 10)).map((item) => ({ date: item.date, title: item.title, body: item.body, decision: item.decision, evidence: item.evidence }));
  weeklySources.push({ date, title, question, burden, trust, alternative, counterTest, method, missing });
  const sections = [];
  for (let part = 1; part <= 4; part += 1) {
    const response = await fetch(`${nellyOllamaUrl}/chat/completions`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: nellyOllamaModel, messages: [{ role: "user", content: `You are Nelly writing section ${part} of 4 of a Sunday essay about your own recorded work this week. Write 180-240 plainspoken first-person words. Section ${part} must add a distinct idea. Use only the supplied source record. Never invent people, use, feelings, feedback, traffic, demand, outcomes, research, or events. Clearly distinguish your hypotheses from observed repository facts. Return prose only.\n\nSOURCE RECORD:\n${JSON.stringify(weeklySources)}` }], max_tokens: 430, temperature: 0.55 }),
      signal: AbortSignal.timeout(90_000),
    });
    const output = (await response.json())?.choices?.[0]?.message?.content?.trim();
    if (!response.ok || !output || /users? (?:said|reported)|customers?|market validated|traffic|revenue/i.test(output)) throw new Error(`Nelly Sunday section ${part} failed its evidence gate.`);
    sections.push(output);
  }
  post = {
    date, type: "SUNDAY ESSAY", title: `The week I kept asking what the build leaves out`,
    dek: "A weekly synthesis of the boundaries, alternatives, and unanswered questions in my recorded work.",
    body: sections, decision: method,
    evidence: "A synthesis of this week's source-linked Boundary Atlas cases. Internal reasoning is not external evidence.",
    caseUrl: `https://github.com/johnmaconline/nelly/tree/main/work/boundary-atlas`,
  };
}

writeFileSync(postsPath, `${JSON.stringify([post, ...current], null, 2)}\n`);
console.log(`Nelly ${post.type.toLowerCase()} written: ${date}.`);
