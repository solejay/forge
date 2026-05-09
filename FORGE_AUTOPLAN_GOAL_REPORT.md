# Forge Auto-Plan + Goal Readiness Report

## Summary

This checkout implements conservative automatic Forge planning and a persistent Forge goal loop in `forge-core`.

The feature set is ready for local Pi harness validation:

- meaningful prompts are automatically routed through `forge-plan`
- long-running objectives can be stored with `forge_goal`
- active goals inject continuation guidance on each agent start
- token-budget exhaustion moves goals to `budget_limited`
- handoff packets include active goal state
- drift detection records goal notes and pauses goals when drift handling is stopped

## Installed Surface Area

### New tool

```txt
forge_goal
```

Supported actions:

```txt
set
status
pause
resume
complete
unmet
clear
```

Completion requires audit evidence:

```txt
forge_goal action=complete audit="Mapped deliverables to files changed and tests run."
```

### New command

```txt
/forge-goal <objective>
```

Without arguments, `/forge-goal` asks the agent to report goal status.

### Updated state

`pipeline/state.json` now migrates to include:

```json
"goal": {
  "objective": null,
  "status": "idle",
  "started_at": null,
  "updated_at": null,
  "token_budget": null,
  "tokens_used": null,
  "time_budget_seconds": null,
  "completed_audit": null,
  "notes": []
}
```

Goal statuses:

```txt
idle
pursuing
paused
complete
unmet
budget_limited
```

## Auto-Plan Behavior

Forge Core now inspects normal user prompts in the `input` hook.

It auto-routes prompts through planning when the classifier detects:

```txt
bug
feature
refactor
design
performance
accessibility
deployment
```

It skips:

```txt
trivial edits
research prompts
unknown prompts
slash commands
status/review/handoff/doctor prompts
active tasks that already have a plan
blocked tasks
```

When triggered, Forge appends:

```md
## Forge Auto-Plan
Detected task intent: <type> / <complexity>.
Use the forge-plan skill first for the original request.
Create or update the plan contract in `pipeline/state.json` before broad execution.
After the plan contract is written, execute the planned work and update Forge progress as steps complete.
```

## Goal Continuation Behavior

When `goal.status === "pursuing"`, Forge injects a continuation block into the agent system prompt.

The objective is wrapped as untrusted data:

```md
<untrusted_objective>
...
</untrusted_objective>
```

The injected guidance tells the agent to:

- continue toward the active Forge goal
- avoid repeating completed work
- choose the next concrete action
- audit completion before marking the goal complete
- only call `forge_goal action=complete` with concrete evidence

When `goal.status === "budget_limited"`, Forge injects wrap-up guidance and tells the agent not to start new substantive work.

## Files Changed

Core implementation:

```txt
packages/forge-core/extensions/forge-core/index.ts
packages/forge-core/extensions/forge-core/tools/forge-goal.ts
packages/forge-core/extensions/forge-core/state/schema.ts
packages/forge-core/extensions/forge-core/state/store.ts
packages/forge-core/extensions/forge-core/hooks/context-monitor.ts
packages/forge-core/extensions/forge-core/hooks/drift-runtime.ts
packages/forge-core/extensions/forge-core/handoff/packet.ts
packages/forge-core/extensions/forge-core/tools/forge-doctor.ts
```

Docs and validation:

```txt
README.md
packages/forge-core/README.md
scripts/smoke-test.sh
FORGE_AUTOPLAN_GOAL_REPORT.md
```

## Validation Run

Commands run from:

```txt
/Users/olusegunsolaja-mini/Documents/Projects/forge
```

Validation:

```bash
bash scripts/smoke-test.sh
git diff --check
```

Result:

```txt
== Forge smoke tests passed ==
git diff --check passed with no output
```

Smoke output confirmed these tools are available from the root package:

```txt
forge_status
forge_update_state
forge_goal
forge_record_artifact
forge_worktree_delegate
forge_review_worktree
forge_model_route
forge_handoff
forge_drift_decision
forge_doctor
forge_signal
forge_crucible
forge_anneal
crucible_status
```

Smoke output confirmed these tools are available from `forge-core` alone:

```txt
forge_status
forge_update_state
forge_goal
forge_record_artifact
forge_worktree_delegate
forge_review_worktree
forge_model_route
forge_handoff
forge_drift_decision
forge_doctor
```

## Harness Checklist

Use this checklist in Pi:

```txt
/reload
/forge-status
/forge-goal Finish a small validation task and verify the goal loop
Run forge_goal action=status and summarize it.
```

Then test auto-plan with a normal prompt:

```txt
Add offline caching to the transactions screen.
```

Expected behavior:

- the prompt is transformed with `## Forge Auto-Plan`
- the agent uses the `forge-plan` skill before broad execution
- `pipeline/state.json` receives a plan contract

Test a skipped prompt:

```txt
What does forge_status show?
```

Expected behavior:

- no auto-plan routing
- the agent answers/status-checks directly

## Notes

The existing untracked `.omc/` and `pipeline/` directories were not part of this implementation. They existed in the worktree before the final change set and should be reviewed separately if needed.
