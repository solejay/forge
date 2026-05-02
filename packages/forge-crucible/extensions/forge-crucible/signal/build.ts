import type { CrucibleSignalRecord, SignalEventKind } from "./types.js";

interface ForgeLikeState {
  current_task?: {
    id?: string | null;
    title?: string | null;
    status?: string | null;
    classification?: {
      type?: string | null;
      complexity?: string | null;
    };
    verification?: {
      status?: string | null;
      checks?: Array<{ status?: string }>;
    };
    drift?: {
      detected?: boolean;
      signals?: string[];
      escalation_required?: boolean;
    };
  };
  history?: {
    handoffs?: unknown[];
  };
}

export interface BuildSignalInput {
  state: ForgeLikeState;
  kind?: SignalEventKind;
  modelRoute?: string | null;
  currentModel?: string | null;
  durationMinutes?: number | null;
  skillsInvoked?: string[];
  toolsInvoked?: string[];
  handoffTriggered?: boolean;
  worktreeUsed?: boolean;
  notes?: string;
  source?: CrucibleSignalRecord["source"];
}

const SECRETISH = /(api[_-]?key|token|secret|password|bearer\s+[a-z0-9._-]+)/ig;

export function buildSignalRecord(input: BuildSignalInput): CrucibleSignalRecord {
  const task = input.state.current_task ?? {};
  const verification = task.verification ?? {};
  const checks = verification.checks ?? [];
  const failedChecks = checks.filter((check) => check.status === "failed").length;
  const verificationStatus = verification.status ?? null;
  const verificationPassed = verificationStatus === "passed"
    ? true
    : verificationStatus === "failed" || failedChecks > 0
      ? false
      : null;
  const driftSignals = task.drift?.signals ?? [];

  return {
    schema_version: 1,
    kind: input.kind ?? "task",
    ts: new Date().toISOString(),
    task_id: task.id ?? null,
    task_title: sanitizeShort(task.title ?? null),
    task_type: task.classification?.type ?? null,
    task_complexity: task.classification?.complexity ?? null,
    task_status: task.status ?? null,
    verification_status: verificationStatus,
    verification_passed: verificationPassed,
    verification_failed_checks: failedChecks,
    drift_detected: Boolean(task.drift?.detected),
    drift_count: driftSignals.length,
    escalation_required: Boolean(task.drift?.escalation_required),
    handoff_triggered: Boolean(input.handoffTriggered),
    worktree_used: Boolean(input.worktreeUsed),
    skills_invoked: uniqueClean(input.skillsInvoked ?? []),
    tools_invoked: uniqueClean(input.toolsInvoked ?? []),
    model_route: sanitizeShort(input.modelRoute ?? null),
    current_model: sanitizeShort(input.currentModel ?? null),
    duration_minutes: normalizeDuration(input.durationMinutes),
    notes: sanitizeShort(input.notes),
    source: input.source ?? "tool",
    privacy: {
      transcript_stored: false,
      secrets_stored: false,
    },
  };
}

export function sanitizeShort(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const stripped = value.replace(SECRETISH, "[redacted]").replace(/[\r\n\t]+/g, " ").trim();
  if (!stripped) return null;
  return stripped.length > 240 ? `${stripped.slice(0, 237)}...` : stripped;
}

function uniqueClean(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => sanitizeShort(value)).filter((value): value is string => Boolean(value)))).slice(0, 30);
}

function normalizeDuration(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value * 10) / 10);
}
