# Forge

Forge is a set of [pi](https://github.com/badlogic/pi-mono) packages for building an extensible agentic harness around coding, design, and mobile engineering workflows.

## Packages

```txt
packages/
├── forge-core/           # shared harness primitives
├── forge-design-studio/  # PRD → design artifacts pipeline
└── forge-mobile-dev/     # iOS/Android engineering harness
```

## What Forge provides

### `@forge/forge-core`

- `pipeline/state.json` world state
- planning/review skills
- drift detection and drift decisions
- worktree-isolated delegation
- reviewer merge gate
- role-based model routing
- context handoff / context-rot management
- install/package doctor

### `@forge/forge-design-studio`

- design app pipeline
- design brief generation
- style guide generation
- microcopy generation
- screen prompt generation
- design QA

### `@forge/forge-mobile-dev`

- iOS/Android prompt routing
- mobile specialist agents
- simulator/emulator visual verification loop
- crash triage
- deployment helpers
- accessibility/performance/motion/code-signing skills

## Install

### Recommended: one-command GitHub install

```bash
pi install git:github.com/solejay/forge
```

The root package manifest exposes all Forge extensions and skills from `packages/`.

### Local checkout install

From this repository root:

```bash
pi install .
```

or from anywhere:

```bash
pi install /path/to/forge
```

### Advanced: install individual subpackages

Use this only if you want a subset of Forge:

```bash
pi install /path/to/forge/packages/forge-core
pi install /path/to/forge/packages/forge-design-studio
pi install /path/to/forge/packages/forge-mobile-dev
```

Do not install both the root `forge` package and the individual subpackages at the same time, or tools/commands may be registered twice.

After installing or updating extensions, run:

```txt
/reload
```

or restart pi.

## Smoke tests

```bash
npm run smoke
```

This verifies:

- each individual package extension loads in print mode
- the root monorepo package manifest loads all Forge resources
- Forge tools are discoverable

## Doctor

```bash
npm run doctor
```

or in pi:

```txt
/forge-doctor
```

## Current development note

The original local development packages may still exist as siblings:

```txt
../forge-core
../forge-design-studio
../forge-mobile-dev
```

Your active pi settings may point to those sibling paths. This monorepo is the release/package snapshot. If you want this repo to become the active source of truth, remove the sibling package entries and install this root package instead:

```bash
pi remove /Users/olusegunsolaja-mini/Documents/Projects/forge-core
pi remove /Users/olusegunsolaja-mini/Documents/Projects/forge-design-studio
pi remove /Users/olusegunsolaja-mini/Documents/Projects/forge-mobile-dev
pi install /Users/olusegunsolaja-mini/Documents/Projects/forge
```

## Safety

Forge state and diagnostics should never store or commit:

- API keys
- provider tokens
- full transcripts
- private logs
- generated session JSONL files

## License

MIT
