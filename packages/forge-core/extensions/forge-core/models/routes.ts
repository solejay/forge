import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type ForgeRole = "default" | "quick" | "explore" | "plan" | "implement" | "review" | "commit";

export interface ModelRoute {
  provider?: string;
  model?: string;
  modelString?: string;
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  description?: string;
}

export type ModelRouteMap = Partial<Record<ForgeRole | string, ModelRoute>>;

const ROLE_ORDER: ForgeRole[] = ["default", "quick", "explore", "plan", "implement", "review", "commit"];

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

export function routeToModelArg(route: ModelRoute | null | undefined): string | null {
  if (!route) return null;
  if (route.modelString) return route.modelString;
  if (route.provider && route.model) return `${route.provider}/${route.model}`;
  if (route.model) return route.model;
  return null;
}

export function formatRoutes(routes: ModelRouteMap): string {
  const keys = Array.from(new Set([...ROLE_ORDER, ...Object.keys(routes)]));
  if (keys.length === 0) return "No model routes configured.";

  return keys
    .map((role) => {
      const route = routes[role];
      if (!route) return `${role}: not configured`;
      const model = routeToModelArg(route) ?? "current model";
      const thinking = route.thinkingLevel ? ` thinking=${route.thinkingLevel}` : "";
      const desc = route.description ? ` — ${route.description}` : "";
      return `${role}: ${model}${thinking}${desc}`;
    })
    .join("\n");
}

export function sampleModelRoutes(): ModelRouteMap {
  return {
    default: { modelString: "openrouter/openai/gpt-5.5", thinkingLevel: "high", description: "general coding" },
    quick: { modelString: "openrouter/openai/gpt-5.5-mini", thinkingLevel: "low", description: "small edits and summaries" },
    explore: { modelString: "openrouter/openai/gpt-5.5-mini", thinkingLevel: "medium", description: "cheap codebase exploration" },
    plan: { modelString: "openrouter/openai/gpt-5.5", thinkingLevel: "high", description: "planning contracts" },
    implement: { modelString: "openrouter/openai/gpt-5.5", thinkingLevel: "high", description: "implementation" },
    review: { modelString: "openrouter/anthropic/claude-sonnet-4.5", thinkingLevel: "high", description: "critical review" },
    commit: { modelString: "openrouter/openai/gpt-5.5-mini", thinkingLevel: "low", description: "commit messages and release notes" },
  };
}
