#!/usr/bin/env node
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { $ } from "bun";

const root = new URL("../", import.meta.url);
const driftTextUrl = new URL("packages/forge-core/extensions/forge-core/hooks/drift-text.ts", root);
const classifierUrl = new URL("packages/forge-core/extensions/forge-core/routing/classifier.ts", root);

const { normalizeDriftObservationText, detectScopeExpansionSignals } = await import(driftTextUrl.href);
const { classifyTask, compareClassification } = await import(classifierUrl.href);

const falsePositiveText = `## Forge Drift Detected

Task: unknown
Original: feature / low
Current: refactor / high

Signals:
- Task type changed from feature to refactor
- Complexity increased from low to high
- Scope expansion phrase: turns out we also need...
- Scope expansion phrase: need to refactor
- API contract scope expansion detected
- Data model scope expansion detected
- Architecture drift phrase detected

Choose: continue, replan, or stop.

Human decision: continue.`;

const normalized = normalizeDriftObservationText(falsePositiveText);
assert.equal(normalized, "", "Forge drift control text should be stripped before classification");
assert.deepEqual(detectScopeExpansionSignals(falsePositiveText), [], "Forge drift control text should not emit scope signals");
assert.deepEqual(
  detectScopeExpansionSignals("The Forge drift detector false-positive saw an architecture change phrase in README docs."),
  [],
  "Meta-discussion about Forge drift should not emit scope signals",
);

const original = { type: "feature", complexity: "low", confidence: 0.95 };
const reclassifiedControl = classifyTask(normalized);
assert.deepEqual(
  compareClassification(original, reclassifiedControl).signals,
  [],
  "Stripped control text should not create type/complexity drift",
);

const realScopeExpansion = "Turns out we also need to refactor. This requires a larger refactor. We need to change the API and need to change the data model because this requires a larger architecture change.";
assert.deepEqual(
  detectScopeExpansionSignals(realScopeExpansion),
  [
    "Scope expansion phrase: turns out we also need...",
    "Scope expansion phrase: requires larger refactor/rewrite",
    "Architecture drift phrase detected",
    "API contract scope expansion detected",
    "Data model scope expansion detected",
  ],
  "Real scope expansion text should still produce drift signals",
);

const runtime = await Bun.file(new URL("packages/forge-core/extensions/forge-core/hooks/drift-runtime.ts", root)).text();
assert.match(runtime, /Forge drift was accepted and the task is unblocked\./, "Continue path should send an explicit resume prompt");
assert.match(runtime, /Continue from the current Forge plan step/, "Continue prompt should tell the agent what to do next");

await $`bun --check ${new URL("packages/forge-core/extensions/forge-core/hooks/drift-runtime.ts", root).pathname} ${driftTextUrl.pathname}`.quiet();

console.log("drift regression checks passed");
