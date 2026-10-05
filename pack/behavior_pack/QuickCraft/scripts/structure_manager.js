// QuickCraft Structure Instance Manager.
// Every placed QuickCraft structure gets a persistent `qc:control` marker at its exact origin corner.
// Moving uses a live raycast preview: the stone follows the player's view and a tap on it places the structure.
// Instance names are stored independently from the structure template and can be used as teleport destinations.
import { world, system } from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';
import { CATEGORIES } from './catalog.js';
import { teleportToInstance, warping } from './teleport.js';

const CONTROL_BLOCK = 'qc:control';
const INSTANCES_KEY = 'qc:instances';
const FAVS_KEY = 'qc:instance_fav';
const MOVE_KEY = 'qc:move';
const MENU_ITEM = 'qc:menu';
const ROT_CMD = ['0_degrees', '90_degrees', '180_degrees', '270_degrees'];
const MIRROR_CMD = ['none', 'x', 'z', 'xz'];
const DEFAULTS = { pos: 0, rot: 0, mirror: 0, dx: 0, dy: 0, dz: 0 };
const sleep = (ticks) => new Promise((resolve) => system.runTimeout(resolve, ticks));

// A form cannot be shown while chat/another screen is open (UserBusy) - retry for ~20 s.
async function showForm(player, form) {
    for (let i = 0; i < 40; i++) {
        const res = await form.show(player);
        if (res.cancelationReason === 'UserBusy') {
            await sleep(10);
            continue;
        }
        return res;
    }
    return { canceled: true };
}

const ALL = CATEGORIES.flatMap((c) => c.items.map((item) => ({ item, cat: c })));
const BY_ID = new Map(ALL.map((entry) => [entry.item.id, entry.item]));

