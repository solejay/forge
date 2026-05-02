import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Api, Model } from "@mariozechner/pi-ai";

export type ForgeRole = "default" | "quick" | "explore" | "plan" | "implement" | "review" | "commit";
export type RouteFallback = "current" | "default" | "none";
export type RouteCapability = "general" | "cheap-fast" | "strong-reasoning" | "coding" | "long-context" | "vision" | string;

export interface ModelRoute {
  /** Exact provider/model identifier. Preserved for backward compatibility. */
  provider?: string;
  /** Exact model id. When provider is also set this resolves to provider/model. */
  model?: string;
  /** Exact provider/model string. Preserved for backward compatibility. */
  modelString?: string;
  /** Capability profile to discover from authenticated available models. */
  capability?: RouteCapability;
  /** Require the model to advertise reasoning support. */
  requireReasoning?: boolean;
  /** Minimum context window in tokens. */
  minContextWindow?: number;
  /** Minimum output token limit. */
  minMaxTokens?: number;
  /** Required input modalities. Defaults to text-only compatibility. */
  input?: Array<"text" | "image">;
  /** Maximum input cost. Uses pi model metadata units as-is. */
  maxInputCost?: number;
  /** Maximum output cost. Uses pi model metadata units as-is. */
  maxOutputCost?: number;
  /** Ordered glob-ish preferences matched against provider/id/name. */
  prefer?: string[];
  /** Glob-ish patterns to penalize or reject only if paired with strict constraints elsewhere. */
  avoid?: string[];
  /** Fallback behavior when no exact/capable model is found. Defaults to current. */
  fallback?: RouteFallback;
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  description?: string;
}

export type ModelRouteMap = Partial<Record<ForgeRole | string, ModelRoute>>;
export type AnyModel = Model<Api>;

export interface ModelRegistryLike {
  getAvailable(): AnyModel[];
  getAll(): AnyModel[];
  find(provider: string, modelId: string): AnyModel | undefined;
}

export interface CandidateScore {
  model: AnyModel;
  modelArg: string;
  score: number;
  reasons: string[];
}

export interface ModelRouteResolution {
  role: string;
  route: ModelRoute | null;
  sources: string[];
  modelArg: string | null;
  selectedModel: AnyModel | null;
  thinkingLevel?: ModelRoute["thinkingLevel"];
  resolution: "explicit" | "exact" | "capability" | "fallback_current" | "none";
  reason: string;
  requestedModelArg?: string;
  candidates: CandidateScore[];
}

interface EffectiveCapabilityRoute extends ModelRoute {
  capability: RouteCapability;
}

const ROLE_ORDER: ForgeRole[] = ["default", "quick", "explore", "plan", "implement", "review", "commit"];

const CAPABILITY_PROFILES: Record<string, ModelRoute> = {
  general: {
    capability: "general",
    input: ["text"],
    prefer: ["*sonnet*", "*gpt*", "*gemini*", "*claude*"],
  },
  "cheap-fast": {
    capability: "cheap-fast",
    input: ["text"],
    prefer: ["*mini*", "*flash*", "*haiku*", "*small*", "*lite*"],
    avoid: ["*opus*"],
  },
  "strong-reasoning": {
    capability: "strong-reasoning",
    requireReasoning: true,
    minContextWindow: 100_000,
    input: ["text"],
    prefer: ["*sonnet*", "*claude*", "*gpt-5*", "*gpt-4.1*", "*gemini*pro*", "*opus*"],
  },
  coding: {
    capability: "coding",
    minContextWindow: 64_000,
    input: ["text"],
    prefer: ["*sonnet*", "*claude*", "*gpt*", "*gemini*pro*", "*coder*"],
  },
  "long-context": {
    capability: "long-context",
    minContextWindow: 200_000,
    input: ["text"],
    prefer: ["*gemini*", "*claude*", "*gpt*", "*long*"],
  },
  vision: {
    capability: "vision",
    input: ["text", "image"],
    prefer: ["*gpt*", "*gemini*", "*claude*", "*vision*"],
  },
};

const ROLE_DEFAULT_CAPABILITIES: Partial<Record<ForgeRole, RouteCapability>> = {
  quick: "cheap-fast",
  explore: "cheap-fast",
  plan: "strong-reasoning",
  implement: "coding",
  review: "strong-reasoning",
  commit: "cheap-fast",
};

