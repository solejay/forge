export const SIGNAL_LOG_PATH = "pipeline/signal-log.jsonl";
export const PROPOSALS_PATH = "pipeline/crucible-proposals.md";
export const ROUTES_PATH = "pipeline/model-routes.json";

export type SignalEventKind = "task" | "tool" | "handoff" | "anneal" | "note";

export interface CrucibleSignalRecord {
  schema_version: 1;
  kind: SignalEventKind;
  ts: string;
  task_id: string | null;
  task_title: string | null;
  task_type: string | null;
  task_complexity: string | null;
  task_status: string | null;
  verification_status: string | null;
  verification_passed: boolean | null;
  verification_failed_checks: number;
  drift_detected: boolean;
  drift_count: number;
  escalation_required: boolean;
  handoff_triggered: boolean;
  worktree_used: boolean;
  skills_invoked: string[];
  tools_invoked: string[];
  model_route: string | null;
  current_model: string | null;
  duration_minutes: number | null;
  notes?: string;
  source: "manual" | "tool" | "event" | "anneal";
  privacy: {
    transcript_stored: false;
    secrets_stored: false;
  };
}

export interface CrucibleSummary {
  total_records: number;
  task_records: number;
  verification_passed: number;
  verification_failed: number;
  drifted: number;
  handoffs: number;
  worktrees: number;
  anneals: number;
  latest_ts: string | null;
}

export interface MineOptions {
  minSamples: number;
  passRateThreshold: number;
  driftThreshold: number;
  durationThresholdMinutes: number;
}

export interface Proposal {
  id: string;
  type: "route" | "skill" | "handoff" | "drift" | "duration" | "observation";
  title: string;
  confidence: "low" | "medium" | "high";
  finding: string;
  rationale: string;
  apply: string;
  metadata: Record<string, unknown>;
}
