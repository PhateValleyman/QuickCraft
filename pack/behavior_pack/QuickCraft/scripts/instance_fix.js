// QuickCraft instance metadata repair helper.
// Corrects the Y origin for newly registered instances when a structure has a non-zero Y offset.
import { world, system } from '@minecraft/server';

const INSTANCES_KEY = 'qc:instances';

function read(key, fallback) {
  try {
    const raw = world.getDynamicProperty(key);
    return typeof raw === 'string' ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function write(key, value) {
  try { world.setDynamicProperty(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function playerSettings(player) {
  try {
    const raw = player.getDynamicProperty('qc:settings');
    return typeof raw === 'string' ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function custom(player, id) {
  try {
    const raw = player.getDynamicProperty('qc:customs');
    const list = typeof raw === 'string' ? JSON.parse(raw) : [];
    return list.find((item) => item?.id === id) ?? null;
  } catch { return null; }
}

function fixRecentInstances() {
  const instances = read(INSTANCES_KEY, []);
  let changed = false;
  for (const instance of instances) {
    if (system.currentTick - Number(instance.created ?? 0) > 100) continue;
    const player = world.getPlayers().find((candidate) => candidate.name === instance.owner && candidate.dimension.id === instance.dimension);
    if (!player) continue;
    const settings = { dy: 0, ...playerSettings(player) };
    const item = custom(player, instance.structure);
    const yOffset = Number(item?.y ?? 0);
    const expected = Math.floor(player.location.y) + yOffset + Number(settings.dy ?? 0);
    if (instance.origin?.y !== expected) {
      instance.origin.y = expected;
      changed = true;
    }
  }
  if (changed) write(INSTANCES_KEY, instances);
}

// Run shortly after startup and while a newly built instance is still fresh.
system.runInterval(fixRecentInstances, 10);
