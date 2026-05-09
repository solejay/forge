const SCOPE_EXPANSION_PATTERNS: Array<[RegExp, string]> = [
  [/turns out (we|i) (also )?need/gi, "Scope expansion phrase: turns out we also need..."],
  [/this requires (a )?(larger|bigger|broader) (refactor|rewrite|change)/gi, "Scope expansion phrase: requires larger refactor/rewrite"],
  [/we need to refactor/gi, "Scope expansion phrase: need to refactor"],
  [/i need to refactor/gi, "Scope expansion phrase: need to refactor"],
  [/architectur(al|e) (change|issue|problem)/gi, "Architecture drift phrase detected"],
  [/not just (a )?(bug|fix|typo)/gi, "Task is no longer just the original small scope"],
  [/this is (actually|really) (a )?(feature|refactor|architecture)/gi, "Task type recharacterized mid-flight"],
  [/requires touching multiple (modules|features|layers)/gi, "Multiple-layer scope expansion detected"],
  [/need to change the API/gi, "API contract scope expansion detected"],
  [/need to change the data model/gi, "Data model scope expansion detected"],
];

const FORGE_CONTROL_HEADINGS = new Set(["Forge Drift Detected", "Forge Auto-Plan"]);

/**
 * Remove Forge control-plane text before drift classification.
 *
 * Drift runtime should classify the user's task and the agent's own scope observations,
 * not Forge's generated escalation summaries, auto-plan routing block, or quoted examples.
 */
export function normalizeDriftObservationText(text: string): string {
  let cleaned = String(text ?? "");
  const hasForgeControlMarker = containsForgeControlMarker(cleaned);

  cleaned = stripFencedCodeBlocks(cleaned);
  cleaned = stripForgeControlSections(cleaned);

  if (hasForgeControlMarker) {
    cleaned = cleaned
      .split(/\r?\n/)
      .filter((line) => !isForgeControlLine(line))
      .join("\n");
  }

  return cleaned
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function detectScopeExpansionSignals(text: string): string[] {
  const signals: string[] = [];
  const normalized = normalizeDriftObservationText(text);
  if (!normalized || isForgeDriftMetaDiscussion(normalized)) return signals;

  for (const [pattern, reason] of SCOPE_EXPANSION_PATTERNS) {
    if (pattern.test(normalized)) signals.push(reason);
    pattern.lastIndex = 0;
  }
  return signals;
}

function stripFencedCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "");
}

function stripForgeControlSections(text: string): string {
  const output: string[] = [];
  let skipping = false;

  for (const line of text.split(/\r?\n/)) {
    const heading = parseMarkdownHeading(line);
    if (heading && FORGE_CONTROL_HEADINGS.has(heading.title)) {
      skipping = true;
      continue;
    }

    if (skipping) {
      if (!line.trim() || isForgeControlLine(line)) continue;
      skipping = false;
    }

    output.push(line);
  }

  return output.join("\n");
}

function parseMarkdownHeading(line: string): { level: number; title: string } | null {
  const match = /^\s*(#{1,6})\s+(.+?)\s*$/.exec(stripMarkdownQuotePrefix(line));
  if (!match) return null;
  return { level: match[1].length, title: match[2].trim() };
}

function containsForgeControlMarker(text: string): boolean {
  return /(^|\n)\s*>?\s*## Forge (Drift Detected|Auto-Plan)\b/.test(text)
    || /(^|\n)\s*>?\s*Forge drift was detected\./i.test(text)
    || /(^|\n)\s*>?\s*Forge state loaded from pipeline\/state\.json\b/i.test(text)
    || /(^|\n)\s*>?\s*Human decision:\s*(continue|replan|stop)\.?\s*$/im.test(text);
}

function isForgeDriftMetaDiscussion(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("forge drift")
    || lower.includes("drift detector")
    || lower.includes("drift detection")
    || lower.includes("drift runtime")
    || (lower.includes("false positive") && lower.includes("drift"));
}

function isForgeControlLine(line: string): boolean {
  const trimmed = stripMarkdownQuotePrefix(line).trim();
  return /^#{1,6}\s+Forge (Drift Detected|Auto-Plan)\b/i.test(trimmed)
    || /^Forge drift was detected\./i.test(trimmed)
    || /^Forge state loaded from pipeline\/state\.json\b/i.test(trimmed)
    || /^Choose:\s*continue,\s*replan,\s*or\s*stop\.?$/i.test(trimmed)
    || /^Human decision:\s*(continue|replan|stop)\.?$/i.test(trimmed)
    || /^Task:\s*/i.test(trimmed)
    || /^Original:\s*/i.test(trimmed)
    || /^Current:\s*/i.test(trimmed)
    || /^Signals:\s*$/i.test(trimmed)
    || /^Detected task intent:\s*/i.test(trimmed)
    || /^Use the forge-plan skill first/i.test(trimmed)
    || /^Create or update the plan contract/i.test(trimmed)
    || /^After the plan contract is written/i.test(trimmed)
    || /^-\s*(Task type changed from|Complexity increased from|Scope expansion phrase:|API contract scope expansion detected|Data model scope expansion detected|Architecture drift phrase detected|Mutation fan-out:|High mutation count:|Execution exceeded planned shape:)/i.test(trimmed);
}

function stripMarkdownQuotePrefix(line: string): string {
  return line.replace(/^\s*>\s?/, "");
}