export function loadModelRoutes(cwd: string): { routes: ModelRouteMap; sources: string[] } {
  const candidates = [
    resolve(cwd, "pipeline/model-routes.json"),
    resolve(cwd, ".forge/model-routes.json"),
  ];

  const routes: ModelRouteMap = {};
  const sources: string[] = [];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as ModelRouteMap;
      Object.assign(routes, parsed);
      sources.push(path);
    } catch {
      // Ignore invalid route files. forge_model_route reports absence/safe defaults.
    }
  }

  return { routes, sources };
}

/**
 * Legacy resolver kept for callers that only need the configured exact model string.
 * Capability-aware callers should use resolveModelRoute().
 */
export function getRouteForRole(cwd: string, role: string | undefined, explicitModel?: string): {
  role: string;
  route: ModelRoute | null;
  modelArg: string | null;
  sources: string[];
} {
  const resolvedRole = role || "default";
  const { routes, sources } = loadModelRoutes(cwd);
  const route = routes[resolvedRole] ?? routes.default ?? null;
  const modelArg = explicitModel ?? routeToModelArg(route);
  return { role: resolvedRole, route, modelArg, sources };
}

export function resolveModelRoute(options: {
  cwd: string;
  role?: string;
  explicitModel?: string;
  modelRegistry: ModelRegistryLike;
  currentModel?: AnyModel;
}): ModelRouteResolution {
  const resolvedRole = options.role || "default";
  const { routes, sources } = loadModelRoutes(options.cwd);
  const route = routes[resolvedRole] ?? routes.default ?? null;
  const requestedModelArg = options.explicitModel ?? routeToModelArg(route);

  if (requestedModelArg) {
    const exact = findModelByArg(options.modelRegistry, requestedModelArg, route?.provider);
    if (exact) {
      return {
        role: resolvedRole,
        route,
        sources,
        modelArg: modelToArg(exact),
        selectedModel: exact,
        thinkingLevel: route?.thinkingLevel,
        resolution: options.explicitModel ? "explicit" : "exact",
        reason: options.explicitModel ? "explicit_model_override" : "exact_route_match",
        requestedModelArg,
        candidates: [],
      };
    }

    if (options.explicitModel || !hasCapabilityRequirements(route)) {
      return fallbackResolution({
        role: resolvedRole,
        route,
        sources,
        currentModel: options.currentModel,
        requestedModelArg,
        reason: "exact_model_not_found",
      });
    }
  }

  if (hasCapabilityRequirements(route)) {
    const candidates = rankCapabilityCandidates(options.modelRegistry.getAvailable(), buildEffectiveCapabilityRoute(resolvedRole, route));
    const selected = candidates[0]?.model ?? null;
    if (selected) {
      return {
        role: resolvedRole,
        route,
        sources,
        modelArg: modelToArg(selected),
        selectedModel: selected,
        thinkingLevel: route?.thinkingLevel,
        resolution: "capability",
        reason: "capability_match",
        requestedModelArg,
        candidates: candidates.slice(0, 5),
      };
    }

    return fallbackResolution({
      role: resolvedRole,
      route,
      sources,
      currentModel: options.currentModel,
      requestedModelArg,
      reason: "no_capable_available_model",
      candidates,
    });
  }

  return fallbackResolution({
    role: resolvedRole,
    route,
    sources,
    currentModel: options.currentModel,
    requestedModelArg,
    reason: route ? "route_has_no_model_or_capability" : "no_route_configured",
  });
}

export function routeToModelArg(route: ModelRoute | null | undefined): string | null {
  if (!route) return null;
  if (route.modelString) return route.modelString;
  if (route.provider && route.model) return `${route.provider}/${route.model}`;
  if (route.model) return route.model;
  return null;
}

export function parseModelArg(modelArg: string, providerHint?: string): { provider: string; model: string } | null {
  if (providerHint && !modelArg.includes("/")) return { provider: providerHint, model: modelArg };
  const slash = modelArg.indexOf("/");
  if (slash <= 0 || slash >= modelArg.length - 1) return null;
  return { provider: modelArg.slice(0, slash), model: modelArg.slice(slash + 1) };
}

