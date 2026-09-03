const forbidden = /\b(interviews?|contact|outreach|email|survey|recruit|users? (?:said|reported|want|felt)|customers? (?:said|reported|want)|market validated|proven demand|traction|revenue|traffic|purchase|spend|create an account|personal data|collect data|send messages?)\b/i;

export function validateAtlasAnalysis(value) {
  const keys = ["case_title", "human_question", "burden_hypothesis", "trust_risk", "no_software_alternative", "counter_test", "method_revision", "missing_evidence"];
  const errors = keys.filter((key) => typeof value?.[key] !== "string" || !value[key].trim());
  const text = JSON.stringify(value);
  if (forbidden.test(text)) errors.push("unsupported_or_forbidden_claim");
  if (/\b(users?|people|customers?|monitor|observ(?:e|ing)|feedback|outcomes?|success rates?)\b/i.test(value?.counter_test ?? "")) errors.push("human_or_external_counter_test");
  if (!/\b(?:fixture|source|document|audit|compare|inspect)\b/i.test(value?.counter_test ?? "")) errors.push("unbounded_counter_test");
  if (/\b(?:remains? unchanged|without modification|build (?:still )?passes)\b/i.test(value?.counter_test ?? "")) errors.push("trivial_counter_test");
  if (/^\s*(none|nothing|n\/a)\s*[.!]?\s*$/i.test(value?.missing_evidence ?? "")) errors.push("missing_evidence_none");
  return [...new Set(errors)];
}
