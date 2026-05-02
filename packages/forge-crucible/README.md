# @forge/forge-crucible

Forge Crucible is the self-improvement layer for the Forge pi harness.

It implements the Ouroboros-style feedback loop in a conservative, Forge-native way:

```text
signal → mine → anneal → signal
```

## Components

- `forge_signal` appends privacy-safe task outcome records to `pipeline/signal-log.jsonl`.
- `crucible_status` summarizes the signal log.
- `forge_crucible` mines accumulated signals and writes human-reviewable proposals to `pipeline/crucible-proposals.md`.
- `forge_anneal` applies only proposals explicitly marked `[APPLY]`.

## Files

- `pipeline/signal-log.jsonl` — structured task outcome memory.
- `pipeline/crucible-proposals.md` — findings and proposed harness improvements.
- `pipeline/model-routes.json` — optional route file that route annealing can scaffold/update.
- `packages/forge-crucible/skills/generated/` — optional generated skill stubs.

## Safety Model

Crucible does not store full transcripts, private logs, secrets, or raw command output. Signal records contain compact task metadata: type, verification status, drift count, route, tool/skill names, duration, and short sanitized notes.

Mining never mutates harness behavior. Annealing only acts on proposals the user marked `[APPLY]`, and risky prompt/handoff/drift proposals remain manual in this first version.

## Recommended Use

1. Let the event hook and/or `forge_signal` collect signals after meaningful Forge tasks.
2. Run `/crucible-status` to see whether enough data exists.
3. Run `/crucible-mine` to produce proposals.
4. Review `pipeline/crucible-proposals.md` and mark approved proposals `[APPLY]`.
5. Run `/crucible-anneal`.
6. Keep measuring via the signal log.
