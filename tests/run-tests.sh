#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LUANTI="/workspace/luanti"
RUNROOT="${TMPDIR:-/tmp}/quickcraft-luanti-verify-${USER:-user}-$$"
mkdir -p "$RUNROOT"

for game in minetest VoxeLibre; do
	world="$RUNROOT/$game"
	port=31989
	if [ "$game" = "VoxeLibre" ]; then port=31990; fi
	mkdir -p "$world/worldmods"
	ln -s "$ROOT" "$world/worldmods/quickcraft"
	ln -s "$ROOT/tests/quickcraft_verify" "$world/worldmods/quickcraft_verify"
	cat > "$world/world.mt" <<EOF
gameid = $game
world_name = QuickCraft isolated verification ($game)
backend = sqlite3
mod_storage_backend = sqlite3
load_mod_quickcraft = true
load_mod_quickcraft_verify = true
server_announce = false
EOF
	cat > "$world/luanti.conf" <<EOF
server_announce = false
bind_address = 127.0.0.1
port = $port
EOF
	printf '\n=== Testing %s ===\n' "$game"
	(
		cd "$LUANTI"
		timeout 180 ./bin/luantiserver --world "$world" --gameid "$game" --config "$world/luanti.conf" --port "$port" --logfile "$world/server.log" --color never
	)
	cat "$world/quickcraft-verify.txt"
done
printf '\nAll isolated QuickCraft tests passed. Logs: %s\n' "$RUNROOT"
