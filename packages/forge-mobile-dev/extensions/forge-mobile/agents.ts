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
import { StringEnum } from "@mariozechner/pi-ai";
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
      const modelRoute = getModelRouteForRole(baseCwd, params.role, params.model);
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
              `Role: ${modelRoute.role}${modelRoute.modelArg ? ` → ${modelRoute.modelArg}` : " → current model"}`,
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

function getModelRouteForRole(cwd: string, role?: string, explicitModel?: string): { role: string; modelArg: string | null; sources: string[] } {
  const resolvedRole = role || "implement";
  if (explicitModel) return { role: resolvedRole, modelArg: explicitModel, sources: [] };

  for (const path of [resolve(cwd, "pipeline/model-routes.json"), resolve(cwd, ".forge/model-routes.json")]) {
    if (!existsSync(path)) continue;
    try {
      const routes = JSON.parse(readFileSync(path, "utf8")) as Record<string, { provider?: string; model?: string; modelString?: string }>;
      const route = routes[resolvedRole] ?? routes.default;
      if (!route) continue;
      const modelArg = route.modelString ?? (route.provider && route.model ? `${route.provider}/${route.model}` : route.model ?? null);
      return { role: resolvedRole, modelArg, sources: [path] };
    } catch {
      // Ignore invalid route files and fall back to current model.
    }
  }

  return { role: resolvedRole, modelArg: null, sources: [] };
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
