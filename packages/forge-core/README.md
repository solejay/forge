# forge-core

Core agentic harness primitives for pi.

`forge-core` gives vertical pi packages a shared world state and a consistent plan → execute → review loop.

## What it provides

- `pipeline/state.json` world state
- `forge_status` tool and `/forge-status` command
- `forge_update_state` tool for structured state updates
- `forge_record_artifact` tool for design/engineering handoff artifacts
- `forge-plan` skill
- `forge-review` skill
- Basic context shield for prompt-injection/noise filtering
- Stage 2 drift detection + human escalation gate
- Stage 3 worktree-isolated delegation for safe parallel sub-agents
- Stage 5 role-based model routing for explore/plan/implement/review/commit agents
- Stage 6 handoff / context-rot management with `/forge-handoff`
- Stage 7 drift tuning / false-positive reduction with explicit drift decisions
- Stage 8 package polish + install doctor diagnostics

## Install

Recommended root package install:

```bash
pi install git:github.com/solejay/forge@v0.1.0
```

For local development from a Forge checkout:

```bash
pi install /path/to/forge
```

## Stage 2: Drift detection and escalation

Forge Core classifies incoming tasks and stores the original task type/complexity in `pipeline/state.json`. During the agent run, it watches for conservative drift signals:

- scope-expansion language such as “turns out we also need…” or “this requires a larger refactor”
- task reclassification such as bug → refactor or feature → architecture
- complexity spikes such as low → high
- excessive mutation fan-out relative to the plan
- broad shell commands that can reshape the project

When drift is detected, Forge records:

```txt
current_task.drift.detected = true
current_task.drift.signals = [...]
current_task.drift.reclassification = {...}
current_task.drift.escalation_required = true
```

In interactive mode, Forge asks the human to choose:

```txt
continue / replan / stop
```

In non-interactive mode, Forge marks the task blocked and records the escalation in `pipeline/state.json` without deadlocking.

## Stage 3: Worktree-isolated delegation

Forge Core provides `forge_worktree_delegate`, a generic sub-agent delegation tool that can run a focused pi agent in either:

```txt
isolation=none      # same checkout, useful for read-only exploration
isolation=worktree  # separate git worktree and branch, useful for parallel implementation
```

Worktree mode creates a branch like:

```txt
forge/<task>-<timestamp>
```

and returns:

- worktree path
- branch name
- base branch
- exit code
- cleanup status
- manual merge instructions

Stage 3 intentionally does **not** auto-merge branches. A reviewer/human should inspect the worktree, run tests/builds, and merge only after validation.

## Stage 4: Reviewer merge gate

Forge Core provides `forge_review_worktree`, a reviewer gate for branches produced by `forge_worktree_delegate`.

Actions:

```txt
review    # summarize changed files, commits, and diff stats; default and non-mutating
validate  # run explicit validation commands in the worktree
merge     # merge branch into base branch only when requested
cleanup   # remove clean worktree
```

Safety defaults:

- default action is `review`
- merge is never automatic
- merge refuses uncommitted worktree changes
- merge refuses failed validation unless `allowMergeWithFailedValidation=true`
- validation commands are explicit caller-provided shell commands
- cleanup preserves dirty worktrees for inspection

Typical flow:

```txt
forge_worktree_delegate(... isolation="worktree")
        ↓
forge_review_worktree(action="review")
        ↓
forge_review_worktree(action="validate", validationCommands=[...])
        ↓
forge_review_worktree(action="merge", cleanupAfterMerge=true)
```

## Stage 5: Role-based model routing

Forge Core provides `forge_model_route`, a safe role-routing layer for model selection.

Roles:

```txt
default
quick
explore
plan
implement
review
commit
```

Optional config files:

```txt
pipeline/model-routes.json
.forge/model-routes.json
```

Example:

```json
{
  "quick": { "modelString": "openrouter/openai/gpt-5.5-mini", "thinkingLevel": "low" },
  "plan": { "modelString": "openrouter/openai/gpt-5.5", "thinkingLevel": "high" },
  "review": { "modelString": "openrouter/anthropic/claude-sonnet-4.5", "thinkingLevel": "high" }
}
```

Rules:

- config stores provider/model identifiers only, never API keys
- default behavior remains the current model when no role route is configured
- `forge_model_route action=show` is non-mutating
- `forge_model_route action=switch` attempts `pi.setModel` and reports safely when the model or credentials are unavailable
- `forge_worktree_delegate` and mobile `delegate_to_agent` can pass role/model to sub-agent invocations

## Stage 6: Handoff / context-rot management

Forge Core provides `forge_handoff` and `/forge-handoff` to move long-running work into a fresh session without carrying the entire conversation.

Tool actions:

```txt
snapshot  # build a handoff packet from pipeline/state.json; non-mutating by default
record    # snapshot + record a handoff event in history.handoffs
queue     # queue the fresh-session prompt as a follow-up user message
```

Interactive command:

```txt
/forge-handoff <goal>
```

The command builds a handoff prompt from `pipeline/state.json`, lets you edit it, then uses `ctx.newSession` to create a fresh pi session. Post-switch work uses only the replacement-session context to avoid stale-ctx errors.

Context monitor:

- warns when context usage exceeds `FORGE_CONTEXT_WARN_TOKENS` (default `120000`)
- warns more strongly at `FORGE_CONTEXT_CRITICAL_TOKENS` (default `170000`)
- never auto-switches sessions

Safety rules:

- handoff packets contain Forge world state and artifact references only
- no full transcripts
- no secrets/API keys/private logs
- fresh sessions should start by running `forge_status`

## Stage 7: Drift tuning / false-positive reduction

Forge Core tunes drift detection to avoid blocking normal planned work while preserving semantic escalation.

Tuning behavior:

- mutation fan-out thresholds scale with task complexity and plan step count
- medium/high planned feature work can touch more files without mechanical drift
- validation/smoke-test commands in `/tmp/forge-*` are treated as benign
- build/test commands like `npm test`, `xcodebuild`, `swift test`, `./gradlew`, and `grep -q` are not treated as broad dangerous commands
- after verification has passed, purely mechanical drift is suppressed unless new semantic/risky signals appear
- semantic scope signals still escalate, e.g. “turns out we also need…”, “requires larger refactor”, “need to change the API”

Forge Core also provides `forge_drift_decision`:

```txt
continue  # accept drift and unblock current task
replan    # return to planning with drift evidence preserved
stop      # keep task blocked
clear     # clear false-positive drift and unblock
```

Use it when the human chooses a path after a drift escalation.

## Stage 8: Package polish + install doctor

Forge Core provides `forge_doctor` and `/forge-doctor` for read-only harness diagnostics.

Report sections:

- global pi settings and package references
- forge-core / forge-mobile-dev / forge-design-studio package paths
- package manifest names and `pi` manifests
- important extension and skill files
- active Forge tool registration in the current runtime
- `pipeline/state.json` schema, verification, and drift health

Usage:

```txt
forge_doctor
/forge-doctor
```

Safety rules:

- read-only diagnostics by default
- warns instead of auto-repairing
- no secrets, transcripts, or API keys are written or displayed
- missing vertical packages are warnings/failures with path evidence, not destructive fixes

## State file

Forge stores portable state at:

```txt
pipeline/state.json
```

This file is intended for task state and cross-package handoff. Do not store secrets or full conversation transcripts.
