import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";
import { cleanupWorktree, getCurrentBranch, getGitRoot } from "../worktree/worktree.js";

const Actions = ["review", "validate", "merge", "cleanup"] as const;
const MergeMethods = ["merge", "squash"] as const;

interface ValidationResult {
  command: string;
  exitCode: number;
  passed: boolean;
  output: string;
}

export function registerForgeReviewWorktreeTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "forge_review_worktree",
    label: "Forge Review Worktree",
    description:
      "Reviewer merge gate for worktree-isolated delegation. Reviews diffs, runs validation commands, " +
      "and optionally merges a worktree branch back into its base branch only when explicitly requested.",
    promptSnippet: "Review, validate, merge, or cleanup a delegated git worktree",
    promptGuidelines: [
      "Use forge_review_worktree action=review before accepting worktree-isolated sub-agent changes.",
      "Use forge_review_worktree action=validate with explicit validationCommands before merge.",
      "Use forge_review_worktree action=merge only after validation passes and the user wants the branch merged.",
      "forge_review_worktree defaults to review-only behavior; it does not auto-merge unless action=merge is provided.",
    ],
    parameters: Type.Object({
      worktreePath: Type.String({ description: "Path to the delegated git worktree." }),
      baseBranch: Type.Optional(Type.String({ description: "Base branch to compare/merge into. Defaults to current branch recorded by git where possible." })),
      branchName: Type.Optional(Type.String({ description: "Worktree branch name. Defaults to current branch in worktree." })),
      action: Type.Optional(StringEnum(Actions as unknown as string[])),
      validationCommands: Type.Optional(Type.Array(Type.String({ description: "Commands to run in the worktree before accepting/merging." }))),
      mergeMethod: Type.Optional(StringEnum(MergeMethods as unknown as string[])),
      allowMergeWithFailedValidation: Type.Optional(Type.Boolean({ description: "Dangerous override. Defaults to false." })),
      cleanupAfterMerge: Type.Optional(Type.Boolean({ description: "Cleanup worktree after successful merge if it is clean. Defaults to false." })),
      maxOutputBytes: Type.Optional(Type.Number({ description: "Maximum output bytes per validation command. Defaults to 12000." })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const action = (params.action ?? "review") as typeof Actions[number];
      const maxOutputBytes = params.maxOutputBytes ?? 12_000;
      const worktreePath = params.worktreePath;
      const worktreeRoot = await getGitRoot(pi, worktreePath, signal);
      const branch = params.branchName || await getCurrentBranch(pi, worktreeRoot, signal);
      const baseBranch = params.baseBranch || await inferBaseBranch(pi, worktreeRoot, branch, signal);

      onUpdate?.({ content: [{ type: "text", text: `Reviewing worktree ${worktreeRoot} (${branch} → ${baseBranch})...` }] });

      const review = await buildReviewSummary(pi, worktreeRoot, baseBranch, branch, signal);
      let validations: ValidationResult[] = [];
      let merge: { attempted: boolean; merged: boolean; message: string } = { attempted: false, merged: false, message: "Merge not requested." };
      let cleanup: { cleaned: boolean; message: string } | null = null;

      if (action === "validate" || action === "merge") {
        validations = await runValidationCommands(pi, worktreeRoot, params.validationCommands ?? [], maxOutputBytes, signal);
      }

      const validationFailed = validations.some((result) => !result.passed);

      if (action === "merge") {
        if (validationFailed && !params.allowMergeWithFailedValidation) {
          merge = { attempted: false, merged: false, message: "Merge refused because validation failed." };
        } else if (await hasUncommittedChanges(pi, worktreeRoot, signal)) {
          merge = { attempted: false, merged: false, message: "Merge refused because worktree has uncommitted changes. Commit/stash first." };
        } else {
          merge = await mergeWorktreeBranch(pi, ctx.cwd, worktreeRoot, baseBranch, branch, params.mergeMethod ?? "merge", signal);
          if (merge.merged && params.cleanupAfterMerge) {
            cleanup = await cleanupWorktree(pi, worktreeRoot, signal);
          }
        }
      } else if (action === "cleanup") {
        cleanup = await cleanupWorktree(pi, worktreeRoot, signal);
      }

      const text = formatResult({
        action,
        worktreeRoot,
        branch,
        baseBranch,
        review,
        validations,
        merge,
        cleanup,
      });

      return {
        content: [{ type: "text", text }],
        details: {
          action,
          worktreePath: worktreeRoot,
          branch,
          baseBranch,
          review,
          validations,
          merge,
          cleanup,
        },
      };
    },
  });
}

async function buildReviewSummary(
  pi: ExtensionAPI,
  cwd: string,
  baseBranch: string,
  branch: string,
  signal?: AbortSignal,
) {
  const changedFiles = await pi.exec("git", ["diff", "--name-status", `${baseBranch}...${branch}`], { cwd, signal, timeout: 20_000 });
  const diffStat = await pi.exec("git", ["diff", "--stat", `${baseBranch}...${branch}`], { cwd, signal, timeout: 20_000 });
  const commits = await pi.exec("git", ["log", "--oneline", `${baseBranch}..${branch}`], { cwd, signal, timeout: 20_000 });
  const sampleDiff = await pi.exec("git", ["diff", "--", ":(exclude)pipeline/state.json"], { cwd, signal, timeout: 20_000 });

  return {
    changedFiles: changedFiles.code === 0 ? changedFiles.stdout.trim() : `ERROR: ${changedFiles.stderr || changedFiles.stdout}`,
    diffStat: diffStat.code === 0 ? diffStat.stdout.trim() : `ERROR: ${diffStat.stderr || diffStat.stdout}`,
    commits: commits.code === 0 ? commits.stdout.trim() : `ERROR: ${commits.stderr || commits.stdout}`,
    workingTreeDiff: sampleDiff.code === 0 ? truncate(sampleDiff.stdout.trim(), 16_000) : `ERROR: ${sampleDiff.stderr || sampleDiff.stdout}`,
  };
}

