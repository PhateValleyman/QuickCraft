# QuickCraft

A lightweight Minecraft Bedrock (PE) add-on that adds a clean menu for quickly building pre-made structures — houses, farms, decorations, and more. Instead of manually typing `/structure load` commands, open the menu, pick a build, and place it with one click.

---

## ✨ Features

- **Visual structure menu** — categories such as *Starter Homes*, *Farms*, *Decorations*, and more.
- **Open the menu in three ways:** Quick Craft item, `!qc` / `!menu`, or `/scriptevent qc:menu`.
- **Search** — find structures by name.
- **Favorites and recently built** — quick access to frequently used builds.
- **Build settings** — placement, rotation, mirroring, terrain foundation, animation and offsets.
- **Automatic structure dimensions** — every `.mcstructure` is scanned at build time and its exact X/Y/Z size is generated into the add-on.
- **Custom structures** — register your own `.mcstructure` files from the behavior pack or world.
- **Persistent structure instances** — every structure built through QuickCraft gets a visible control stone anchored to its top corner.
- **Control stone administration** — tap a control stone to favorite, move or remove that exact placed structure.
- **Move mode** — when a structure is moved, the structure disappears while its control stone remains visible until the new location is chosen.
- **World / template export** — guided native `.mcworld` / `.mctemplate` export.
- **Custom QuickCraft UI** — the resource pack adds a branded form panel with a crafting-table theme to QuickCraft server forms.
- **Craftable tools** — the menu, building wand and in-game guide are available through custom crafting recipes.
- **Unified QuickCraft icons** — custom items and the `qc:control` block resolve their icons through one shared resource/terrain atlas.

---

## 🪨 Structure Control Stones

QuickCraft now treats a placed structure as an **instance**, not just a one-time `/structure load` operation.

After a successful build, QuickCraft records:

- structure ID and name,
- dimension,
- exact origin,
- effective dimensions after rotation,
- rotation and mirroring,
- owner and instance ID.

A `qc:control` control marker using the existing transparent `qc_menu.png` artwork is placed at the **exact origin corner** of the instance. It is part of the structure control system and is never treated as normal player-build content.

Tap the stone to open:

- ⭐ **Add/remove from favorites**
- 🔵 **Move**
- 🔴 **Remove**
- ℹ **Information**

The stone is protected from accidental breaking.

### Moving a structure

1. Tap the control stone.
2. Select **🔵 Přesunout**.
3. The structure is cleared while the control stone remains.
4. Walk to the new location.
5. Tap the moving control stone to confirm the new location.
6. QuickCraft loads the same structure with the stored rotation/mirroring and moves the control stone to the new anchor.

> Current removal intentionally clears the registered structure bounding box. It does not yet snapshot and restore the terrain that was underneath the structure.

---

## 📐 Automatic `.mcstructure` Mapping

The repository contains `tools/scan_structures.py`.

It reads the real Bedrock `.mcstructure` NBT files and extracts the `size` list containing the exact X/Y/Z bounds. `.mcstructure` files are uncompressed little-endian NBT and the `size` field is the authoritative three-integer structure size. citeturn10search0turn10search3

Run:

```bash
# Scan every structure and generate the exact dimension map.
make scan
```

The generated file is:

```text
pack/behavior_pack/QuickCraft/scripts/structure_dimensions.js
```

`make`, `make bp` and `make addon` run the scanner automatically before packaging.

---

## 🧩 Custom Structures

The custom structure flow no longer needs to depend on manually guessed dimensions in the build system. Put the `.mcstructure` into `behavior_pack/QuickCraft/structures/` and run the scanner/build.

The Bedrock structure path determines the structure identifier; for example `structures/house.mcstructure` maps to the default `mystructure:house` namespace. citeturn10search0

The in-game custom registration remains available for structures stored directly in a world.

---

## 📦 Installation

1. Build `QuickCraft.mcaddon`, or use the generated packs from `dist/`.
2. Import the behavior and resource packs into Minecraft Bedrock.
3. Enable both packs in the world.
4. Enable cheats / commands — QuickCraft uses `/structure load`, which requires commands. citeturn2search0
5. Build a structure normally. The control stone is created automatically after the successful QuickCraft build.

The current pack targets Minecraft Bedrock **1.21.80+** with `@minecraft/server` **2.0.0** and `@minecraft/server-ui` **2.0.0**.

### Crafting recipes and in-game guide

The behavior pack includes three recipes:

| Item | Recipe ingredients | Behavior |
|---|---|---|
| `qc:menu` | Compass, amethyst shards and gold nuggets | Opens the QuickCraft structure menu. |
| `qc:wand` | Echo shard and sticks | Opens the same menu as an alternative building tool. |
| `qc:guide` | Book, paper, ink sac and amethyst shard | Opens an eight-page in-game guide covering setup, items, building, custom structures, control stones and advanced custom recipes. |

