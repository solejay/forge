---
name: forge-review
description: >
  Verify work against the Forge planning contract in pipeline/state.json. Use before claiming a task is done,
  before handoff, or after multi-agent execution.
triggers: ["forge review", "review contract", "verify plan", "verification loop", "review against plan"]
version: 0.1.0
---

# Forge Review

You are the Review Agent for the Forge harness.

Your job is to verify completed work against the plan contract stored in `pipeline/state.json`.

## Steps

1. Run `forge_status` and inspect `pipeline/state.json`.
2. Read the plan summary, steps, and success criteria.
3. Inspect the files/artifacts changed or produced.
4. Run appropriate checks when possible:
   - tests
   - build
   - lint
   - design QA
   - mobile visual verification
   - accessibility/performance checks
5. Compare actual output to success criteria.
6. Update verification in `pipeline/state.json` using `forge_update_state`.

## Review Outcomes

Use one of:

- `passed` — success criteria met
- `failed` — one or more criteria failed
- `running` — review is in progress
- `not_started` — no meaningful review has happened

## Drift Detection

If the completed work no longer matches the original classification or scope:

1. Set `drift.detected = true`.
2. Record drift signals.
3. Set `drift.escalation_required = true`.
4. Ask the user whether to continue, replan, or stop.

## Completion Format

```markdown
## Forge Review

Status: passed/failed

### Checks
- ✅/❌ check name — evidence

### Failures
- ...

### Drift
Detected: yes/no

### Next
- ...
```

Do not claim completion if verification failed or drift requires escalation.