async function runValidationCommands(
  pi: ExtensionAPI,
  cwd: string,
  commands: string[],
  maxOutputBytes: number,
  signal?: AbortSignal,
): Promise<ValidationResult[]> {
  if (commands.length === 0) {
    return [{ command: "(none)", exitCode: 1, passed: false, output: "No validationCommands were provided." }];
  }

  const results: ValidationResult[] = [];
  for (const command of commands) {
    const result = await pi.exec("bash", ["-lc", command], { cwd, signal, timeout: 300_000 });
    const output = truncate([result.stdout, result.stderr].filter(Boolean).join("\n"), maxOutputBytes);
    results.push({
      command,
      exitCode: result.code ?? 1,
      passed: result.code === 0,
      output: output || "(no output)",
    });
  }
  return results;
}

async function mergeWorktreeBranch(
  pi: ExtensionAPI,
  callerCwd: string,
  worktreeRoot: string,
  baseBranch: string,
  branch: string,
  method: "merge" | "squash",
  signal?: AbortSignal,
): Promise<{ attempted: boolean; merged: boolean; message: string }> {
  const baseRepo = await findWorktreeForBranch(pi, worktreeRoot, baseBranch, signal) || await getGitRoot(pi, callerCwd, signal);
  const currentBaseBranch = await getCurrentBranch(pi, baseRepo, signal);

  if (currentBaseBranch !== baseBranch) {
    return {
      attempted: false,
      merged: false,
      message: `Merge refused: base checkout is on '${currentBaseBranch}', expected '${baseBranch}'. Checkout the base branch first.`,
    };
  }

  if (await hasUncommittedChanges(pi, baseRepo, signal)) {
    return { attempted: false, merged: false, message: "Merge refused: base checkout has uncommitted changes." };
  }

  const args = method === "squash"
    ? ["merge", "--squash", branch]
    : ["merge", "--no-ff", branch, "-m", `Merge ${branch} via forge_review_worktree`];
  const result = await pi.exec("git", args, { cwd: baseRepo, signal, timeout: 120_000 });

  return {
    attempted: true,
    merged: result.code === 0,
    message: result.code === 0 ? `Merged ${branch} into ${baseBranch} using ${method}.` : `Merge failed: ${result.stderr || result.stdout}`,
  };
}

async function findWorktreeForBranch(
  pi: ExtensionAPI,
  cwd: string,
  branch: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const result = await pi.exec("git", ["worktree", "list", "--porcelain"], { cwd, signal, timeout: 10_000 });
  if (result.code !== 0) return null;

  const entries = result.stdout.split("\n\n");
  for (const entry of entries) {
    const lines = entry.split("\n");
    const worktree = lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length);
    const branchLine = lines.find((line) => line.startsWith("branch "))?.slice("branch ".length);
    const shortBranch = branchLine?.replace(/^refs\/heads\//, "");
    if (worktree && shortBranch === branch) return worktree;
  }
  return null;
}

async function inferBaseBranch(pi: ExtensionAPI, cwd: string, branch: string, signal?: AbortSignal): Promise<string> {
  const candidates = ["main", "master", "develop"];
  for (const candidate of candidates) {
    if (candidate === branch) continue;
    const result = await pi.exec("git", ["rev-parse", "--verify", candidate], { cwd, signal, timeout: 10_000 });
    if (result.code === 0) return candidate;
  }
  return "main";
}

async function hasUncommittedChanges(pi: ExtensionAPI, cwd: string, signal?: AbortSignal): Promise<boolean> {
  const result = await pi.exec("git", ["status", "--porcelain", "--untracked-files=all"], { cwd, signal, timeout: 10_000 });
  if (result.code !== 0) throw new Error(`Could not inspect git status: ${result.stderr || result.stdout}`);
  const dirty = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== "?? pipeline/state.json");
  return dirty.length > 0;
}

function formatResult(input: {
  action: string;
  worktreeRoot: string;
  branch: string;
  baseBranch: string;
  review: Awaited<ReturnType<typeof buildReviewSummary>>;
  validations: ValidationResult[];
  merge: { attempted: boolean; merged: boolean; message: string };
  cleanup: { cleaned: boolean; message: string } | null;
}): string {
  const validationLines = input.validations.length === 0
    ? ["Validation: not run"]
    : input.validations.map((result) => `${result.passed ? "✅" : "❌"} ${result.command} (exit ${result.exitCode})\n${indent(result.output)}`);

  return [
    `Forge worktree review — action=${input.action}`,
    `Worktree: ${input.worktreeRoot}`,
    `Branch: ${input.branch}`,
    `Base: ${input.baseBranch}`,
    "",
    "Changed files:",
    input.review.changedFiles || "(none)",
    "",
    "Diff stat:",
    input.review.diffStat || "(none)",
    "",
    "Commits:",
    input.review.commits || "(none)",
    "",
    ...validationLines,
    "",
    `Merge: ${input.merge.message}`,
    input.cleanup ? `Cleanup: ${input.cleanup.cleaned ? "cleaned" : "kept"} — ${input.cleanup.message}` : "Cleanup: not requested",
  ].join("\n");
}

function indent(value: string): string {
  return value.split("\n").map((line) => `  ${line}`).join("\n");
}

function truncate(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  return value.slice(0, maxBytes) + `\n[Output truncated to ${maxBytes} bytes]`;
}
