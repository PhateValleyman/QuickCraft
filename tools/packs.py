#!/usr/bin/env python3
"""QuickCraft pack helper.

sync
    Make the behavior pack manifest depend on the resource pack (UUID + current
    version). Minecraft then enables the resource pack automatically whenever the
    behavior pack is activated for a world. Run by `make` before packaging.

activate <world_dir>
    For a world where the behavior pack is already active but the resource pack
    is not: add the resource pack to world_resource_packs.json (and the
    behavior pack to world_behavior_packs.json if it is missing and --with-bp).
    A .bak copy of each changed file is kept.

    Example (Android, Bedrock default storage):
      python3 tools/packs.py activate \
        "/storage/emulated/0/games/com.mojang/minecraftWorlds/<world>"
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BP_MANIFEST = ROOT / "pack/behavior_pack/QuickCraft/manifest.json"
RP_MANIFEST = ROOT / "pack/resource_pack/QuickCraft/manifest.json"


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def dump(path, data):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


def header(manifest_path):
    h = load(manifest_path)["header"]
    return h["uuid"], list(h["version"])


def cmd_sync(_args):
    rp_uuid, rp_version = header(RP_MANIFEST)
    bp = load(BP_MANIFEST)
    deps = bp.setdefault("dependencies", [])
    changed = False
    for dep in deps:
        if dep.get("uuid") == rp_uuid:
            if dep.get("version") != rp_version:
                dep["version"] = rp_version
                changed = True
            break
    else:
        deps.insert(0, {"uuid": rp_uuid, "version": rp_version})
        changed = True
    if changed:
        dump(BP_MANIFEST, bp)
        print(f">> BP manifest now depends on RP {rp_uuid} v{'.'.join(map(str, rp_version))}")
    else:
        print(">> BP -> RP dependency already in sync")
    return 0


def read_list(path):
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as fh:
        text = fh.read().strip()
    return json.loads(text) if text else []


def write_list(path, data):
    if path.exists():
        shutil.copy2(path, path.with_suffix(path.suffix + ".bak"))
    dump(path, data)


def cmd_activate(args):
    world = Path(args.world_dir).expanduser()
    if not (world / "level.dat").exists():
        print(f"!! {world} does not look like a Minecraft world (no level.dat)", file=sys.stderr)
        return 1

    bp_uuid, bp_version = header(BP_MANIFEST)
    rp_uuid, rp_version = header(RP_MANIFEST)
    bp_file = world / "world_behavior_packs.json"
    rp_file = world / "world_resource_packs.json"

    bps = read_list(bp_file)
    bp_active = any(e.get("pack_id") == bp_uuid for e in bps)
    if not bp_active and args.with_bp:
        bps.append({"pack_id": bp_uuid, "version": bp_version})
        write_list(bp_file, bps)
        bp_active = True
        print(">> behavior pack activated")
    if not bp_active:
        print("-- behavior pack is not active in this world; nothing to do (use --with-bp to enable both)")
        return 0

    rps = read_list(rp_file)
    for entry in rps:
        if entry.get("pack_id") == rp_uuid:
            if entry.get("version") != rp_version:
                entry["version"] = rp_version
                write_list(rp_file, rps)
                print(">> resource pack version updated")
            else:
                print("-- resource pack already active")
            return 0
    rps.append({"pack_id": rp_uuid, "version": rp_version})
    write_list(rp_file, rps)
    print(">> resource pack activated")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("sync").set_defaults(func=cmd_sync)
    act = sub.add_parser("activate")
    act.add_argument("world_dir")
    act.add_argument("--with-bp", action="store_true", help="also activate the behavior pack if missing")
    act.set_defaults(func=cmd_activate)
    args = parser.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