export function modelToArg(model: AnyModel): string {
  return `${String(model.provider)}/${model.id}`;
}

export function formatRoutes(routes: ModelRouteMap): string {
  const keys = Array.from(new Set([...ROLE_ORDER, ...Object.keys(routes)]));
  if (keys.length === 0) return "No model routes configured.";

  return keys
    .map((role) => {
      const route = routes[role];
      if (!route) return `${role}: not configured`;
      const exact = routeToModelArg(route);
      const capability = formatCapabilityTarget(role, route);
      const model = exact ?? capability ?? "current model";
      const thinking = route.thinkingLevel ? ` thinking=${route.thinkingLevel}` : "";
      const desc = route.description ? ` — ${route.description}` : "";
      return `${role}: ${model}${thinking}${desc}`;
    })
    .join("\n");
}

export function formatRouteResolution(resolution: ModelRouteResolution): string {
  const selected = resolution.modelArg ?? "current model";
  const requested = resolution.requestedModelArg && resolution.requestedModelArg !== resolution.modelArg
    ? ` requested=${resolution.requestedModelArg}`
    : "";
  const candidates = resolution.candidates.length > 0
    ? ` candidates=${resolution.candidates.map((candidate) => `${candidate.modelArg}(${Math.round(candidate.score)})`).join(", ")}`
    : "";
  return `${selected} via ${resolution.resolution} (${resolution.reason})${requested}${candidates}`;
}

export function sampleModelRoutes(): ModelRouteMap {
  return {
    default: { capability: "coding", thinkingLevel: "medium", description: "general coding from available authenticated models" },
    quick: { capability: "cheap-fast", thinkingLevel: "low", description: "small edits and summaries" },
    explore: { capability: "cheap-fast", minContextWindow: 32_000, thinkingLevel: "medium", description: "cheap codebase exploration" },
    plan: { capability: "strong-reasoning", thinkingLevel: "high", description: "planning contracts" },
    implement: { capability: "coding", thinkingLevel: "high", description: "implementation" },
    review: { capability: "strong-reasoning", thinkingLevel: "high", description: "critical review" },
    commit: { capability: "cheap-fast", thinkingLevel: "low", description: "commit messages and release notes" },
  };
}

function hasCapabilityRequirements(route: ModelRoute | null | undefined): route is ModelRoute {
  return Boolean(route && (
    route.capability ||
    route.requireReasoning !== undefined ||
    route.minContextWindow !== undefined ||
    route.minMaxTokens !== undefined ||
    route.input !== undefined ||
    route.maxInputCost !== undefined ||
    route.maxOutputCost !== undefined ||
    route.prefer !== undefined ||
    route.avoid !== undefined
  ));
}

function buildEffectiveCapabilityRoute(role: string, route: ModelRoute): EffectiveCapabilityRoute {
  const roleDefault = ROLE_DEFAULT_CAPABILITIES[role as ForgeRole] ?? "general";
  const capability = route.capability ?? roleDefault;
  const profile = CAPABILITY_PROFILES[capability] ?? CAPABILITY_PROFILES.general;
  return {
    ...profile,
    ...route,
    capability,
    prefer: [...(profile.prefer ?? []), ...(route.prefer ?? [])],
    avoid: [...(profile.avoid ?? []), ...(route.avoid ?? [])],
  };
}

function rankCapabilityCandidates(models: AnyModel[], route: EffectiveCapabilityRoute): CandidateScore[] {
  return models
    .map((model) => scoreCandidate(model, route))
    .filter((candidate): candidate is CandidateScore => Boolean(candidate))
    .sort((a, b) => b.score - a.score || a.modelArg.localeCompare(b.modelArg));
}