function readWorld(key, fallback) {
    try {
        const raw = world.getDynamicProperty(key);
        return typeof raw === 'string' ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function writeWorld(key, value) {
    try {
        world.setDynamicProperty(key, JSON.stringify(value));
    } catch {
        // Ignore persistence errors and keep the running instance state usable.
    }
}

function readPlayer(player, key, fallback) {
    try {
        const raw = player.getDynamicProperty('qc:' + key);
        return typeof raw === 'string' ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function writePlayer(player, key, value) {
    try {
        player.setDynamicProperty('qc:' + key, JSON.stringify(value));
    } catch {
        // Ignore persistence errors and keep the running instance state usable.
    }
}

function getInstances() {
    return readWorld(INSTANCES_KEY, []).filter(
        (i) => i && i.id && i.dimension && i.origin && i.size,
    );
}

function saveInstances(instances) {
    writeWorld(INSTANCES_KEY, instances.slice(-500));
}

function getSettings(player) {
    return { ...DEFAULTS, ...readPlayer(player, 'settings', {}) };
}

function getCustom(player, id) {
    return readPlayer(player, 'customs', []).find((i) => i?.id === id) ?? null;
}

function getStructure(player, id) {
    return BY_ID.get(id) ?? getCustom(player, id);
}

function effectiveSize(size, rot) {
    const swap = rot === 1 || rot === 3;
    return {
        x: swap ? size[2] : size[0],
        y: size[1],
        z: swap ? size[0] : size[2],
    };
}

function facing(player) {
    const v = player.getViewDirection();
    if (Math.abs(v.x) > Math.abs(v.z)) return v.x > 0 ? 'E' : 'W';
    return v.z > 0 ? 'S' : 'N';
}

function calculateOrigin(player, size, yOffset = 0) {
    const cfg = getSettings(player);
    const s = effectiveSize(size, cfg.rot);
    const px = Math.floor(player.location.x);
    const py = Math.floor(player.location.y);
    const pz = Math.floor(player.location.z);
    let x;
    let z;

    if (cfg.pos === 0) {
        switch (facing(player)) {
            case 'E':
                x = px + 2;
                z = pz - Math.floor(s.z / 2);
                break;
            case 'W':
                x = px - s.x - 1;
                z = pz - Math.floor(s.z / 2);
                break;
            case 'S':
                z = pz + 2;
                x = px - Math.floor(s.x / 2);
                break;
            default:
                z = pz - s.z - 1;
                x = px - Math.floor(s.x / 2);
                break;
        }
    } else if (cfg.pos === 1) {
        x = px;
        z = pz;
    } else {
        x = px - Math.floor(s.x / 2);
        z = pz - Math.floor(s.z / 2);
    }

    return {
        x: x + cfg.dx,
        y: py + yOffset + cfg.dy,
        z: z + cfg.dz,
    };
}

function samePos(a, b) {
    return a?.x === b?.x && a?.y === b?.y && a?.z === b?.z;
}

function findAt(dimensionId, location) {
    return getInstances().find(
        (i) => i.dimension === dimensionId && samePos(i.origin, location),
    ) ?? null;
}

function setControlStone(dimension, instance) {
    const p = instance.origin;
    dimension.runCommand(
        'setblock ' + p.x + ' ' + p.y + ' ' + p.z + ' ' + CONTROL_BLOCK + ' replace',
    );
}

function clearMarker(dimension, location) {
    if (!location) return;
    dimension.runCommand(
        'setblock ' + location.x + ' ' + location.y + ' ' + location.z + ' air',
    );
}

function clearStructure(dimension, instance) {
    const x1 = instance.origin.x;
    const y1 = instance.origin.y;
    const z1 = instance.origin.z;
    const x2 = x1 + instance.size.x - 1;
    const y2 = y1 + instance.size.y - 1;
    const z2 = z1 + instance.size.z - 1;

    dimension.runCommand(
        'fill ' + x1 + ' ' + y1 + ' ' + z1 + ' ' +
        x2 + ' ' + y2 + ' ' + z2 + ' air',
    );
}

function loadStructure(dimension, instance) {
    const p = instance.origin;
    const at = p.x + ' ' + p.y + ' ' + p.z;
    const animation = instance.anim
        ? ' ' + instance.anim + ' ' + instance.animSeconds
        : '';

    dimension.runCommand(
        'structure load ' + instance.structure + ' ' + at + ' ' +
        instance.rotation + ' ' + instance.mirror + animation,
    );
}

function newId() {
    const n = Math.floor(Math.random() * 0xffffff)
        .toString(16)
        .padStart(6, '0')
        .toUpperCase();
    return 'QC-' + n;
}

function notify(player, message) {
    player.sendMessage(message);
    try {
        player.onScreenDisplay.setActionBar(message);
    } catch {
        // Ignore display errors when the player is not ready for UI updates.
    }
}

function removeInstance(instance) {
    saveInstances(getInstances().filter((i) => i.id !== instance.id));
}

function registerInstance(player, structureId) {
    const item = getStructure(player, structureId);
    if (!item || !Array.isArray(item.size) || item.size.length !== 3) return;

    const cfg = getSettings(player);
    const size = effectiveSize(item.size, cfg.rot);
    const origin = calculateOrigin(player, item.size, Number.isInteger(item.y) ? item.y : 0);
    const dimension = player.dimension;
    const instances = getInstances();

    const existing = instances.find(
        (i) => i.dimension === dimension.id && samePos(i.origin, origin),
    );
    if (existing) return;

    const instance = {
        id: newId(),
        structure: structureId,
        name: item.name ?? structureId,
        dimension: dimension.id,
        origin,
        size,
        sourceSize: item.size,
        rotation: ROT_CMD[cfg.rot] ?? ROT_CMD[0],
        mirror: MIRROR_CMD[cfg.mirror] ?? MIRROR_CMD[0],
        anim: null,
        animSeconds: 0,
        owner: player.name,
        created: system.currentTick,
        teleportEnabled: false,
    };

    instances.push(instance);
    saveInstances(instances);

    try {
        setControlStone(dimension, instance);
        notify(player, '§a🪨 Kontrolní kámen: §f' + instance.name);
    } catch (e) {
        removeInstance(instance);
        console.warn('QuickCraft control stone error: ' + e);
    }
}

async function renameInstance(player, instance) {
    const form = new ModalFormData()
        .title('§l§ePřejmenovat stavbu')
        .textField(
            'Název této konkrétní stavby',
            'např. Jonášův dům',
            instance.name,
        );

    const result = await showForm(player, form);
    if (result.canceled) return;

    const name = String(result.formValues[0] ?? '').trim().slice(0, 48);
    if (!name) {
        notify(player, '§cNázev nesmí být prázdný.');
        return;
    }

    saveInstances(
        getInstances().map((i) =>
            i.id === instance.id ? { ...i, name } : i,
        ),
    );

    notify(player, '§aNázev změněn na: §f' + name);
}

function beginMove(player, instance) {
    try {
        clearStructure(player.dimension, instance);
        setControlStone(player.dimension, instance);

        writePlayer(player, MOVE_KEY, {
            instanceId: instance.id,
            dimension: instance.dimension,
            target: { ...instance.origin },
        });

        notify(
            player,
            '§b🔵 PŘESUN: §fkámen sleduje tvůj pohled. ' +
            '§7Zamíř na nové místo a klepni na kámen.',
        );
    } catch (e) {
        notify(player, '§cPřesun se nepodařil.');
        console.warn('QuickCraft move start error: ' + e);
    }
}

function faceOffset(face) {
    const value = String(face ?? '').toLowerCase();

    switch (value) {
        case 'up':
            return { x: 0, y: 1, z: 0 };
        case 'down':
            return { x: 0, y: -1, z: 0 };
        case 'north':
            return { x: 0, y: 0, z: -1 };
        case 'south':
            return { x: 0, y: 0, z: 1 };
        case 'west':
            return { x: -1, y: 0, z: 0 };
        case 'east':
            return { x: 1, y: 0, z: 0 };
        default:
            return { x: 0, y: 1, z: 0 };
    }
}

function getMoveTarget(player) {
    try {
        const hit = player.getBlockFromViewDirection({
            maxDistance: 64,
            includeLiquidBlocks: false,
            includePassableBlocks: false,
        });

        if (!hit?.block) return null;

        const b = hit.block.location;
        const o = faceOffset(hit.face);

        return {
            x: b.x + o.x,
            y: b.y + o.y,
            z: b.z + o.z,
        };
    } catch {
        return null;
    }
}

function updateMovePreview(player) {
    const move = readPlayer(player, MOVE_KEY, null);
    if (!move?.instanceId || move.dimension !== player.dimension.id) return;

    const instance = getInstances().find((i) => i.id === move.instanceId);
    if (!instance) {
        writePlayer(player, MOVE_KEY, null);
        return;
    }

    const target = getMoveTarget(player);
    if (!target || samePos(target, move.target)) return;

    try {
        const targetBlock = player.dimension.getBlock(target);
        const targetType = targetBlock?.typeId ?? '';
        const isAir =
            targetType === 'minecraft:air' ||
            targetType === 'minecraft:cave_air' ||
            targetType === 'minecraft:void_air';

        if (!isAir) return;

        const occupied = getInstances().some(
            (i) =>
                i.id !== instance.id &&
                i.dimension === player.dimension.id &&
                samePos(i.origin, target),
        );
        if (occupied) return;

        clearMarker(player.dimension, move.target);
        move.target = target;
        writePlayer(player, MOVE_KEY, move);

        player.dimension.runCommand(
            'setblock ' + target.x + ' ' + target.y + ' ' + target.z +
            ' ' + CONTROL_BLOCK + ' replace',
        );
    } catch (e) {
        console.warn('QuickCraft move preview error: ' + e);
    }
}

function placeMoved(player, instance) {
    const move = readPlayer(player, MOVE_KEY, null);

    if (!move?.target || move.instanceId !== instance.id) {
        notify(player, '§cTato stavba není připravena k umístění.');
        return;
    }

    if (player.dimension.id !== instance.dimension) {
        notify(player, '§cNové místo musí být ve stejné dimenzi.');
        return;
    }

    const target = { ...move.target };

    try {
        clearMarker(player.dimension, target);
        instance.origin = target;

        loadStructure(player.dimension, instance);
        setControlStone(player.dimension, instance);

        saveInstances(
            getInstances().map((i) =>
                i.id === instance.id ? instance : i,
            ),
        );

        writePlayer(player, MOVE_KEY, null);
        notify(player, '§a🔵 ' + instance.name + ' přesunuto.');
    } catch (e) {
        notify(player, '§cNové místo se nepodařilo použít.');
        console.warn('QuickCraft move place error: ' + e);
    }
}

async function openTeleportMenu(player, current) {
    const targets = getInstances()
        .filter((i) => i.id !== current.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'cs'));

    if (!targets.length) {
        notify(player, '§7Zatím nemáš žádnou další uloženou stavbu.');
        return;
    }

    const form = new ActionFormData()
        .title('§l§b🌎 Teleport')
        .body('§7Vyber stavbu, ke které chceš cestovat.');

    for (const target of targets) {
        const dimension = target.dimension === player.dimension.id
            ? '§8stejná dimenze'
            : '§5jiná dimenze';
        form.button(
            '§l§f' + target.name + '\n§r' + dimension,
        );
    }

    form.button('§l§8Zavřít');

    const result = await showForm(player, form);
    if (result.canceled || result.selection === targets.length) return;

    const target = targets[result.selection];
    if (!target || warping(player)) return;

    const ok = await teleportToInstance(player, target);
    if (ok) {
        notify(player, '§a🌎 Přeneseno ke stavbě: §f' + target.name);
    } else {
        notify(player, '§cTeleport se nepodařil.');
    }
}

async function openInstanceMenu(player, instance) {
    const favs = readPlayer(player, FAVS_KEY, []);
    const favorite = favs.includes(instance.id);
    const moving = readPlayer(player, MOVE_KEY, null);

    const f = new ActionFormData()
        .title('§l§b' + instance.name)
        .body(
            '§7🌎 QuickCraft stavba\n' +
            '§7ID: §f' + instance.id + '\n' +
            '§7Rozměry: §f' + instance.size.x + '×' +
            instance.size.y + '×' + instance.size.z + '\n' +
            '§7Pozice: §f' + instance.origin.x + ' ' +
            instance.origin.y + ' ' + instance.origin.z + '\n' +
            '§7Šablona: §f' + instance.structure,
        )
        .button(
            '§l§2⭐ ' +
            (favorite ? 'Odebrat z oblíbených' : 'Přidat k oblíbeným'),
        )
        .button('§l§b🔵 Přesunout')
        .button('§l§e✏ Přejmenovat')
        .button('§l§d🌎 Teleportovat')
        .button('§l§c🔴 Odstranit')
        .button('§l§eℹ Informace')
        .button('§l§8Zavřít');

    if (moving?.instanceId === instance.id) {
        f.button('§l§6🎯 Umístit na zaměřené místo');
    }

    const result = await showForm(player, f);
    if (result.canceled) return;

    if (result.selection === 0) {
        const next = favorite
            ? favs.filter((id) => id !== instance.id)
            : [...favs, instance.id];

        writePlayer(player, FAVS_KEY, next);
        notify(
            player,
            favorite
                ? '§eOdebráno z oblíbených.'
                : '§aPřidáno k oblíbeným.',
        );
        return;
    }

    if (result.selection === 1) {
        beginMove(player, instance);
        return;
    }

    if (result.selection === 2) {
        await renameInstance(player, instance);
        return;
    }

    if (result.selection === 3) {
        await openTeleportMenu(player, instance);
        return;
    }

    if (result.selection === 4) {
        try {
            clearStructure(player.dimension, instance);
            removeInstance(instance);
            writePlayer(
                player,
                FAVS_KEY,
                favs.filter((id) => id !== instance.id),
            );
            notify(player, '§cOdstraněno: §f' + instance.name);
        } catch {
            notify(player, '§cOdstranění se nepodařilo.');
        }
        return;
    }

    if (result.selection === 5) {
        notify(
            player,
            '§e' + instance.name + ' §7· ' +
            instance.size.x + '×' + instance.size.y + '×' +
            instance.size.z + ' · ' +
            instance.origin.x + ' ' + instance.origin.y + ' ' +
            instance.origin.z,
        );
        return;
    }

    if (result.selection === 7 && moving?.instanceId === instance.id) {
        placeMoved(player, instance);
    }
}

function pollBuilds() {
    for (const player of world.getPlayers()) {
        try {
            const recent = readPlayer(player, 'recent', []);
            const previous = readPlayer(
                player,
                'instance_seen_recent',
                [],
            );

            const recentChanged =
                JSON.stringify(recent) !== JSON.stringify(previous);

            const current = recent[0];

            if (current && recentChanged) {
                registerInstance(player, current);
            }

            writePlayer(player, 'instance_seen_recent', recent);
        } catch (e) {
            console.warn('QuickCraft instance scan error: ' + e);
        }
    }
}

function initializeSnapshots() {
    for (const player of world.getPlayers()) {
        writePlayer(
            player,
            'instance_seen_recent',
            readPlayer(player, 'recent', []),
        );
    }
}

// Open administration when the player taps a registered control stone.
// During move mode, tapping the moving stone confirms the new position.
if (world.beforeEvents?.playerInteractWithBlock) {
    world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
        const instance = findAt(
            event.block.dimension.id,
            event.block.location,
        );

        if (!instance) return;

        event.cancel = true;

        system.run(() => {
            const move = readPlayer(event.player, MOVE_KEY, null);

            if (move?.instanceId === instance.id) {
                placeMoved(event.player, instance);
                return;
            }

            openInstanceMenu(event.player, instance).catch((e) =>
                console.warn(
                    'QuickCraft instance menu error: ' + e,
                ),
            );
        });
    });
}

// Prevent accidental mining of a control stone.
if (world.beforeEvents?.playerBreakBlock) {
    world.beforeEvents.playerBreakBlock.subscribe((event) => {
        const instance = findAt(
            event.block.dimension.id,
            event.block.location,
        );

        if (!instance) return;

        event.cancel = true;

        notify(
            event.player,
            '§e🪨 Kontrolní kámen QuickCraft. Klepni na něj pro správu stavby.',
        );
    });
}

// Keep the control stone exactly at the current view target while moving.
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        try {
            updateMovePreview(player);
        } catch (e) {
            console.warn('QuickCraft move tick error: ' + e);
        }
    }
}, 2);

// Register the first recent-build snapshot after the script starts.
system.runTimeout(initializeSnapshots, 20);

// Poll the existing QuickCraft recent-build property so main.js needs no invasive rewrite.
system.runInterval(pollBuilds, 5);

// The menu item remains owned by main.js; this listener is intentionally empty.
world.afterEvents.itemUse.subscribe((event) => {
    if (event.itemStack?.typeId !== MENU_ITEM) return;
});
