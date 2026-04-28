import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createDefaultForgeState, type ForgeState } from "./schema.js";

export const FORGE_STATE_PATH = "pipeline/state.json";

export function getStatePath(cwd: string): string {
  return resolve(cwd, FORGE_STATE_PATH);
}

export async function ensureForgeState(cwd: string): Promise<ForgeState> {
  const path = getStatePath(cwd);
  await mkdir(dirname(path), { recursive: true });

  if (!existsSync(path)) {
    const state = createDefaultForgeState();
    await writeForgeState(cwd, state);
    return state;
  }

  const state = await readForgeState(cwd);
  const migrated = migrateForgeState(state);
  if (JSON.stringify(state) !== JSON.stringify(migrated)) {
    await writeForgeState(cwd, migrated);
  }
  return migrated;
}

export async function readForgeState(cwd: string): Promise<ForgeState> {
  const path = getStatePath(cwd);
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<ForgeState>;
    return migrateForgeState(parsed);
  } catch (error) {
    const state = createDefaultForgeState();
    await writeForgeState(cwd, state);
    return state;
  }
}

export async function writeForgeState(cwd: string, state: ForgeState): Promise<void> {
  const path = getStatePath(cwd);
  await mkdir(dirname(path), { recursive: true });
  const next: ForgeState = {
    ...state,
    updated_at: new Date().toISOString(),
  };
  await writeFile(path, JSON.stringify(next, null, 2) + "\n", "utf8");
}

export async function updateForgeState(
  cwd: string,
  updater: (state: ForgeState) => ForgeState | void | Promise<ForgeState | void>,
): Promise<ForgeState> {
  const state = await ensureForgeState(cwd);
  const updated = (await updater(structuredCloneCompat(state))) ?? state;
  await writeForgeState(cwd, updated);
  return updated;
}

export function summarizeForgeState(state: ForgeState): string {
  const task = state.current_task;
  const artifactLines = Object.entries(state.artifacts)
    .map(([key, value]) => {
      if (Array.isArray(value)) return `${key}: ${value.length}`;
      return `${key}: ${value ? "present" : "missing"}`;
    })
    .join(" | ");

  return [
    `Forge World State (${FORGE_STATE_PATH})`,
    "═".repeat(50),
    `Project: ${state.project.name ?? "unknown"} (${state.project.type ?? "unknown"})`,
    `Platforms: ${state.project.platforms.length ? state.project.platforms.join(", ") : "unknown"}`,
    "",
    `Current task: ${task.title ?? "none"}`,
    `Status: ${task.status}`,
    `Classification: ${task.classification.type ?? "unknown"} / ${task.classification.complexity ?? "unknown"} / confidence=${task.classification.confidence ?? "n/a"}`,
    `Plan steps: ${task.plan.steps.length} | completed: ${task.progress.completed_steps.length}`,
    `Verification: ${task.verification.status} (${task.verification.checks.length} checks, ${task.verification.failures.length} failures)`,
    `Drift: ${task.drift.detected ? "detected" : "none"}${task.drift.escalation_required ? " — escalation required" : ""}`,
    "",
    `Artifacts: ${artifactLines}`,
    "",
    `Updated: ${state.updated_at}`,
  ].join("\n");
}

function migrateForgeState(input: Partial<ForgeState> | unknown): ForgeState {
  const defaults = createDefaultForgeState();
  const state = typeof input === "object" && input !== null ? input as Partial<ForgeState> : {};

  return {
    ...defaults,
    ...state,
    version: 1,
    project: {
      ...defaults.project,
      ...(state.project ?? {}),
    },
    current_task: {
      ...defaults.current_task,
      ...(state.current_task ?? {}),
      classification: {
        ...defaults.current_task.classification,
        ...(state.current_task?.classification ?? {}),
      },
      plan: {
        ...defaults.current_task.plan,
        ...(state.current_task?.plan ?? {}),
      },
      progress: {
        ...defaults.current_task.progress,
        ...(state.current_task?.progress ?? {}),
      },
      verification: {
        ...defaults.current_task.verification,
        ...(state.current_task?.verification ?? {}),
      },
      drift: {
        ...defaults.current_task.drift,
        ...(state.current_task?.drift ?? {}),
      },
    },
    artifacts: {
      ...defaults.artifacts,
      ...(state.artifacts ?? {}),
    },
    history: {
      ...defaults.history,
      ...(state.history ?? {}),
      completed_tasks: state.history?.completed_tasks ?? defaults.history.completed_tasks,
      handoffs: state.history?.handoffs ?? defaults.history.handoffs,
    },
    updated_at: state.updated_at ?? defaults.updated_at,
  };
}

function structuredCloneCompat<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
