#!/usr/bin/env bash
set -euo pipefail

cat <<'MSG'
Use the pi tool `forge_anneal` or command `/crucible-anneal` to apply proposals marked [APPLY].
This shell shim intentionally does not patch files; annealing safety logic lives in the Forge Crucible extension.
MSG
