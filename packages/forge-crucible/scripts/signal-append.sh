#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"
mkdir -p "$ROOT/pipeline"
node -e '
const fs = require("fs");
const path = require("path");
const root = process.argv[1];
const statePath = path.join(root, "pipeline/state.json");
let state = {};
try { state = JSON.parse(fs.readFileSync(statePath, "utf8")); } catch {}
const task = state.current_task || {};
const verification = task.verification || {};
const drift = task.drift || {};
const failedChecks = Array.isArray(verification.checks) ? verification.checks.filter(c => c && c.status === "failed").length : 0;
const record = {
  schema_version: 1,
  kind: "task",
  ts: new Date().toISOString(),
  task_id: task.id || null,
  task_title: task.title || null,
  task_type: task.classification?.type || null,
  task_complexity: task.classification?.complexity || null,
  task_status: task.status || null,
  verification_status: verification.status || null,
  verification_passed: verification.status === "passed" ? true : (verification.status === "failed" || failedChecks > 0 ? false : null),
  verification_failed_checks: failedChecks,
  drift_detected: Boolean(drift.detected),
  drift_count: Array.isArray(drift.signals) ? drift.signals.length : 0,
  escalation_required: Boolean(drift.escalation_required),
  handoff_triggered: false,
  worktree_used: false,
  skills_invoked: [],
  tools_invoked: ["signal-append.sh"],
  model_route: null,
  current_model: null,
  duration_minutes: null,
  source: "manual",
  privacy: { transcript_stored: false, secrets_stored: false }
};
fs.appendFileSync(path.join(root, "pipeline/signal-log.jsonl"), JSON.stringify(record) + "\n");
console.log("Appended signal to pipeline/signal-log.jsonl");
' "$ROOT"
