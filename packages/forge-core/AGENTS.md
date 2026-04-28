# Forge Core Context

Forge Core provides generic harness primitives for pi packages.

## Core Mental Model

Every meaningful task should move through:

1. **Route** — classify task type and complexity.
2. **Plan Contract** — write intent, steps, risks, assumptions, and success criteria.
3. **Execute** — act with the minimum viable context.
4. **Review** — verify output against the plan contract.
5. **Update World State** — persist progress to `pipeline/state.json`.
6. **Escalate on Drift** — if task type or scope changes, pause and ask the user.

## World State

Forge uses `pipeline/state.json` as portable project world state. It may be committed as a handoff artifact. Do not store secrets, full transcripts, private logs, or API keys in it.

## Rules

- Always prefer explicit plans over hidden assumptions.
- Always verify against success criteria before claiming done.
- Keep design and engineering artifacts in `pipeline/`.
- Use Forge state as shared memory, not as an execution log dump.
