// QuickCraft teleport module.
// Adapted from the cinematic travel concept used by PhateValleyman/WAYpoint.
// The QuickCraft control stone remains the source of truth; this module only handles travel presentation.
import { InputPermissionCategory, system, world } from '@minecraft/server';

const PRESET = 'minecraft:free';
const BUSY = new Set();

const sleep = (ticks) => new Promise((resolve) => system.runTimeout(resolve, ticks));

function valid(player) {
    try {
        return player.isValid !== false;
    } catch {
        return false;
    }
}

function lock(player, locked) {
    try {
        player.inputPermissions.setPermissionCategory(
            InputPermissionCategory.Movement,
            !locked,
        );
        player.inputPermissions.setPermissionCategory(
            InputPermissionCategory.Camera,
            !locked,
        );
    } catch {
        // Fall back silently on older runtimes.
    }
}

function camera(player, location, rotation, easeTicks = 0) {
    try {
        const options = { location, rotation };
        if (easeTicks > 0) {
            options.easeOptions = {
                easeTime: easeTicks / 20,
                easeType: 'Linear',
            };
        }
        player.camera.setCamera(PRESET, options);
    } catch {
        // Camera presentation is optional; teleport still completes.
    }
}

function clearCamera(player) {
    try {
        player.camera.clear();
    } catch {}
}

function fade(player, fadeInSeconds, holdSeconds, fadeOutSeconds) {
    try {
        player.camera.fade({
            fadeColor: { red: 0, green: 0, blue: 0 },
            fadeTime: {
                fadeInTime: fadeInSeconds,
                holdTime: holdSeconds,
                fadeOutTime: fadeOutSeconds,
            },
        });
    } catch {}
}

function sound(player, id, volume = 0.5, pitch = 1) {
    try {
        player.playSound(id, { volume, pitch });
    } catch {}
}

function above(location, height) {
    return {
        x: location.x + 0.5,
        y: location.y + height,
        z: location.z + 0.5,
    };
}

function lookDown() {
    return { x: 90, y: 0 };
}

export function warping(player) {
    return BUSY.has(player.id);
}

export async function teleportToInstance(player, instance) {
    if (!player || !instance || BUSY.has(player.id)) return false;

    const dimension = player.dimension;
    const sameDimension = dimension.id === instance.dimension;
    BUSY.add(player.id);
    lock(player, true);

    const start = { ...player.location };
    const destination = {
        x: instance.origin.x + 0.5,
        y: instance.origin.y + 1,
        z: instance.origin.z + 0.5,
    };

    try {
        sound(player, 'mob.endermen.portal', 0.45, 0.8);
        camera(player, above(start, 10), lookDown(), 6);
        await sleep(10);

        if (!sameDimension) {
            fade(player, 0.35, 0.35, 0.35);
            await sleep(7);
            player.teleport(destination, { dimension: world.getDimension(instance.dimension) });
            await sleep(12);
        } else {
            camera(player, above(instance.origin, 12), lookDown(), 12);
            await sleep(12);
            player.teleport(destination, { dimension: world.getDimension(instance.dimension) });
            sound(player, 'mob.endermen.portal', 0.55, 1.0);
            await sleep(8);
        }

        camera(player, destination, { x: 12, y: player.getRotation().y }, 8);
        await sleep(8);
        sound(player, 'random.orb', 0.35, 1.2);
        return true;
    } catch (error) {
        try {
            console.warn('QuickCraft teleport error: ' + error);
        } catch {}
        return false;
    } finally {
        if (valid(player)) {
            await sleep(4);
            clearCamera(player);
            lock(player, false);
        }
        BUSY.delete(player.id);
    }
}
