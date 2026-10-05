// QuickCraft Structure Instance Manager.
// Adds a persistent control stone to every structure built through the existing menu.
// The manager intentionally lives beside main.js so the original build UI remains compatible.
import { world, system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { CATEGORIES } from './catalog.js';

const CONTROL_BLOCK = 'minecraft:lodestone';
const INSTANCES_KEY = 'qc:instances';
const FAVS_KEY = 'qc:instance_fav';
const MOVE_KEY = 'qc:move';
const MENU_ITEM = 'qc:menu';
const ROT_CMD = ['0_degrees', '90_degrees', '180_degrees', '270_degrees'];
const MIRROR_CMD = ['none', 'x', 'z', 'xz'];
const DEFAULTS = { pos: 0, rot: 0, mirror: 0, dx: 0, dy: 0, dz: 0 };
const ALL = CATEGORIES.flatMap((c) => c.items.map((item) => ({ item, cat: c })));
const BY_ID = new Map(ALL.map((entry) => [entry.item.id, entry.item]));

function readWorld(key, fallback) {
  try {
    const raw = world.getDynamicProperty(key);
    return typeof raw === 'string' ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function writeWorld(key, value) {
  try { world.setDynamicProperty(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function readPlayer(player, key, fallback) {
  try {
    const raw = player.getDynamicProperty(key);
    return typeof raw === 'string' ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function writePlayer(player, key, value) {
  try { player.setDynamicProperty(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function getInstances() {
  return readWorld(INSTANCES_KEY, []).filter((i) => i && i.id && i.dimension && i.origin && i.size);
}

function saveInstances(instances) {
  writeWorld(INSTANCES_KEY, instances.slice(-500));
}

function getSettings(player) {
  return { ...DEFAULTS, ...readPlayer(player, 'qc:settings', {}) };
}

function getCustom(player, id) {
  return readPlayer(player, 'qc:customs', []).find((i) => i?.id === id) ?? null;
}

function getStructure(player, id) {
  return BY_ID.get(id) ?? getCustom(player, id);
}

function effectiveSize(size, rot) {
  const swap = rot === 1 || rot === 3;
  return { x: swap ? size[2] : size[0], y: size[1], z: swap ? size[0] : size[2] };
}

function facing(player) {
  const v = player.getViewDirection();
  if (Math.abs(v.x) > Math.abs(v.z)) return v.x > 0 ? 'E' : 'W';
  return v.z > 0 ? 'S' : 'N';
}

function calculateOrigin(player, size) {
  const cfg = getSettings(player);
  const s = effectiveSize(size, cfg.rot);
  const px = Math.floor(player.location.x);
  const py = Math.floor(player.location.y);
  const pz = Math.floor(player.location.z);
  let x;
  let z;
  if (cfg.pos === 0) {
    switch (facing(player)) {
      case 'E': x = px + 2; z = pz - Math.floor(s.z / 2); break;
      case 'W': x = px - s.x - 1; z = pz - Math.floor(s.z / 2); break;
      case 'S': z = pz + 2; x = px - Math.floor(s.x / 2); break;
      default: z = pz - s.z - 1; x = px - Math.floor(s.x / 2); break;
    }
  } else if (cfg.pos === 1) {
    x = px;
    z = pz;
  } else {
    x = px - Math.floor(s.x / 2);
    z = pz - Math.floor(s.z / 2);
  }
  return { x: x + cfg.dx, y: py + (Number.isInteger(player.location.y) ? 0 : 0) + cfg.dy, z: z + cfg.dz };
}

function marker(instance) {
  return {
    x: instance.origin.x,
    y: instance.origin.y + instance.size.y,
    z: instance.origin.z,
  };
}

function samePos(a, b) {
  return a?.x === b?.x && a?.y === b?.y && a?.z === b?.z;
}

function findAt(dimensionId, location) {
  return getInstances().find((i) => i.dimension === dimensionId && samePos(marker(i), location)) ?? null;
}

function setControlStone(dimension, instance) {
  const p = marker(instance);
  dimension.runCommand(`setblock ${p.x} ${p.y} ${p.z} ${CONTROL_BLOCK} replace`);
}

function clearStructure(dimension, instance) {
  const x1 = instance.origin.x;
  const y1 = instance.origin.y;
  const z1 = instance.origin.z;
  const x2 = x1 + instance.size.x - 1;
  const y2 = y1 + instance.size.y - 1;
  const z2 = z1 + instance.size.z - 1;
  dimension.runCommand(`fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} air`);
}

function loadStructure(dimension, instance) {
  const p = instance.origin;
  const at = `${p.x} ${p.y} ${p.z}`;
  const animation = instance.anim ? ` ${instance.anim} ${instance.animSeconds}` : '';
  const command = `structure load ${instance.structure} ${at} ${instance.rotation} ${instance.mirror}${animation}`;
  dimension.runCommand(command);
}

function newId() {
  const n = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0').toUpperCase();
  return `QC-${n}`;
}

function notify(player, message) {
  player.sendMessage(message);
  try { player.onScreenDisplay.setActionBar(message); } catch { /* ignore */ }
}

function removeInstance(instance) {
  saveInstances(getInstances().filter((i) => i.id !== instance.id));
}

function registerInstance(player, structureId) {
  const item = getStructure(player, structureId);
  if (!item || !Array.isArray(item.size) || item.size.length !== 3) return;
  const cfg = getSettings(player);
  const size = effectiveSize(item.size, cfg.rot);
  const origin = calculateOrigin(player, item.size);
  const dimension = player.dimension;
  const instances = getInstances();
  const existing = instances.find((i) => i.dimension === dimension.id && samePos(i.origin, origin));
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
  };
  instances.push(instance);
  saveInstances(instances);
  try {
    setControlStone(dimension, instance);
    notify(player, `§a🪨 Kontrolní kámen přidán: §f${instance.name}`);
  } catch (e) {
    removeInstance(instance);
    console.warn('QuickCraft control stone error: ' + e);
  }
}

function openInstanceMenu(player, instance) {
  const favs = readPlayer(player, FAVS_KEY, []);
  const favorite = favs.includes(instance.id);
  const moving = readPlayer(player, MOVE_KEY, null);
  const f = new ActionFormData()
    .title(`§l§b${instance.name}`)
    .body(`§7🪨 Kontrolní kámen\n§7ID: §f${instance.id}\n§7Rozměry: §f${instance.size.x}×${instance.size.y}×${instance.size.z}\n§7Pozice: §f${instance.origin.x} ${instance.origin.y} ${instance.origin.z}`)
    .button('§l§2⭐ ' + (favorite ? 'Odebrat z oblíbených' : 'Přidat k oblíbeným'))
    .button('§l§b🔵 Přesunout')
    .button('§l§c🔴 Odstranit')
    .button('§l§eℹ Informace')
    .button('§l§8Zavřít');
  if (moving?.instanceId === instance.id) f.button('§l§6📍 Umístit zde');
  f.show(player).then((result) => {
    if (result.canceled) return;
    if (result.selection === 0) {
      const next = favorite ? favs.filter((id) => id !== instance.id) : [...favs, instance.id];
      writePlayer(player, FAVS_KEY, next);
      notify(player, favorite ? '§eOdebráno z oblíbených.' : '§aPřidáno k oblíbeným.');
      return;
    }
    if (result.selection === 1) {
      try {
        clearStructure(player.dimension, instance);
        writePlayer(player, MOVE_KEY, { instanceId: instance.id, dimension: instance.dimension });
        notify(player, '§b🔵 Stavba je připravena k přesunu. §7Zůstal pouze kontrolní kámen.\n§fJdi na nové místo a napiš §e!qcplace§f.');
      } catch (e) {
        notify(player, '§cPřesun se nepodařil.');
      }
      return;
    }
    if (result.selection === 2) {
      try {
        clearStructure(player.dimension, instance);
        player.dimension.runCommand(`setblock ${marker(instance).x} ${marker(instance).y} ${marker(instance).z} air`);
        removeInstance(instance);
        notify(player, `§cOdstraněno: §f${instance.name}`);
      } catch (e) {
        notify(player, '§cOdstranění se nepodařilo.');
      }
      return;
    }
    if (result.selection === 3) {
      notify(player, `§e${instance.name} §7· ${instance.size.x}×${instance.size.y}×${instance.size.z} · ${instance.origin.x} ${instance.origin.y} ${instance.origin.z}`);
      return;
    }
    if (result.selection === 5 && moving?.instanceId === instance.id) placeMoved(player, instance);
  }).catch((e) => console.warn('QuickCraft instance menu error: ' + e));
}

function placeMoved(player, instance) {
  if (player.dimension.id !== instance.dimension) {
    notify(player, '§cNové místo musí být ve stejné dimenzi.');
    return;
  }
  const p = {
    x: Math.floor(player.location.x),
    y: Math.floor(player.location.y),
    z: Math.floor(player.location.z),
  };
  try {
    player.dimension.runCommand(`setblock ${marker(instance).x} ${marker(instance).y} ${marker(instance).z} air`);
    instance.origin = p;
    loadStructure(player.dimension, instance);
    setControlStone(player.dimension, instance);
    saveInstances(getInstances().map((i) => i.id === instance.id ? instance : i));
    writePlayer(player, MOVE_KEY, null);
    notify(player, `§a🔵 ${instance.name} přesunuto.`);
  } catch (e) {
    notify(player, '§cNové místo se nepodařilo použít.');
  }
}

function initializeSnapshots() {
  for (const player of world.getPlayers()) {
    const recent = readPlayer(player, 'qc:recent', []);
    writePlayer(player, 'qc:instance_seen_recent', JSON.stringify(recent));
  }
}

function pollBuilds() {
  for (const player of world.getPlayers()) {
    try {
      const recent = readPlayer(player, 'qc:recent', []);
      const previousRaw = player.getDynamicProperty('qc:instance_seen_recent');
      const previous = typeof previousRaw === 'string' ? JSON.parse(previousRaw) : [];
      const recentChanged = JSON.stringify(recent) !== JSON.stringify(previous);
      const current = recent[0];
      if (current && recentChanged) {
        registerInstance(player, current);
      }
      writePlayer(player, 'qc:instance_seen_recent', JSON.stringify(recent));
    } catch (e) {
      console.warn('QuickCraft instance scan error: ' + e);
    }
  }
}

// Register the first known recent-build snapshot after the script starts.
system.runTimeout(initializeSnapshots, 20);

// Poll the existing QuickCraft recent-build property so main.js needs no invasive rewrite.
system.runInterval(pollBuilds, 5);

// Open administration when the player taps a registered control stone.
if (world.beforeEvents?.playerInteractWithBlock) {
  world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const instance = findAt(event.block.dimension.id, event.block.location);
    if (!instance) return;
    event.cancel = true;
    system.run(() => openInstanceMenu(event.player, instance));
  });
}

// Prevent accidental mining of a control stone; administration is done through its menu.
if (world.beforeEvents?.playerBreakBlock) {
  world.beforeEvents.playerBreakBlock.subscribe((event) => {
    const instance = findAt(event.block.dimension.id, event.block.location);
    if (instance) {
      event.cancel = true;
      notify(event.player, '§e🪨 Toto je kontrolní kámen QuickCraft. Klepni na něj pro správu stavby.');
    }
  });
}

// Place a moved structure at the player's current block position.
if (world.beforeEvents?.chatSend) {
  world.beforeEvents.chatSend.subscribe((event) => {
    const command = event.message.trim().toLowerCase();
    if (command !== '!qcplace' && command !== '!qccancel') return;
    event.cancel = true;
    const player = event.sender;
    system.run(() => {
      const move = readPlayer(player, MOVE_KEY, null);
      if (!move?.instanceId) {
        notify(player, '§7Žádná stavba není právě připravena k přesunu.');
        return;
      }
      const instance = getInstances().find((i) => i.id === move.instanceId);
      if (!instance) {
        writePlayer(player, MOVE_KEY, null);
        notify(player, '§cPůvodní stavba už není registrovaná.');
        return;
      }
      if (command === '!qccancel') {
        setControlStone(player.dimension, instance);
        writePlayer(player, MOVE_KEY, null);
        notify(player, '§ePřesun zrušen. Stavba zůstává připravená k přesunu.');
        return;
      }
      placeMoved(player, instance);
    });
  });
}

// Record menu-open time so same-structure consecutive builds can be registered when possible.
const menuOpened = new Map();
world.afterEvents.itemUse.subscribe((event) => {
  if (event.itemStack?.typeId !== MENU_ITEM) return;
  menuOpened.set(event.source.id, system.currentTick);
});

// A short fallback catches consecutive builds of the same structure when the recent list itself does not change.
system.runInterval(() => {
  for (const player of world.getPlayers()) {
    const opened = menuOpened.get(player.id);
    if (opened === undefined || system.currentTick - opened < 25 || system.currentTick - opened > 120) continue;
    const recent = readPlayer(player, 'qc:recent', []);
    const current = recent[0];
    if (!current) continue;
    const item = getStructure(player, current);
    if (!item) continue;
    const origin = calculateOrigin(player, item.size);
    const instances = getInstances();
    const existing = instances.find((i) => i.dimension === player.dimension.id && samePos(i.origin, origin));
    if (!existing) registerInstance(player, current);
    menuOpened.delete(player.id);
  }
}, 10);