function scoreCandidate(model: AnyModel, route: EffectiveCapabilityRoute): CandidateScore | null {
  const reasons: string[] = [];
  let score = 0;

  if (route.requireReasoning && !model.reasoning) return null;
  if (route.minContextWindow !== undefined && model.contextWindow < route.minContextWindow) return null;
  if (route.minMaxTokens !== undefined && model.maxTokens < route.minMaxTokens) return null;
  if (route.maxInputCost !== undefined && model.cost.input > route.maxInputCost) return null;
  if (route.maxOutputCost !== undefined && model.cost.output > route.maxOutputCost) return null;
  if (route.input?.some((required) => !model.input.includes(required))) return null;

  if (model.reasoning) {
    score += 20;
    reasons.push("reasoning");
  }

  score += Math.min(30, Math.log10(Math.max(model.contextWindow, 1)) * 6);
  score += Math.min(10, Math.log10(Math.max(model.maxTokens, 1)) * 2);

  const cost = model.cost.input + model.cost.output;
  if (route.capability === "cheap-fast") {
    score += Math.max(0, 30 - cost);
    reasons.push("cheap");
  } else {
    score += Math.max(0, 10 - cost / 2);
  }

  const haystack = modelSearchText(model);
  const preferIndex = firstPatternIndex(route.prefer ?? [], haystack);
  if (preferIndex >= 0) {
    score += 100 - preferIndex * 5;
    reasons.push(`prefer:${route.prefer?.[preferIndex]}`);
  }

  const avoidIndex = firstPatternIndex(route.avoid ?? [], haystack);
  if (avoidIndex >= 0) {
    score -= 50;
    reasons.push(`avoid:${route.avoid?.[avoidIndex]}`);
  }

  return { model, modelArg: modelToArg(model), score, reasons };
}

function findModelByArg(modelRegistry: ModelRegistryLike, modelArg: string, providerHint?: string): AnyModel | null {
  const parsed = parseModelArg(modelArg, providerHint);
  if (parsed) return modelRegistry.find(parsed.provider, parsed.model) ?? null;

  const matches = modelRegistry.getAll().filter((model) => model.id === modelArg || modelToArg(model) === modelArg);
  return matches.length === 1 ? matches[0] : null;
}

function fallbackResolution(options: {
  role: string;
  route: ModelRoute | null;
  sources: string[];
  currentModel?: AnyModel;
  requestedModelArg?: string;
  reason: string;
  candidates?: CandidateScore[];
}): ModelRouteResolution {
  const fallback = options.route?.fallback ?? "current";
  if (fallback === "current" && options.currentModel) {
    return {
      role: options.role,
      route: options.route,
      sources: options.sources,
      modelArg: null,
      selectedModel: options.currentModel,
      thinkingLevel: options.route?.thinkingLevel,
      resolution: "fallback_current",
      reason: options.reason,
      requestedModelArg: options.requestedModelArg,
      candidates: options.candidates?.slice(0, 5) ?? [],
    };
  }

  return {
    role: options.role,
    route: options.route,
    sources: options.sources,
    modelArg: null,
    selectedModel: null,
    thinkingLevel: options.route?.thinkingLevel,
    resolution: "none",
    reason: options.reason,
    requestedModelArg: options.requestedModelArg,
    candidates: options.candidates?.slice(0, 5) ?? [],
  };
}

function formatCapabilityTarget(role: string, route: ModelRoute): string | null {
  if (!hasCapabilityRequirements(route)) return null;
  const capability = route.capability ?? ROLE_DEFAULT_CAPABILITIES[role as ForgeRole] ?? "general";
  const parts = [`capability=${capability}`];
  if (route.requireReasoning) parts.push("reasoning");
  if (route.minContextWindow) parts.push(`ctx>=${route.minContextWindow}`);
  if (route.minMaxTokens) parts.push(`out>=${route.minMaxTokens}`);
  if (route.input?.length) parts.push(`input=${route.input.join("+")}`);
  if (route.maxInputCost !== undefined) parts.push(`inCost<=${route.maxInputCost}`);
  if (route.maxOutputCost !== undefined) parts.push(`outCost<=${route.maxOutputCost}`);
  if (route.prefer?.length) parts.push(`prefer=${route.prefer.join("|")}`);
  return parts.join(" ");
}

function modelSearchText(model: AnyModel): string {
  return `${String(model.provider)}/${model.id} ${model.name}`.toLowerCase();
}

function firstPatternIndex(patterns: string[], haystack: string): number {
  return patterns.findIndex((pattern) => globMatch(pattern, haystack));
}

function globMatch(pattern: string, haystack: string): boolean {
  const normalized = pattern.toLowerCase();
  if (!normalized.includes("*")) return haystack.includes(normalized);
  const escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(escaped).test(haystack);
}
