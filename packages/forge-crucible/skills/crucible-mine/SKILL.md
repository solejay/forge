---
name: crucible-mine
description: Mine Forge Crucible self-improvement signals into human-reviewable proposals. Use when the user asks to run crucible, mine signals, improve Forge from its history, find recurring drift, route failures, skill gaps, or ouroboros-style harness improvements.
version: 0.1.0
---

# Crucible Mine

You are mining Forge's structured task outcome memory.

## Workflow

1. Run `crucible_status` to inspect `pipeline/signal-log.jsonl` volume and health.
2. Run `forge_crucible` to generate `pipeline/crucible-proposals.md`.
3. Read the proposals file if the user wants details.
4. Summarize findings clearly:
   - route proposals
   - skill-gap proposals
   - drift/planning proposals
   - duration/handoff proposals
5. Do **not** apply anything automatically.

## Rules

- Crucible mining is proposal-only.
- The user must mark proposals with `[APPLY]` before annealing.
- Never store secrets, full transcripts, private logs, or raw command output in signal/proposal files.
- If the signal log is empty or tiny, recommend collecting more signals with `forge_signal` after real tasks.

## Completion

End with:

```markdown
## Crucible Mining Complete

Proposals written: pipeline/crucible-proposals.md
Apply status: waiting for human review
Next step: mark approved proposals with [APPLY], then run /crucible-anneal
```
