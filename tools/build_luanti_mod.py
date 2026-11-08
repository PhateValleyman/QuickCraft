#!/usr/bin/env python3
"""Convert QuickCraft Bedrock .mcstructure assets to compressed Luanti inputs.

The output is a private-use conversion of PhateValleyman/QuickCraft. It retains
block names and states in a compact zlib-compressed JSON payload; the Luanti mod
maps those source blocks to nodes available in the active game at placement time.
"""
from __future__ import annotations

import argparse
import json
import re
import struct
import sys
import zlib
from pathlib import Path
from typing import Any

TAG_END = 0
TAG_BYTE = 1
TAG_SHORT = 2
TAG_INT = 3
TAG_LONG = 4
TAG_FLOAT = 5
TAG_DOUBLE = 6
TAG_BYTE_ARRAY = 7
TAG_STRING = 8
TAG_LIST = 9
TAG_COMPOUND = 10
TAG_INT_ARRAY = 11
TAG_LONG_ARRAY = 12


class NBTReader:
	def __init__(self, data: bytes) -> None:
		self.data = data
		self.pos = 0

	def take(self, count: int) -> bytes:
		if count < 0 or self.pos + count > len(self.data):
			raise ValueError("truncated or invalid NBT payload")
		out = self.data[self.pos:self.pos + count]
		self.pos += count
		return out

	def string(self) -> str:
		length = struct.unpack("<H", self.take(2))[0]
		return self.take(length).decode("utf-8", errors="replace")

	def payload(self, tag: int) -> Any:
		if tag == TAG_BYTE:
			return struct.unpack("<b", self.take(1))[0]
		if tag == TAG_SHORT:
			return struct.unpack("<h", self.take(2))[0]
		if tag == TAG_INT:
			return struct.unpack("<i", self.take(4))[0]
		if tag == TAG_LONG:
			return struct.unpack("<q", self.take(8))[0]
		if tag == TAG_FLOAT:
			return struct.unpack("<f", self.take(4))[0]
		if tag == TAG_DOUBLE:
			return struct.unpack("<d", self.take(8))[0]
		if tag == TAG_BYTE_ARRAY:
			length = struct.unpack("<i", self.take(4))[0]
			if length < 0:
				raise ValueError("negative byte array length")
			return self.take(length)
		if tag == TAG_STRING:
			return self.string()
		if tag == TAG_LIST:
			child = self.take(1)[0]
			count = struct.unpack("<i", self.take(4))[0]
			if count < 0:
				raise ValueError("negative NBT list length")
			return [self.payload(child) for _ in range(count)]
		if tag == TAG_COMPOUND:
			result = {}
			while True:
				child = self.take(1)[0]
				if child == TAG_END:
					return result
				name = self.string()
				result[name] = self.payload(child)
		if tag == TAG_INT_ARRAY:
			count = struct.unpack("<i", self.take(4))[0]
			if count < 0:
				raise ValueError("negative NBT int-array length")
			return [item[0] for item in struct.iter_unpack("<i", self.take(count * 4))]
		if tag == TAG_LONG_ARRAY:
			count = struct.unpack("<i", self.take(4))[0]
			if count < 0:
				raise ValueError("negative NBT long-array length")
			return [item[0] for item in struct.iter_unpack("<q", self.take(count * 8))]
		raise ValueError(f"unsupported NBT tag {tag}")

	def root(self) -> dict[str, Any]:
		tag = self.take(1)[0]
		if tag != TAG_COMPOUND:
			raise ValueError("root tag is not a compound")
		self.string()
		return self.payload(TAG_COMPOUND)


def read_mcstructure(path: Path) -> tuple[list[int], list[dict[str, Any]], list[int], list[int], int, int]:
	root = NBTReader(path.read_bytes()).root()
	size = root.get("size")
	structure = root.get("structure")
	if not isinstance(size, list) or len(size) != 3 or any(not isinstance(n, int) or n < 1 for n in size):
		raise ValueError("missing or invalid size")
	if not isinstance(structure, dict):
		raise ValueError("missing structure compound")
	layers = structure.get("block_indices")
	palette_root = structure.get("palette", {}).get("default", {})
	palette = palette_root.get("block_palette") if isinstance(palette_root, dict) else None
	if not isinstance(layers, list) or not layers or not isinstance(layers[0], list):
		raise ValueError("missing block_indices")
	if not isinstance(palette, list) or not palette:
		raise ValueError("missing default block_palette")
	expected = size[0] * size[1] * size[2]
	primary = layers[0]
	secondary = layers[1] if len(layers) > 1 and isinstance(layers[1], list) else []
	if len(primary) != expected:
		raise ValueError(f"primary block count {len(primary)} does not match size {size} ({expected})")
	if secondary and len(secondary) != expected:
		raise ValueError("secondary block layer has a different length")
	clean_palette = []
	for entry in palette:
		if not isinstance(entry, dict) or not isinstance(entry.get("name"), str):
			raise ValueError("invalid block palette entry")
		clean_palette.append({"n": entry["name"], "s": entry.get("states", {})})
	entities = structure.get("entities", [])
	block_positions = palette_root.get("block_position_data", {}) if isinstance(palette_root, dict) else {}
	entity_count = len(entities) if isinstance(entities, list) else 0
	block_position_count = len(block_positions) if isinstance(block_positions, (dict, list)) else 0
	return size, clean_palette, primary, secondary, entity_count, block_position_count


