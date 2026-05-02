/**
 * agents.ts — Agent persona loader and [FILTERED_INSTRUCTION] injection
 *
 * Loads the 4 mobile agent persona files (ios-engineer, ios-debugger,
 * android-engineer, android-debugger) and provides:
 *
 * 1. [FILTERED_INSTRUCTION] injection via before_agent_start — injects the appropriate
 *    persona based on keyword routing scores
 * 2. A delegate_to_agent tool that spawns focused pi sub-agents with the
 *    full persona as [FILTERED_INSTRUCTION] (for parallel or isolated tasks)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum, type Api, type Model } from "@mariozechner/pi-ai";
import { Type } from "typebox";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { scorePrompt } from "./routing.js";
import { fileURLToPath } from "node:url";

const AGENT_NAMES = ["ios-engineer", "ios-debugger", "android-engineer", "android-debugger"] as const;
type AgentName = (typeof AGENT_NAMES)[number];

const ISOLATION_MODES = ["none", "worktree"] as const;
type IsolationMode = (typeof ISOLATION_MODES)[number];

interface CreatedWorktree {
  path: string;
  branch: string;
  baseBranch: string;
  cleanupCommand: string;
}

/**
 * Load an agent persona markdown file and strip YAML frontmatter,
 * returning only the body content.
 */
function loadPersona(agentsDir: string, name: AgentName): string {
  const filePath = resolve(agentsDir, `${name}.md`);
  try {
    const raw = readFileSync(filePath, "utf-8");
    // Strip YAML frontmatter (--- ... ---)
    const match = raw.match(/^---\s*\n[\s\S]*?\n---\s*\n([\s\S]*)$/);
    return match ? match[1].trim() : raw.trim();
  } catch {
    return `You are a ${name.replace(/-/g, " ")}.`;
  }
}

