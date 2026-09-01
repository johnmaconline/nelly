export const nellyOllamaUrl =
  process.env.NELLY_OLLAMA_URL ?? "http://cor-che-lt-675.local:11434/v1";
export const nellyOllamaModel =
  process.env.NELLY_OLLAMA_MODEL ?? "nelly:latest";

const forbiddenAction =
  /\b(interviews?|contact|outreach|email|e-mail|direct message|\bDM\b|survey|recruit|usability test|observational study|editable checklist|(?:gather|analy[sz]e|collect) (?:user )?feedback|notifications?|send|submi(?:t|ssion)|user reports?|failure reports?|aggregate signals?|monitor changes|record (?:the )?(?:start|end|time|task)|observe (?:a|the|some|actual)|track (?:a|the|some|actual)|with \d+(?:-\d+)? (?:users|founders|people)|call (?:a|the|some)|asks? (?:a|the|some|users?|founders?|customers?)|purchase|spend|create an account)\b/i;
const inventedEvidence =
  /\b(users? (?:said|reported|want)|customers? (?:said|reported|want)|demand (?:exists|is proven)|market validated|traction|revenue increased|traffic increased)\b/i;

export function extractJsonObject(value) {
  const start = value.indexOf("{");
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return value.slice(start, index + 1);
  }
}

export function validateReview(review) {
  const errors = [];
  if (typeof review?.position !== "string" || !review.position.trim()) errors.push("position");
  for (const key of ["assumptions_challenged", "risks", "missing_evidence"]) {
    if (!Array.isArray(review?.[key]) || !review[key].length || review[key].some((item) => typeof item !== "string" || !item.trim())) errors.push(key);
  }
  if (!Array.isArray(review?.alternative_ideas) || !review.alternative_ideas.length) errors.push("alternative_ideas");
  else {
    for (const idea of review.alternative_ideas) {
      if (!["title", "rationale", "test", "missing_evidence"].every((key) => typeof idea?.[key] === "string" && idea[key].trim())) errors.push("alternative_idea_fields");
    }
  }
  if (!["title", "next_test", "reason"].every((key) => typeof review?.recommendation?.[key] === "string" && review.recommendation[key].trim())) errors.push("recommendation");

  const text = JSON.stringify(review);
  const proposedActions = [
    review?.recommendation?.next_test,
    ...(review?.alternative_ideas ?? []).flatMap((idea) => [idea?.title, idea?.rationale, idea?.test]),
  ].filter(Boolean).join("\n");
  if (forbiddenAction.test(proposedActions)) errors.push("forbidden_action");
  const tests = [review?.recommendation?.next_test, ...(review?.alternative_ideas ?? []).map((idea) => idea?.test)].filter(Boolean);
  if (tests.some((test) => !/\b(repository|source|build|HTTP|static|document|audit|inspect|compare|fixture|schema|test)\b/i.test(test))) errors.push("unbounded_test");
  if (inventedEvidence.test(text)) errors.push("invented_evidence");
  if (/^\s*(none|nothing|n\/a)\s*[.!]?\s*$/i.test(review?.missing_evidence?.join(" ") ?? "")) errors.push("missing_evidence_none");
  return [...new Set(errors)];
}