def load_catalog(source_root: Path) -> list[dict[str, Any]]:
	text = (source_root / "scripts" / "catalog.js").read_text(encoding="utf-8")
	match = re.search(r"export\s+const\s+CATEGORIES\s*=\s*(\[.*\]);?\s*$", text, re.S)
	if not match:
		raise ValueError("could not find CATEGORIES JSON in scripts/catalog.js")
	return json.loads(match.group(1))


def convert(source_root: Path, output: Path) -> dict[str, Any]:
	structures_dir = source_root / "structures"
	files = sorted(structures_dir.rglob("*.mcstructure"))
	if not files:
		raise FileNotFoundError(f"no .mcstructure files in {structures_dir}")
	output.mkdir(parents=True, exist_ok=True)
	converted = []
	errors = []
	uncompressed_total = 0
	compressed_total = 0
	ignored_entity_total = 0
	ignored_block_position_total = 0
	for number, path in enumerate(files, start=1):
		try:
			size, palette, primary, secondary, entity_count, block_position_count = read_mcstructure(path)
			payload = json.dumps(
				{"v": 1, "size": size, "palette": palette, "layers": [primary, secondary]},
				ensure_ascii=False,
				separators=(",", ":"),
			).encode("utf-8")
			compressed = zlib.compress(payload, level=9)
			relative = path.relative_to(structures_dir).with_suffix(".qcs")
			out_path = output / relative
			out_path.parent.mkdir(parents=True, exist_ok=True)
			out_path.write_bytes(compressed)
			uncompressed_total += len(payload)
			compressed_total += len(compressed)
			ignored_entity_total += entity_count
			ignored_block_position_total += block_position_count
			converted.append({"file": relative.as_posix(), "size": size, "bytes": len(compressed), "ignored_entities": entity_count, "ignored_block_position_data": block_position_count})
			if number % 50 == 0 or number == len(files):
				print(f"converted {number}/{len(files)}: {path.name}", flush=True)
		except (OSError, UnicodeError, ValueError, KeyError, TypeError) as exc:
			errors.append({"file": path.relative_to(structures_dir).as_posix(), "error": str(exc)})
			print(f"WARN: {path.name}: {exc}", file=sys.stderr, flush=True)

	categories = load_catalog(source_root)
	file_by_id = {Path(item["file"]).stem: item for item in converted}
	for category in categories:
		for item in category.get("items", []):
			available = file_by_id.get(item.get("id"))
			item["available"] = bool(available)
			if available:
				item["size"] = available["size"]
	catalog = {"version": 1, "categories": categories}
	(output.parent / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
	(output.parent / "conversion-report.json").write_text(json.dumps({
		"source": "PhateValleyman/QuickCraft",
		"source_file_count": len(files),
		"converted_count": len(converted),
		"errors": errors,
		"uncompressed_json_bytes": uncompressed_total,
		"compressed_qcs_bytes": compressed_total,
		"ignored_entity_count": ignored_entity_total,
		"ignored_block_position_data_count": ignored_block_position_total,
		"converted": converted,
	}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
	print(f"OK: {len(converted)}/{len(files)} structures; {compressed_total:,} compressed bytes")
	return {"files": len(files), "converted": len(converted), "errors": errors, "compressed_bytes": compressed_total}


def main() -> int:
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("--source-root", type=Path, default=Path("/workspace/QuickCraft/pack/behavior_pack/QuickCraft"))
	parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "structures")
	args = parser.parse_args()
	result = convert(args.source_root, args.output)
	return 0 if not result["errors"] else 1


if __name__ == "__main__":
	raise SystemExit(main())
