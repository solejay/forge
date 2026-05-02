import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";
import { resolveModelRoute } from "../models/routes.js";
import { buildMergeInstructions, cleanupWorktree, createWorktree, hasDirtyWorkingTree } from "../worktree/worktree.js";

const IsolationModes = ["none", "worktree"] as const;

export function registerForgeWorktreeDelegateTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "forge_worktree_delegate",
    label: "Forge Worktree Delegate",
    description:
      "Run a focused pi sub-agent in the current working directory or an isolated git worktree. " +
      "Use worktree isolation for parallel agents so concurrent edits do not collide.",
    promptSnippet: "Delegate a task to a sub-agent, optionally in a git worktree",
    promptGuidelines: [
      "Use forge_worktree_delegate with isolation=worktree for parallel implementation branches.",
      "Use forge_worktree_delegate with isolation=none only for read-only exploration or simple isolated analysis.",
      "After forge_worktree_delegate returns worktree details, review and merge manually; Stage 3 does not auto-merge branches.",
    ],
    parameters: Type.Object({
      task: Type.String({ description: "Detailed task for the sub-agent." }),
      systemPrompt: Type.Optional(Type.String({ description: "Specialized system prompt/persona for the sub-agent." })),
      cwd: Type.Optional(Type.String({ description: "Base working directory. Defaults to current cwd." })),
      isolation: Type.Optional(StringEnum(IsolationModes as unknown as string[])),
      branchName: Type.Optional(Type.String({ description: "Optional git branch name for the worktree." })),
      parentDir: Type.Optional(Type.String({ description: "Optional parent directory for created worktrees." })),
      cleanupWorktree: Type.Optional(Type.Boolean({ description: "Remove clean worktree after run. Defaults to false." })),
      role: Type.Optional(Type.String({ description: "Forge model role for the sub-agent, e.g. explore, plan, implement, review, quick." })),
      model: Type.Optional(Type.String({ description: "Explicit model string override for the sub-agent, e.g. provider/model-id." })),
      timeoutMs: Type.Optional(Type.Number({ description: "Sub-agent timeout in milliseconds. Defaults to 300000." })),
      requireCleanBase: Type.Optional(Type.Boolean({ description: "If true, refuse worktree creation when base repo is dirty. Defaults to false." })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const baseCwd = params.cwd || ctx.cwd;
      const isolation = (params.isolation ?? "worktree") as "none" | "worktree";
      const timeout = params.timeoutMs ?? 300_000;
      const modelRoute = resolveModelRoute({
        cwd: baseCwd,
        role: params.role,
        explicitModel: params.model,
        modelRegistry: ctx.modelRegistry,
        currentModel: ctx.model,
      });

      let runCwd = baseCwd;
      let worktree: Awaited<ReturnType<typeof createWorktree>> | null = null;
      let cleanup: { cleaned: boolean; message: string } | null = null;

      if (isolation === "worktree") {
        onUpdate?.({ content: [{ type: "text", text: "Creating isolated git worktree..." }] });

        if (params.requireCleanBase && await hasDirtyWorkingTree(pi, baseCwd, signal)) {
          throw new Error("Base repository has uncommitted changes and requireCleanBase=true. Commit/stash first or set requireCleanBase=false.");
        }

        worktree = await createWorktree(pi, {
          baseCwd,
          taskName: params.task,
          branchName: params.branchName,
          parentDir: params.parentDir,
        }, signal);
        runCwd = worktree.path;
      }

      onUpdate?.({ content: [{ type: "text", text: `Running sub-agent in ${isolation === "worktree" ? runCwd : "current cwd"}...` }] });

      const args = ["-p", "--no-session"];
      if (modelRoute.modelArg) args.push("--model", modelRoute.modelArg);
      if (params.systemPrompt) {
        args.push("--system-prompt", params.systemPrompt);
      }
      args.push(params.task);

      const result = await pi.exec("pi", args, {
        cwd: runCwd,
        signal,
        timeout,
      });

      if (worktree && params.cleanupWorktree) {
        cleanup = await cleanupWorktree(pi, worktree.path, signal);
      }

      const output = truncate(result.stdout || result.stderr || "(no output)", 30_000);
      const mergeInstructions = worktree ? buildMergeInstructions(worktree) : null;

      const text = [
        `Forge delegate ${result.code === 0 ? "completed" : `failed (exit ${result.code})`}.`,
        `Isolation: ${isolation}`,
        worktree ? `Worktree: ${worktree.path}` : null,
        worktree ? `Branch: ${worktree.branch}` : null,
        cleanup ? `Cleanup: ${cleanup.cleaned ? "cleaned" : "kept"} — ${cleanup.message}` : null,
        `Role: ${modelRoute.role}${modelRoute.modelArg ? ` → ${modelRoute.modelArg}` : " → current model"} (${modelRoute.resolution}: ${modelRoute.reason})`,
        "",
        "Output:",
        output,
        mergeInstructions ? `\n${mergeInstructions}` : null,
        worktree ? `\nNext gate: run forge_review_worktree with worktreePath=${worktree.path}, branchName=${worktree.branch}, baseBranch=${worktree.baseBranch}.` : null,
      ].filter(Boolean).join("\n");

      return {
        content: [{ type: "text", text }],
        details: {
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

function truncate(value: string, maxBytes: number): string {
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes <= maxBytes) return value;
  return value.slice(0, maxBytes) + `\n\n[Output truncated to ${maxBytes} bytes]`;
}
