import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export interface WorktreeSpec {
  baseCwd: string;
  taskName: string;
  branchName?: string;
  parentDir?: string;
}

export interface CreatedWorktree {
  path: string;
  branch: string;
  baseBranch: string;
  cleanupCommand: string;
}

export async function isGitRepository(pi: ExtensionAPI, cwd: string, signal?: AbortSignal): Promise<boolean> {
  const result = await pi.exec("git", ["rev-parse", "--is-inside-work-tree"], { cwd, signal, timeout: 10_000 });
  return result.code === 0 && result.stdout.trim() === "true";
}

export async function getGitRoot(pi: ExtensionAPI, cwd: string, signal?: AbortSignal): Promise<string> {
  const result = await pi.exec("git", ["rev-parse", "--show-toplevel"], { cwd, signal, timeout: 10_000 });
  if (result.code !== 0) throw new Error(`Not a git repository: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

export async function getCurrentBranch(pi: ExtensionAPI, cwd: string, signal?: AbortSignal): Promise<string> {
  const result = await pi.exec("git", ["branch", "--show-current"], { cwd, signal, timeout: 10_000 });
  if (result.code === 0 && result.stdout.trim()) return result.stdout.trim();

  const head = await pi.exec("git", ["rev-parse", "--short", "HEAD"], { cwd, signal, timeout: 10_000 });
  if (head.code === 0 && head.stdout.trim()) return `detached-${head.stdout.trim()}`;
  return "unknown";
}

export async function hasDirtyWorkingTree(pi: ExtensionAPI, cwd: string, signal?: AbortSignal): Promise<boolean> {
  const result = await pi.exec("git", ["status", "--porcelain"], { cwd, signal, timeout: 10_000 });
  if (result.code !== 0) throw new Error(`Could not inspect git status: ${result.stderr || result.stdout}`);
  return result.stdout.trim().length > 0;
}

export async function createWorktree(
  pi: ExtensionAPI,
  spec: WorktreeSpec,
  signal?: AbortSignal,
): Promise<CreatedWorktree> {
  if (!await isGitRepository(pi, spec.baseCwd, signal)) {
    throw new Error("Worktree isolation requires a git repository.");
  }

  const gitRoot = await getGitRoot(pi, spec.baseCwd, signal);
  const baseBranch = await getCurrentBranch(pi, gitRoot, signal);
  const safeTask = slugify(spec.taskName || "forge-task");
  const branch = spec.branchName ? sanitizeBranch(spec.branchName) : `forge/${safeTask}-${Date.now()}`;
  const parentDir = resolve(spec.parentDir ?? resolve(dirname(gitRoot), ".forge-worktrees"));
  const worktreePath = resolve(parentDir, `${basename(gitRoot)}-${branch.replace(/[\\/]/g, "-")}`);

  if (existsSync(worktreePath)) {
    throw new Error(`Worktree path already exists: ${worktreePath}`);
  }

  await mkdir(parentDir, { recursive: true });

  const result = await pi.exec("git", ["worktree", "add", "-b", branch, worktreePath, "HEAD"], {
    cwd: gitRoot,
    signal,
    timeout: 60_000,
  });

  if (result.code !== 0) {
    throw new Error(`Failed to create git worktree: ${result.stderr || result.stdout}`);
  }

  return {
    path: worktreePath,
    branch,
    baseBranch,
    cleanupCommand: `git -C ${shellQuote(gitRoot)} worktree remove ${shellQuote(worktreePath)}`,
  };
}

export async function cleanupWorktree(
  pi: ExtensionAPI,
  worktreePath: string,
  signal?: AbortSignal,
): Promise<{ cleaned: boolean; message: string }> {
  if (!existsSync(worktreePath)) return { cleaned: true, message: "Worktree path already absent." };

  const gitRootResult = await pi.exec("git", ["rev-parse", "--show-toplevel"], {
    cwd: worktreePath,
    signal,
    timeout: 10_000,
  });

  if (gitRootResult.code !== 0) {
    await rm(worktreePath, { recursive: true, force: true });
    return { cleaned: true, message: "Removed non-git worktree directory." };
  }

  const root = gitRootResult.stdout.trim();
  await removeGeneratedForgeStateIfOnlyDirtyFile(pi, root, signal);

  const status = await pi.exec("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: root, signal, timeout: 10_000 });
  if (status.code === 0 && status.stdout.trim().length > 0) {
    return { cleaned: false, message: "Worktree has uncommitted changes; leaving it for inspection." };
  }

  const remove = await pi.exec("git", ["worktree", "remove", worktreePath], {
    cwd: root,
    signal,
    timeout: 60_000,
  });

  if (remove.code !== 0) {
    return { cleaned: false, message: `git worktree remove failed: ${remove.stderr || remove.stdout}` };
  }

  return { cleaned: true, message: "Worktree removed." };
}

export function buildMergeInstructions(worktree: CreatedWorktree): string {
  return [
    "Review and merge manually after validating the isolated work:",
    `1. Inspect: cd ${shellQuote(worktree.path)}`,
    "2. Run tests/builds in the worktree.",
    `3. Merge branch '${worktree.branch}' back into '${worktree.baseBranch}' if accepted.`,
    `4. Cleanup when done: ${worktree.cleanupCommand}`,
  ].join("\n");
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

function sanitizeBranch(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._/-]/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .slice(0, 160) || `forge/task-${Date.now()}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "task";
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
