# QuickCraft Project Skill

## Scope

QuickCraft is a Minecraft Bedrock add-on targeting Minecraft 1.21.80+ with `@minecraft/server` 2.0.0 and `@minecraft/server-ui` 2.0.0.

## Layout

- `pack/behavior_pack/QuickCraft/` — behavior pack, items, recipes, scripts and structures.
- `pack/resource_pack/QuickCraft/` — resource pack, shared item/terrain atlases and UI.
- `tools/scan_structures.py` — generates exact `.mcstructure` dimensions.
- `Makefile` — scans structures and builds `.mcpack` / `.mcaddon` archives.
- `dist/` — local release artifacts; keep them available for GitHub Release uploads.

## Change rules

- Keep behavior and resource pack manifest versions synchronized.
- Use feature branches; do not merge into `master` unless explicitly requested.
- JavaScript comments are written in English.
- Keep player-facing guide and README instructions synchronized with behavior changes.
- After every pack change, run JSON and JavaScript validation, rebuild all artifacts, and upload `.mcpack` and `.mcaddon` files to a versioned GitHub Release.

## Validation and release

```bash
# Validate every JSON resource.
for f in $(find pack -type f -name '*.json' -print); do python3 -m json.tool "$f" >/dev/null; done

# Validate every behavior-pack JavaScript source.
for f in $(find pack/behavior_pack/QuickCraft/scripts -type f -name '*.js' -print); do node --check "$f"; done

# Scan structures and build both packs plus the addon.
make clean addon
```

Use a patch release for guide/documentation-only changes, tag it as `vMAJOR.MINOR.PATCH`, and upload `dist/QuickCraft_BP.mcpack`, `dist/QuickCraft_RP.mcpack`, and `dist/QuickCraft.mcaddon` to the GitHub Release.