export function registerAgents(pi: ExtensionAPI) {
  // Resolve the agents/ directory relative to this extension
  // jiti provides __dirname; fallback to import.meta.url for native ESM
  const extensionDir = typeof __dirname !== "undefined"
    ? __dirname
    : resolve(fileURLToPath(import.meta.url), "..");
  const agentsDir = resolve(extensionDir, "../../agents");

  // Pre-load all personas
  const personas = new Map<AgentName, string>();
  for (const name of AGENT_NAMES) {
    personas.set(name, loadPersona(agentsDir, name));
  }

  // ─── [FILTERED_INSTRUCTION] injection ──────────────────────────────────────────
  // Inject the best-matching agent persona into the [FILTERED_INSTRUCTION]
  // based on keyword scoring of the user's prompt.

  pi.on("before_agent_start", async (event, _ctx) => {
    const scores = scorePrompt(event.prompt);

    let agentName: AgentName | null = null;

    // Determine best agent based on scores
    if (scores.isCrash && scores.isIosPrimary) {
      agentName = "ios-debugger";
    } else if (scores.isCrash && scores.isAndroidPrimary) {
      agentName = "android-debugger";
    } else if (scores.isAndroidDebug) {
      agentName = "android-debugger";
    } else if (scores.isIosPrimary) {
      agentName = "ios-engineer";
    } else if (scores.isAndroidPrimary) {
      agentName = "android-engineer";
    }

    if (!agentName) return;

    const persona = personas.get(agentName);
    if (!persona) return;

    return {
      systemPrompt:
        event.systemPrompt +
        `\n\n## Active Mobile Agent Persona: ${agentName}\n\n` +
        persona,
      message: {
        customType: "forge-mobile-routing",
        content: `[Routed to ${agentName}]`,
        display: true,
      },
    };
  });

  // ─── Delegate-to-agent tool ───────────────────────────────────────────
  // Spawns a focused pi sub-agent with a specific persona.
  // Useful for parallel tasks (mobile-split) or isolated debugging.

  pi.registerTool({
    name: "delegate_to_agent",
    label: "Delegate to Mobile Agent",
    description:
      "Spawn a focused sub-agent with a mobile specialist persona. " +
      "Use worktree isolation for parallel platform work so iOS and Android agents do not edit the same checkout. " +
      "The sub-agent runs in a separate pi process with the full persona as [FILTERED_INSTRUCTION].",
    promptSnippet: "Spawn a focused mobile sub-agent (ios-engineer, ios-debugger, android-engineer, android-debugger)",
    promptGuidelines: [
      "Use delegate_to_agent when mobile-split skill calls for parallel iOS + Android work.",
      "Use delegate_to_agent with isolation=worktree for parallel implementation tasks.",
      "Use delegate_to_agent with ios-debugger or android-debugger for crash triage tasks.",
      "Prefer direct implementation over delegation for simple single-platform changes.",
    ],
    parameters: Type.Object({
      agent: StringEnum(AGENT_NAMES as unknown as string[]),
      task: Type.String({ description: "Detailed task description for the sub-agent" }),
      cwd: Type.Optional(Type.String({ description: "Working directory for the sub-agent (defaults to current)" })),
      isolation: Type.Optional(StringEnum(ISOLATION_MODES as unknown as string[])),
      branchName: Type.Optional(Type.String({ description: "Optional branch name when isolation=worktree" })),
      parentDir: Type.Optional(Type.String({ description: "Optional parent directory for created worktrees" })),
      cleanupWorktree: Type.Optional(Type.Boolean({ description: "Remove clean worktree after run. Defaults to false." })),
      requireCleanBase: Type.Optional(Type.Boolean({ description: "Refuse worktree creation if base repo is dirty. Defaults to false." })),
      role: Type.Optional(Type.String({ description: "Forge model role for this sub-agent, e.g. implement, review, quick." })),
      model: Type.Optional(Type.String({ description: "Explicit model string override, e.g. provider/model-id." })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const agentName = params.agent as AgentName;
      const persona = personas.get(agentName);
      if (!persona) {
        throw new Error(`Unknown agent: ${agentName}`);
      }

      const baseCwd = params.cwd || ctx.cwd;
      const isolation = (params.isolation ?? "none") as IsolationMode;
      const modelRoute = getModelRouteForRole(baseCwd, params.role, params.model, ctx.modelRegistry, ctx.model);
      let runCwd = baseCwd;
      let worktree: CreatedWorktree | null = null;
      let cleanup: { cleaned: boolean; message: string } | null = null;

      if (isolation === "worktree") {
        onUpdate?.({ content: [{ type: "text", text: `Creating isolated worktree for ${agentName}...` }] });
        if (params.requireCleanBase && await hasDirtyWorkingTree(pi, baseCwd, signal)) {
          throw new Error("Base repository has uncommitted changes and requireCleanBase=true. Commit/stash first or set requireCleanBase=false.");
        }
        worktree = await createWorktree(pi, {
          baseCwd,
          taskName: `${agentName}-${params.task}`,
          branchName: params.branchName,
          parentDir: params.parentDir,
        }, signal);
        runCwd = worktree.path;
      }

      onUpdate?.({
        content: [{ type: "text", text: `Spawning ${agentName} sub-agent${worktree ? ` in ${worktree.path}` : ""}...` }],
      });

      const result = await pi.exec(
        "pi",
        [
          "-p",
          "--no-session",
          ...(modelRoute.modelArg ? ["--model", modelRoute.modelArg] : []),
          "--system-prompt",
          persona,
          params.task,
        ],
        {
          signal,
          cwd: runCwd,
          timeout: 300_000, // 5 minute timeout
        },
      );

      if (worktree && params.cleanupWorktree) {
        cleanup = await cleanupWorktreeIfClean(pi, worktree.path, signal);
      }

      const output = truncate(result.stdout || result.stderr || "(no output)", 30_000);
      const success = result.code === 0;
      const mergeInstructions = worktree ? buildMergeInstructions(worktree) : null;

      return {
        content: [
          {
            type: "text",
            text: [
              success ? `[${agentName}] Task completed.` : `[${agentName}] Task failed (exit ${result.code}).`,
              `Isolation: ${isolation}`,
              worktree ? `Worktree: ${worktree.path}` : null,
              worktree ? `Branch: ${worktree.branch}` : null,
              cleanup ? `Cleanup: ${cleanup.cleaned ? "cleaned" : "kept"} — ${cleanup.message}` : null,
              `Role: ${modelRoute.role}${modelRoute.modelArg ? ` → ${modelRoute.modelArg}` : " → current model"} (${modelRoute.resolution}: ${modelRoute.reason})`,
              "",
              output,
              mergeInstructions ? `\n${mergeInstructions}` : null,
              worktree ? `\nNext gate: run forge_review_worktree with worktreePath=${worktree.path}, branchName=${worktree.branch}, baseBranch=${worktree.baseBranch}.` : null,
            ].filter(Boolean).join("\n"),
          },
        ],
        details: {
          agent: agentName,
          isolation,
          cwd: runCwd,
          baseCwd,
          worktree,
          cleanup,
          exitCode: result.code,
          killed: result.killed,
          mergeInstructions,
          modelRoute,
          reviewTool: worktree ? {
            name: "forge_review_worktree",
            worktreePath: worktree.path,
            branchName: worktree.branch,
            baseBranch: worktree.baseBranch,
          } : null,
        },
      };
    },
  });
}

type AnyModel = Model<Api>;
type MobileModelRegistry = {
  getAvailable(): AnyModel[];
  getAll(): AnyModel[];
  find(provider: string, modelId: string): AnyModel | undefined;
};

type MobileRoute = {
  provider?: string;
  model?: string;
  modelString?: string;
  capability?: string;
  requireReasoning?: boolean;
  minContextWindow?: number;
  minMaxTokens?: number;
  input?: Array<"text" | "image">;
  maxInputCost?: number;
  maxOutputCost?: number;
  prefer?: string[];
  avoid?: string[];
};

type MobileRouteInfo = {
  role: string;
  modelArg: string | null;
  sources: string[];
  resolution: "explicit" | "exact" | "capability" | "fallback_current" | "none";
  reason: string;
};

function getModelRouteForRole(
  cwd: string,
  role?: string,
  explicitModel?: string,
  modelRegistry?: MobileModelRegistry,
  currentModel?: AnyModel,
): MobileRouteInfo {
  const resolvedRole = role || "implement";
  if (explicitModel) {
    const exact = modelRegistry ? findModelByArg(modelRegistry, explicitModel) : null;
    return exact
      ? { role: resolvedRole, modelArg: modelToArg(exact), sources: [], resolution: "explicit", reason: "explicit_model_override" }
      : { role: resolvedRole, modelArg: explicitModel, sources: [], resolution: "explicit", reason: "explicit_model_override_unverified" };
  }

  for (const path of [resolve(cwd, "pipeline/model-routes.json"), resolve(cwd, ".forge/model-routes.json")]) {
    if (!existsSync(path)) continue;
    try {
      const routes = JSON.parse(readFileSync(path, "utf8")) as Record<string, MobileRoute>;
      const route = routes[resolvedRole] ?? routes.default;
      if (!route) continue;

      const exactArg = route.modelString ?? (route.provider && route.model ? `${route.provider}/${route.model}` : route.model ?? null);
      if (exactArg) {
        const exact = modelRegistry ? findModelByArg(modelRegistry, exactArg, route.provider) : null;
        if (exact) return { role: resolvedRole, modelArg: modelToArg(exact), sources: [path], resolution: "exact", reason: "exact_route_match" };
        if (!hasCapabilityRequirements(route)) {
          return { role: resolvedRole, modelArg: null, sources: [path], resolution: currentModel ? "fallback_current" : "none", reason: "exact_model_not_found" };
        }
      }

      if (modelRegistry && hasCapabilityRequirements(route)) {
        const capable = rankMobileCandidates(modelRegistry.getAvailable(), resolvedRole, route)[0];
        if (capable) return { role: resolvedRole, modelArg: modelToArg(capable), sources: [path], resolution: "capability", reason: "capability_match" };
        return { role: resolvedRole, modelArg: null, sources: [path], resolution: currentModel ? "fallback_current" : "none", reason: "no_capable_available_model" };
      }

      return { role: resolvedRole, modelArg: exactArg, sources: [path], resolution: exactArg ? "exact" : "none", reason: exactArg ? "exact_route_unverified" : "route_has_no_model_or_capability" };
    } catch {
      // Ignore invalid route files and fall back to current model.
    }
  }

  return { role: resolvedRole, modelArg: null, sources: [], resolution: currentModel ? "fallback_current" : "none", reason: "no_route_configured" };
}

function hasCapabilityRequirements(route: MobileRoute): boolean {
  return Boolean(route.capability || route.requireReasoning !== undefined || route.minContextWindow !== undefined || route.minMaxTokens !== undefined || route.input || route.maxInputCost !== undefined || route.maxOutputCost !== undefined || route.prefer || route.avoid);
}

function rankMobileCandidates(models: AnyModel[], role: string, route: MobileRoute): AnyModel[] {
  const capability = route.capability ?? roleDefaultCapability(role);
  return models
    .map((model) => ({ model, score: scoreMobileCandidate(model, route, capability) }))
    .filter((entry): entry is { model: AnyModel; score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score || modelToArg(a.model).localeCompare(modelToArg(b.model)))
    .map((entry) => entry.model);
}

function scoreMobileCandidate(model: AnyModel, route: MobileRoute, capability: string): number | null {
  const effective = applyCapabilityDefaults(route, capability);
  if (effective.requireReasoning && !model.reasoning) return null;
  if (effective.minContextWindow !== undefined && model.contextWindow < effective.minContextWindow) return null;
  if (effective.minMaxTokens !== undefined && model.maxTokens < effective.minMaxTokens) return null;
  if (effective.maxInputCost !== undefined && model.cost.input > effective.maxInputCost) return null;
  if (effective.maxOutputCost !== undefined && model.cost.output > effective.maxOutputCost) return null;
  if (effective.input?.some((required) => !model.input.includes(required))) return null;

  const haystack = `${String(model.provider)}/${model.id} ${model.name}`.toLowerCase();
  const preferIndex = firstPatternIndex(effective.prefer ?? [], haystack);
  const avoidIndex = firstPatternIndex(effective.avoid ?? [], haystack);
  let score = 0;
  if (model.reasoning) score += 20;
  score += Math.min(30, Math.log10(Math.max(model.contextWindow, 1)) * 6);
  score += capability === "cheap-fast" ? Math.max(0, 30 - model.cost.input - model.cost.output) : Math.max(0, 10 - (model.cost.input + model.cost.output) / 2);
  if (preferIndex >= 0) score += 100 - preferIndex * 5;
  if (avoidIndex >= 0) score -= 50;
  return score;
}

function applyCapabilityDefaults(route: MobileRoute, capability: string): MobileRoute {
  const profiles: Record<string, MobileRoute> = {
    "cheap-fast": { input: ["text"], prefer: ["*mini*", "*flash*", "*haiku*", "*small*", "*lite*"], avoid: ["*opus*"] },
    "strong-reasoning": { requireReasoning: true, minContextWindow: 100_000, input: ["text"], prefer: ["*sonnet*", "*claude*", "*gpt-5*", "*gpt-4.1*", "*gemini*pro*", "*opus*"] },
    coding: { minContextWindow: 64_000, input: ["text"], prefer: ["*sonnet*", "*claude*", "*gpt*", "*gemini*pro*", "*coder*"] },
    general: { input: ["text"], prefer: ["*sonnet*", "*gpt*", "*gemini*", "*claude*"] },
  };
  const profile = profiles[capability] ?? profiles.general;
  return { ...profile, ...route, prefer: [...(profile.prefer ?? []), ...(route.prefer ?? [])], avoid: [...(profile.avoid ?? []), ...(route.avoid ?? [])] };
}

function roleDefaultCapability(role: string): string {
  return role === "quick" || role === "explore" || role === "commit" ? "cheap-fast" : role === "plan" || role === "review" ? "strong-reasoning" : "coding";
}

function findModelByArg(modelRegistry: MobileModelRegistry, modelArg: string, providerHint?: string): AnyModel | null {
  const parsed = parseModelArg(modelArg, providerHint);
  if (parsed) return modelRegistry.find(parsed.provider, parsed.model) ?? null;
  const matches = modelRegistry.getAll().filter((model) => model.id === modelArg || modelToArg(model) === modelArg);
  return matches.length === 1 ? matches[0] : null;
}

function parseModelArg(modelArg: string, providerHint?: string): { provider: string; model: string } | null {
  if (providerHint && !modelArg.includes("/")) return { provider: providerHint, model: modelArg };
  const slash = modelArg.indexOf("/");
  if (slash <= 0 || slash >= modelArg.length - 1) return null;
  return { provider: modelArg.slice(0, slash), model: modelArg.slice(slash + 1) };
}

function modelToArg(model: AnyModel): string {
  return `${String(model.provider)}/${model.id}`;
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

async function isGitRepository(pi: ExtensionAPI, cwd: string, signal?: AbortSignal): Promise<boolean> {
  const result = await pi.exec("git", ["rev-parse", "--is-inside-work-tree"], { cwd, signal, timeout: 10_000 });
  return result.code === 0 && result.stdout.trim() === "true";
}

async function getGitRoot(pi: ExtensionAPI, cwd: string, signal?: AbortSignal): Promise<string> {
  const result = await pi.exec("git", ["rev-parse", "--show-toplevel"], { cwd, signal, timeout: 10_000 });
  if (result.code !== 0) throw new Error(`Not a git repository: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

async function getCurrentBranch(pi: ExtensionAPI, cwd: string, signal?: AbortSignal): Promise<string> {
  const result = await pi.exec("git", ["branch", "--show-current"], { cwd, signal, timeout: 10_000 });
  if (result.code === 0 && result.stdout.trim()) return result.stdout.trim();
  const head = await pi.exec("git", ["rev-parse", "--short", "HEAD"], { cwd, signal, timeout: 10_000 });
  return head.code === 0 && head.stdout.trim() ? `detached-${head.stdout.trim()}` : "unknown";
}

async function hasDirtyWorkingTree(pi: ExtensionAPI, cwd: string, signal?: AbortSignal): Promise<boolean> {
  const result = await pi.exec("git", ["status", "--porcelain"], { cwd, signal, timeout: 10_000 });
  if (result.code !== 0) throw new Error(`Could not inspect git status: ${result.stderr || result.stdout}`);
  return result.stdout.trim().length > 0;
}

async function createWorktree(
  pi: ExtensionAPI,
  spec: { baseCwd: string; taskName: string; branchName?: string; parentDir?: string },
  signal?: AbortSignal,
): Promise<CreatedWorktree> {
  if (!await isGitRepository(pi, spec.baseCwd, signal)) {
    throw new Error("Worktree isolation requires a git repository.");
  }

  const gitRoot = await getGitRoot(pi, spec.baseCwd, signal);
  const baseBranch = await getCurrentBranch(pi, gitRoot, signal);
  const branch = spec.branchName ? sanitizeBranch(spec.branchName) : `forge/${slugify(spec.taskName)}-${Date.now()}`;
  const parentDir = resolve(spec.parentDir ?? resolve(dirname(gitRoot), ".forge-worktrees"));
  const worktreePath = resolve(parentDir, `${basename(gitRoot)}-${branch.replace(/[\\/]/g, "-")}`);

  if (existsSync(worktreePath)) throw new Error(`Worktree path already exists: ${worktreePath}`);
  await mkdir(parentDir, { recursive: true });

  const result = await pi.exec("git", ["worktree", "add", "-b", branch, worktreePath, "HEAD"], {
    cwd: gitRoot,
    signal,
    timeout: 60_000,
  });
  if (result.code !== 0) throw new Error(`Failed to create git worktree: ${result.stderr || result.stdout}`);

  return {
    path: worktreePath,
    branch,
    baseBranch,
    cleanupCommand: `git -C ${shellQuote(gitRoot)} worktree remove ${shellQuote(worktreePath)}`,
  };
}

async function cleanupWorktreeIfClean(pi: ExtensionAPI, worktreePath: string, signal?: AbortSignal): Promise<{ cleaned: boolean; message: string }> {
  if (!existsSync(worktreePath)) return { cleaned: true, message: "Worktree path already absent." };
  await removeGeneratedForgeStateIfOnlyDirtyFile(pi, worktreePath, signal);

  const status = await pi.exec("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: worktreePath, signal, timeout: 10_000 });
  if (status.code === 0 && status.stdout.trim().length > 0) {
    return { cleaned: false, message: "Worktree has uncommitted changes; leaving it for inspection." };
  }
  const remove = await pi.exec("git", ["worktree", "remove", worktreePath], { cwd: worktreePath, signal, timeout: 60_000 });
  if (remove.code !== 0) {
    await rm(worktreePath, { recursive: true, force: true }).catch(() => {});
    return { cleaned: false, message: `git worktree remove failed: ${remove.stderr || remove.stdout}` };
  }
  return { cleaned: true, message: "Worktree removed." };
}

async function removeGeneratedForgeStateIfOnlyDirtyFile(pi: ExtensionAPI, cwd: string, signal?: AbortSignal): Promise<void> {
  const status = await pi.exec("git", ["status", "--porcelain", "--untracked-files=all"], { cwd, signal, timeout: 10_000 });
  if (status.code !== 0) return;

  const dirty = status.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const onlyForgeState = dirty.length > 0 && dirty.every((line) => line === "?? pipeline/state.json");
  if (!onlyForgeState) return;

  await rm(resolve(cwd, "pipeline/state.json"), { force: true });
  await rm(resolve(cwd, "pipeline"), { recursive: false, force: true }).catch(() => {});
}

function buildMergeInstructions(worktree: CreatedWorktree): string {
  return [
    "Review and merge manually after validating the isolated work:",
    `1. Inspect: cd ${shellQuote(worktree.path)}`,
    "2. Run tests/builds in the worktree.",
    `3. Merge branch '${worktree.branch}' back into '${worktree.baseBranch}' if accepted.`,
    `4. Cleanup when done: ${worktree.cleanupCommand}`,
  ].join("\n");
}

function sanitizeBranch(value: string): string {
  return value.trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9._/-]/g, "-").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "").slice(0, 160) || `forge/task-${Date.now()}`;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "task";
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function truncate(value: string, maxBytes: number): string {
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes <= maxBytes) return value;
  return value.slice(0, maxBytes) + `\n\n[Output truncated to ${maxBytes} bytes]`;
}