All three item definitions, every QuickCraft form button, every structure category and the `qc:control` block use the shared `qc_menu` artwork through both `textures/item_texture.json` and `textures/terrain_texture.json`. This keeps the behavior-pack icons, menu UI and resource-pack atlas entries consistent.

The last two guide pages explain advanced custom recipes: `minecraft:recipe_shaped` with `pattern` and `key`, `minecraft:recipe_shapeless` with `ingredients`, unique recipe identifiers, custom item outputs and the validation/build workflow.

### Custom form UI

The resource pack includes `ui/server_form.json` and a custom `form_panel.png` theme. QuickCraft forms receive a dark blue, cyan and gold crafting-panel background through the `QuickCraft` title marker; forms from other add-ons are left untouched by the visibility binding.

> Bedrock JSON UI is unversioned and is being replaced by Ore UI. The custom theme is therefore intentionally small and isolated, but it may require adjustment after future Minecraft UI updates.

---

## 🗂️ Project Structure

```text
QuickCraft/
├── Makefile
├── tools/
│   └── scan_structures.py
└── pack/
    ├── behavior_pack/
    │   └── QuickCraft/
    │       ├── functions/
    │       ├── items/
    │       ├── scripts/
    │       │   ├── main.js
    │       │   ├── catalog.js
    │       │   ├── bootstrap.js
    │       │   ├── structure_manager.js
    │       │   └── structure_dimensions.js  # generated by make scan
    │       ├── structures/
    │       └── manifest.json
    └── resource_pack/
        └── QuickCraft/
```

### Key files

| File | Purpose |
|---|---|
| `scripts/main.js` | Existing QuickCraft menu and build engine. |
| `scripts/structure_manager.js` | Persistent structure instances and control stones. |
| `scripts/bootstrap.js` | Loads the original menu and instance manager together. |
| `scripts/catalog.js` | Existing catalog/categories. |
| `scripts/structure_dimensions.js` | Generated exact `.mcstructure` dimensions. |
| `tools/scan_structures.py` | Little-endian NBT `.mcstructure` scanner. |
| `structures/*.mcstructure` | Structure templates. |

---

## ⚠️ Current Limitations

- Control-stone detection is persistent through world dynamic properties, but the manager does not scan every existing world block for old control stones.
- Removing a structure currently clears its registered bounding box instead of restoring the exact terrain that existed before the build.
- Each successful build emits a unique internal ticket, so consecutive builds of the same structure are registered independently.
- `.mcworld` / `.mctemplate` export remains a native Minecraft operation.
- Commands / cheats are required for structure operations. citeturn2search0

---

## 📄 License

The repository does not include a license file. If you plan to distribute the add-on further, contact the author (**PhateValleyman**) for clarification of the terms.

---

## 🙏 Credits

- **PhateValleyman** — author of the add-on.
- The Minecraft Bedrock community for the scripting API possibilities.

## 🪨 Structure Instances & Control Stones

QuickCraft now tracks each structure placed through the menu as a persistent **structure instance**.

- Every placed structure receives a **control stone** at its exact structure origin corner.
- Tapping the control stone opens administration for that specific structure.
- Instances can be added to favorites, renamed, or removed.
- **Move mode** removes the structure but leaves its control stone behind.
- While moving, the control stone follows the player's view using a block raycast.
- Aim at a new position and **tap the control stone** to place the structure there.
- Occupied target blocks and other QuickCraft control stones are not overwritten by the move preview.
- Instance names are independent of the source `.mcstructure` name, so they can later be used as stable teleport destinations.
- Instance metadata is persisted in world dynamic properties and includes an instance ID, source structure, origin, dimensions, rotation, mirror, owner, and teleport readiness.

The structure catalog dimensions are generated from the actual `.mcstructure` files by `tools/scan_structures.py`; manual dimension entry is therefore not required for built-in structures.


## 🌎 WAYpoint-style teleport module

QuickCraft now uses a dedicated teleport presentation derived from the cinematic travel approach of
[PhateValleyman/WAYpoint](https://github.com/PhateValleyman/WAYpoint).

- Every registered structure can be a teleport destination.
- The control menu exposes **🌎 Teleportovat**.
- Movement and camera input are temporarily locked during travel.
- The camera rises above the source, transitions to the destination, and returns to the player.
- Cross-dimension travel is handled through the same module.
- The existing QuickCraft **move-preview** behavior is kept unchanged: the control marker still follows the player's view and a tap confirms placement.

The QuickCraft control marker is now the custom block `qc:control` and uses the existing transparent
`textures/items/qc_menu.png` artwork.

> Note: Minecraft Bedrock flipbook animation requires a vertical sprite strip; the existing 1000×1000 `qc_menu.png`
> is intentionally preserved unchanged. The control block is therefore already transparent and visually identical to the source artwork,
> while the animated sprite atlas can be added without changing the original menu icon.
