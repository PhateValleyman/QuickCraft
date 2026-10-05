# QuickCraft

A lightweight Minecraft Bedrock (PE) add-on that adds a clean menu for quickly building pre-made structures — houses, farms, decorations, and more. Instead of manually typing `/structure load` commands, open the menu, pick a build, and place it with one click.

---

## ✨ Features

- **Visual structure menu** — categories such as *Starter Homes*, *Farms*, *Decorations*, and more.
- **Open the menu in three ways:**
  - Right-click / tap with the **Quick Craft Menu** item (given automatically when you first join the world).
  - Chat command `!qc` or `!menu`.
  - Command `/scriptevent qc:menu`.
- **Search** — find structures by name (e.g. "castle", "farm", "dragon").
- **Favorites and recently built** — quick access to frequently used builds.
- **Build settings:**
  - Placement: In front of player, Corner at player, or Centered on player.
  - Rotation (0°, 90°, 180°, 270°) and mirroring (X, Z, X+Z).
  - Optional terrain clearing (foundation `_x` variant).
  - Build animation: by layers, by blocks, or none.
  - Fine offsets along X, Y, Z.
- **Custom structures** — register your own `.mcstructure` files from the behavior pack or world.
- **World / template export** — a guided flow for native `.mcworld` / `.mctemplate` export (the actual export is confirmed by Minecraft outside the add-on).

---

## 📦 Installation

1. Download the repository contents (or build an `.mcaddon` by combining the behavior and resource packs).
2. In Minecraft Bedrock Edition, go to **Settings → Storage → Resource Packs** and import the resource pack.
3. Then import the behavior pack in the same way.
4. When creating a new world (or in an existing world's settings), enable both packs:
   - **QuickCraft** (behavior pack) — must be active, otherwise the menu will not work.
   - **QuickCraft** (resource pack) — provides the menu item texture.
5. Make sure **cheats / commands** are enabled in the world — the add-on uses `/structure load`.

> **Note:** The add-on requires Minecraft Bedrock **1.20.80** or newer and the modules `@minecraft/server` (1.11.0) and `@minecraft/server-ui` (1.2.0).

---

## 🎮 Usage

### Opening the menu

| Method | How |
|---|---|
| Item | Right-click / tap with **Quick Craft Menu** |
| Chat | Type `!qc` or `!menu` |
| Command | `/scriptevent qc:menu` |

### Building a structure

1. Open the menu and choose a category (or use **Search**).
2. Click the structure you want.
3. In the structure detail view you can:
   - **Build** — immediately build the structure using the current settings.
   - **Edit build settings** — rotation, mirroring, animation, offsets, etc.
   - **Add to favorites** — the structure appears in the Favorites section.
4. After building, the structure is saved to **Recently Built**.

### Build settings

In **Settings → Build Settings** you can change:

- **Placement** — In front of me / Corner at me / Centered on me.
- **Rotation** — 0°, 90°, 180°, 270°.
- **Mirroring** — None / X / Z / X+Z.
- **Foundation** — first clear the terrain using the `_x` structure variant.
- **Animation** — None / By layers / By blocks + duration in seconds.
- **Offsets** — X, Y, Z (in blocks).

---

## 🗂️ Project Structure

```text
QuickCraft/
└── pack/
    ├── behavior_pack/
    │   └── QuickCraft/
    │       ├── functions/          # .mcfunction files (lists, helper functions)
    │       ├── items/              # qc_menu.json – menu item definition
    │       ├── scripts/            # main.js, catalog.js – menu and building logic
    │       ├── structures/         # .mcstructure files (+ _x variants)
    │       ├── manifest.json
    │       └── pack_icon.png
    └── resource_pack/
        └── QuickCraft/
            ├── textures/           # item_texture.json + icons
            ├── manifest.json
            ├── QuickCraft_RP.mcpack
            └── pack_icon.png
```

### Key Files

| File | Description |
|---|---|
| `scripts/main.js` | Main logic — opening the menu, forms, building, settings. |
| `scripts/catalog.js` | Automatically generated catalog of all structures (categories, dimensions, Y offset). |
| `items/qc_menu.json` | Defines the `qc:menu` item (Quick Craft Menu). |
| `functions/qc.mcfunction` | Helper function for opening the menu (if used). |
| `functions/list*.mcfunction` | Structure lists used to generate the catalog. |
| `structures/*.mcstructure` | The structures themselves. `*_x` variants serve as foundations for terrain clearing. |

---

## 🧩 Custom Structures

The add-on can also work with your own builds:

1. Place a `.mcstructure` file into `behavior_pack/QuickCraft/structures/` and re-import the add-on.
   - Or save the structure directly in the world with `/structure save <id> ...`.
2. In the menu, go to **Custom Structures → Add / Import**.
3. Enter:
   - **Structure ID** (file name without `.mcstructure`, e.g. `my_cabin`).
   - **Menu name** (e.g. *My Cabin*).
   - **Dimensions X Y Z** (e.g. `10 8 12`).
   - **Height offset** (-15 to +15).
4. The structure is registered and can be built like any built-in structure.

> The add-on cannot open a system file picker — the structure is only registered in the menu and verified when building.

---

## ⚠️ Limitations

- **Large structures** (over ~150,000 blocks) are marked with a ⚠ warning — the surrounding area must be loaded and you should stand in the middle of an open space.
- **Export** of `.mcworld` / `.mctemplate` is not performed by the add-on itself — it only shows instructions for exporting through Minecraft's native menu.
- The add-on requires commands (cheats) to be enabled in the world.

---

## 📄 License

The repository does not include a license file. If you plan to distribute the add-on further, contact the author (**PhateValleyman**) for clarification of the terms.

---

## 🙏 Credits

- **PhateValleyman** — author of the add-on.
- The Minecraft Bedrock community for the scripting API possibilities.
