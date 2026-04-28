import type { Classification, Complexity } from "../state/schema.js";

export type TaskType =
  | "bug"
  | "feature"
  | "refactor"
  | "design"
  | "performance"
  | "accessibility"
  | "deployment"
  | "research"
  | "unknown";

const taskSignals: Record<Exclude<TaskType, "unknown">, Array<[string, number]>> = {
  bug: [
    ["bug", 3],
    ["fix", 2],
    ["broken", 3],
    ["error", 2],
    ["failing", 2],
    ["crash", 3],
    ["regression", 3],
    ["doesn't work", 3],
    ["not working", 3],
  ],
  feature: [
    ["add", 2],
    ["build", 2],
    ["implement", 2],
    ["create", 2],
    ["new feature", 4],
    ["feature", 3],
    ["support", 2],
    ["enable", 2],
  ],
  refactor: [
    ["refactor", 4],
    ["restructure", 4],
    ["architecture", 3],
    ["cleanup", 2],
    ["decouple", 3],
    ["modularize", 3],
    ["rewrite", 3],
    ["migrate", 3],
  ],
  design: [
    ["design", 3],
    ["ui", 2],
    ["ux", 2],
    ["mockup", 3],
    ["style guide", 4],
    ["screen", 2],
    ["visual", 2],
    ["prototype", 3],
  ],
  performance: [
    ["performance", 4],
    ["slow", 3],
    ["jank", 4],
    ["latency", 3],
    ["memory", 2],
    ["optimize", 3],
    ["launch time", 4],
    ["bundle size", 3],
  ],
  accessibility: [
    ["accessibility", 4],
    ["a11y", 4],
    ["voiceover", 4],
    ["talkback", 4],
    ["dynamic type", 4],
    ["wcag", 4],
    ["contrast", 3],
  ],
  deployment: [
    ["deploy", 4],
    ["release", 3],
    ["ship", 3],
    ["testflight", 4],
    ["play store", 4],
    ["production", 3],
    ["beta", 2],
  ],
  research: [
    ["research", 4],
    ["investigate", 3],
    ["explore", 3],
    ["study", 3],
    ["look up", 3],
    ["find", 1],
    ["compare", 2],
  ],
};

const complexitySignals: Record<Exclude<Complexity, null>, Array<[string, number]>> = {
  trivial: [
    ["typo", 4],
    ["one-line", 4],
    ["one line", 4],
    ["small", 1],
    ["quick", 1],
  ],
  low: [
    ["simple", 2],
    ["small", 2],
    ["minor", 2],
    ["single file", 3],
  ],
  medium: [
    ["feature", 2],
    ["flow", 2],
    ["integration", 3],
    ["multiple files", 3],
    ["screen", 2],
  ],
  high: [
    ["architecture", 4],
    ["migration", 4],
    ["rewrite", 4],
    ["cross-platform", 4],
    ["both platforms", 4],
    ["security", 3],
    ["large", 3],
    ["system", 2],
  ],
  unknown: [],
};

export function classifyTask(text: string): Classification {
  const prompt = text.toLowerCase();
  const typeScores: Record<string, number> = {};
  for (const [type, signals] of Object.entries(taskSignals)) {
    typeScores[type] = scoreSignals(signals, prompt);
  }

  const sortedTypes = Object.entries(typeScores).sort((a, b) => b[1] - a[1]);
  const [topType, topTypeScore] = sortedTypes[0] ?? ["unknown", 0];
  const [, secondTypeScore] = sortedTypes[1] ?? ["unknown", 0];

  const complexityScores: Record<string, number> = {};
  for (const [complexity, signals] of Object.entries(complexitySignals)) {
    complexityScores[complexity] = scoreSignals(signals, prompt);
  }

  const complexity = inferComplexity(complexityScores, prompt);
  const confidence = topTypeScore <= 0
    ? 0.25
    : Math.min(0.95, 0.45 + topTypeScore * 0.1 + Math.max(0, topTypeScore - secondTypeScore) * 0.05);

  return {
    type: topTypeScore > 0 ? topType : "unknown",
    complexity,
    confidence: Number(confidence.toFixed(2)),
    scores: {
      task: typeScores,
      complexity: complexityScores,
    },
  };
}

export function compareClassification(original: Classification | null, next: Classification): {
  changed: boolean;
  signals: string[];
} {
  const signals: string[] = [];
  if (!original?.type || original.type === "unknown") return { changed: false, signals };

  if (next.type && next.type !== "unknown" && next.type !== original.type) {
    signals.push(`Task type changed from ${original.type} to ${next.type}`);
  }

  if (isComplexitySpike(original.complexity, next.complexity)) {
    signals.push(`Complexity increased from ${original.complexity ?? "unknown"} to ${next.complexity ?? "unknown"}`);
  }

  return { changed: signals.length > 0, signals };
}

function scoreSignals(signals: Array<[string, number]>, prompt: string): number {
  let total = 0;
  for (const [pattern, weight] of signals) {
    if (prompt.includes(pattern)) total += weight;
  }
  return total;
}

function inferComplexity(scores: Record<string, number>, prompt: string): Complexity {
  if (scores.high >= 4) return "high";
  if (scores.medium >= 3) return "medium";
  if (scores.low >= 2) return "low";
  if (scores.trivial >= 3) return "trivial";

  const words = prompt.split(/\s+/).filter(Boolean).length;
  if (words > 120) return "medium";
  if (words > 45) return "low";
  return "unknown";
}

function isComplexitySpike(previous: Complexity | null, next: Complexity | null): boolean {
  const rank: Record<string, number> = { trivial: 0, low: 1, medium: 2, high: 3, unknown: -1 };
  const prevRank = rank[previous ?? "unknown"] ?? -1;
  const nextRank = rank[next ?? "unknown"] ?? -1;
  if (prevRank < 0 || nextRank < 0) return false;
  return nextRank - prevRank >= 2;
}
