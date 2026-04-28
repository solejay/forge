export type TaskStatus = "idle" | "planning" | "in_progress" | "blocked" | "reviewing" | "done" | "cancelled";
export type VerificationStatus = "not_started" | "running" | "passed" | "failed";
export type Complexity = "trivial" | "low" | "medium" | "high" | "unknown";

export interface Classification {
  type: string | null;
  complexity: Complexity | null;
  confidence: number | null;
  scores: Record<string, unknown>;
}

export interface PlanContract {
  summary: string | null;
  steps: string[];
  success_criteria: string[];
  risks: string[];
  assumptions: string[];
}

export interface ProgressState {
  current_step: string | null;
  completed_steps: string[];
  blocked: boolean;
  blockers: string[];
}

export interface VerificationCheck {
  name: string;
  status: "not_started" | "passed" | "failed" | "skipped";
  evidence?: string;
}

export interface VerificationState {
  status: VerificationStatus;
  checks: VerificationCheck[];
  failures: string[];
  last_review: string | null;
}

export interface DriftState {
  detected: boolean;
  signals: string[];
  reclassification: Classification | null;
  escalation_required: boolean;
  human_decision: string | null;
}

export interface CurrentTask {
  id: string | null;
  title: string | null;
  status: TaskStatus;
  classification: Classification;
  original_classification: Classification | null;
  plan: PlanContract;
  progress: ProgressState;
  verification: VerificationState;
  drift: DriftState;
}

export interface ForgeArtifacts {
  prd: string | null;
  design_brief: string | null;
  style_guide: string | null;
  copy_deck: string | null;
  backend_api_spec: string | null;
  screens: string[];
  screen_prompts: string[];
  [key: string]: string | string[] | null;
}

export interface ForgeState {
  version: 1;
  project: {
    name: string | null;
    type: string | null;
    platforms: string[];
  };
  current_task: CurrentTask;
  artifacts: ForgeArtifacts;
  history: {
    completed_tasks: CurrentTask[];
    handoffs: Array<{
      at: string;
      from?: string;
      to?: string;
      summary: string;
    }>;
  };
  updated_at: string;
}

export function createDefaultForgeState(): ForgeState {
  return {
    version: 1,
    project: {
      name: null,
      type: null,
      platforms: [],
    },
    current_task: {
      id: null,
      title: null,
      status: "idle",
      classification: {
        type: null,
        complexity: null,
        confidence: null,
        scores: {},
      },
      original_classification: null,
      plan: {
        summary: null,
        steps: [],
        success_criteria: [],
        risks: [],
        assumptions: [],
      },
      progress: {
        current_step: null,
        completed_steps: [],
        blocked: false,
        blockers: [],
      },
      verification: {
        status: "not_started",
        checks: [],
        failures: [],
        last_review: null,
      },
      drift: {
        detected: false,
        signals: [],
        reclassification: null,
        escalation_required: false,
        human_decision: null,
      },
    },
    artifacts: {
      prd: "pipeline/prd.md",
      design_brief: null,
      style_guide: null,
      copy_deck: null,
      backend_api_spec: null,
      screens: [],
      screen_prompts: [],
    },
    history: {
      completed_tasks: [],
      handoffs: [],
    },
    updated_at: new Date().toISOString(),
  };
}
