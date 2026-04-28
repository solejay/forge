---
name: forge-handoff
description: >
  Create a concise Forge handoff packet for context-rot management. Use when the session is long,
  context is noisy, or a fresh session should continue from pipeline/state.json.
triggers: ["forge handoff", "context rot", "fresh session", "handoff", "continue in new session"]
version: 0.1.0
---

# Forge Handoff

Use this skill to prevent long-session context rot.

## Steps

1. Run `forge_status`.
2. Run `forge_handoff` with `action="snapshot"` and an optional `goal`.
3. Review the handoff packet. It should contain:
   - current task
   - plan summary
   - completed steps
   - current step
   - verification status
   - drift status
   - artifact references
4. If interactive and the user wants a fresh session, tell them to run `/forge-handoff <goal>`.

## Rules

- Do not store secrets, full transcripts, private logs, or API keys in handoff state.
- Handoff should rely on `pipeline/state.json`, not raw conversation history.
- If drift is detected, replan before continuing in the fresh session.

## Output

Summarize the handoff and next recommended action.
