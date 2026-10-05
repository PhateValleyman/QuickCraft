// Quick Craft 2.0 – ingame menu pro výběr a stavění struktur
// Otevření: pravý klik / tap s itemem "Quick Craft Menu", nebo chat příkaz !qc, nebo /scriptevent qc:menu
import { world, system, ItemStack } from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';
import { CATEGORIES } from './catalog.js';

const MENU_ITEM = 'qc:menu';
const MENU_ITEM_NAME = '§l§bQuick Craft §r§7· menu staveb';
const PAGE_SIZE = 20;
const BIG_VOLUME = 150000;
const CUSTOM_CAT = { id: 'custom', name: 'Vlastní struktury', icon: 'textures/items/chest' };
const ALL = CATEGORIES.flatMap((c) => c.items.map((i) => ({ item: i, cat: c })));
const BY_ID = new Map(ALL.map((e) => [e.item.id, e]));

const ICON = {
  search: 'textures/items/compass_item',
  fav: 'textures/items/nether_star',
  recent: 'textures/items/clock_item',
  settings: 'textures/items/redstone_dust',
  back: 'textures/items/arrow',
  build: 'textures/items/iron_pickaxe',
  custom: 'textures/items/chest',
  add: 'textures/items/book_writable',
  info: 'textures/items/paper',
  export: 'textures/items/map_filled',
};

const DEFAULTS = { pos: 0, rot: 0, mirror: 0, terrain: true, anim: 0, secs: 5, dx: 0, dy: 0, dz: 0 };
const POS_MODES = ['Před mnou (podle pohledu)', 'Roh stavby na mé pozici', 'Vycentrovat na mě'];
const ROTS = ['0°', '90°', '180°', '270°'];
const ROT_CMD = ['0_degrees', '90_degrees', '180_degrees', '270_degrees'];
const MIRRORS = ['Bez zrcadlení', 'Zrcadlit X', 'Zrcadlit Z', 'Zrcadlit X+Z'];
const MIRROR_CMD = ['none', 'x', 'z', 'xz'];
const ANIMS = ['Bez animace', 'Po vrstvách', 'Po blocích'];
const ANIM_CMD = [null, 'layer_by_layer', 'block_by_block'];
// Keep a stable marker so the resource-pack JSON UI theme only targets QuickCraft forms.
const formTitle = (text) => `§l§bQuickCraft §8· §r${text}`;

// ---------- uložená data hráče ----------
function load(player, key, fallback) {
  try {
    const raw = player.getDynamicProperty('qc:' + key);
    return typeof raw === 'string' ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function save(player, key, value) {
  try { player.setDynamicProperty('qc:' + key, JSON.stringify(value)); } catch { /* ignore */ }
}
function getSettings(p) {
  const raw = load(p, 'settings', {});
  const integer = (value, fallback, min, max) => {
    const number = Number(value);
    return Number.isInteger(number) ? Math.max(min, Math.min(max, number)) : fallback;
  };
  return {
    pos: integer(raw.pos, DEFAULTS.pos, 0, 2),
    rot: integer(raw.rot, DEFAULTS.rot, 0, 3),
    mirror: integer(raw.mirror, DEFAULTS.mirror, 0, 3),
    terrain: raw.terrain !== false,
    anim: integer(raw.anim, DEFAULTS.anim, 0, 2),
    secs: integer(raw.secs, DEFAULTS.secs, 1, 30),
    dx: integer(raw.dx, DEFAULTS.dx, -30, 30),
    dy: integer(raw.dy, DEFAULTS.dy, -15, 15),
    dz: integer(raw.dz, DEFAULTS.dz, -30, 30),
  };
}
const getCustoms = (p) => load(p, 'customs', []).filter((i) => i && typeof i.id === 'string' && /^[a-z0-9_:-]+$/.test(i.id) && Array.isArray(i.size) && i.size.length === 3);
const customById = (p, id) => getCustoms(p).find((i) => i.id === id);
const entryById = (p, id) => BY_ID.get(id) ?? (customById(p, id) ? { item: customById(p, id), cat: CUSTOM_CAT } : null);
const getFavs = (p) => load(p, 'fav', []).filter((id) => !!entryById(p, id));
const getRecent = (p) => load(p, 'recent', []).filter((id) => !!entryById(p, id));

// ---------- pomocné ----------
const sleep = (ticks) => new Promise((res) => system.runTimeout(res, ticks));
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Formulář nejde zobrazit při otevřeném chatu (UserBusy) – zkoušíme znovu
async function show(player, form) {
  for (let i = 0; i < 40; i++) {
    const res = await form.show(player);
    if (res.cancelationReason === 'UserBusy') { await sleep(10); continue; }
    return res;
  }
  return { canceled: true };
}
function notify(player, msg) {
  try { player.onScreenDisplay.setActionBar(msg); } catch { /* ignore */ }
  player.sendMessage(msg);
}
function sound(player, id) { try { player.playSound(id); } catch { /* ignore */ } }
const dims = (s) => `${s[0]}×${s[1]}×${s[2]}`;
const volume = (s) => s[0] * s[1] * s[2];

// ---------- pohledy (každý vrací další stav, nebo null = konec) ----------
const views = {
  async main(player) {
    const favs = getFavs(player);
    const recent = getRecent(player);
    const f = new ActionFormData()
      .title(formTitle('menu staveb'))
      .body(`§7Vyber kategorii, nebo použij hledání.\n§8Staveb celkem: §7${ALL.length}`);
    f.button('§l§0Hledat\n§r§8podle názvu', ICON.search);
    f.button(`§l§0Oblíbené\n§r§8${favs.length} staveb`, ICON.fav);
    f.button(`§l§0Naposledy postavené\n§r§8${recent.length} staveb`, ICON.recent);
    for (const c of CATEGORIES) f.button(`§l${c.name}\n§r§8${c.items.length} staveb`, c.icon);
    f.button('§l§0Vlastní struktury\n§r§8import / správa', ICON.custom);
    f.button('§l§0Nastavení stavění\n§r§8otočení, zrcadlení, animace…', ICON.settings);

    const r = await show(player, f);
    if (r.canceled) return null;
    const s = r.selection;
    const nCat = CATEGORIES.length;
    if (s === 0) return { view: 'search' };
    if (s === 1) return { view: 'list', title: '§l§eOblíbené', entries: favs.map((id) => entryById(player, id)).filter(Boolean), page: 0, back: { view: 'main' }, empty: 'Zatím nemáš žádné oblíbené stavby. Otevři detail stavby a přidej ji hvězdičkou.' };
    if (s === 2) return { view: 'list', title: '§l§bNaposledy postavené', entries: recent.map((id) => entryById(player, id)).filter(Boolean), page: 0, back: { view: 'main' }, empty: 'Zatím jsi nic nepostavil.' };
    if (s < 3 + nCat) {
      const c = CATEGORIES[s - 3];
      return { view: 'list', title: `§l${c.name}`, entries: c.items.map((item) => ({ item, cat: c })), page: 0, back: { view: 'main' } };
    }
    if (s === 3 + nCat) return { view: 'customs', back: { view: 'main' } };
    return { view: 'settingsMenu', back: { view: 'main' } };
  },

  async customs(player, st) {
    const customs = getCustoms(player);
    const f = new ActionFormData()
      .title(formTitle('Vlastní struktury'))
      .body(customs.length
        ? '§7Vyber vlastní strukturu, nebo přidej další.\n§8Soubor .mcstructure musí být v BP/structures, případně musí být struktura uložena příkazem /structure save.'
        : '§7Zatím nemáš žádné vlastní struktury.\n§8Nejdřív vlož .mcstructure do behavior packu /structures nebo ji ulož ve světě příkazem /structure save.')
      .button('§l§2Přidat / importovat', ICON.add)
      .button('§l§eJak importovat?', ICON.info)
      .button('§l« Zpět', ICON.back);
    for (const item of customs) f.button(`§l${item.name}\n§8${item.id} · ${dims(item.size)}`, CUSTOM_CAT.icon);
    const r = await show(player, f);
    if (r.canceled || r.selection === 2) return st.back;
    if (r.selection === 0) return { view: 'customAdd', back: st };
    if (r.selection === 1) return { view: 'customHelp', back: st };
    const item = customs[r.selection - 3];
    return item ? { view: 'detail', entry: { item, cat: CUSTOM_CAT }, back: st } : st;
  },

  async customHelp(player, st) {
    const f = new ActionFormData()
      .title(formTitle('Import vlastní struktury'))
      .body('§71. Zkopíruj soubor §f.mcstructure§7 do složky §fstructures§7 behavior packu a addon znovu importuj.\n\n§72. Do pole ID zapiš název souboru bez přípony (např. §fmoje_chata§7).\n\n§73. Pokud je struktura uložena přímo ve světě, použij stejné ID jako u příkazu §f/structure save moje_chata ...§7.\n\n§cAddon nemůže v Minecraftu otevřít systémový výběr souboru; tato obrazovka proto strukturu zaregistruje do menu a ověří se při stavění.')
      .button('§l« Zpět', ICON.back);
    const r = await show(player, f);
    return r.canceled ? st.back : st.back;
  },

  async customAdd(player, st) {
    const f = new ModalFormData()
      .title(formTitle('Přidat vlastní strukturu'))
      .textField('ID struktury bez .mcstructure', 'např. moje_chata', '')
      .textField('Název v menu', 'např. Moje chata', '')
      .textField('Rozměry X Y Z', 'např. 10 8 12', '10 8 12')
      .slider('Výškový offset', -15, 15, 1, 0);
    const r = await show(player, f);
    if (r.canceled) return st.back;
    const id = String(r.formValues[0] ?? '').trim().toLowerCase();
    const name = String(r.formValues[1] ?? '').trim() || id;
    const parts = String(r.formValues[2] ?? '').trim().split(/[xX,;\s]+/).map(Number);
    const y = Number(r.formValues[3] ?? 0);
    if (!/^[a-z0-9_:-]+$/.test(id) || parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 1 || n > 512)) {
      notify(player, '§cNeplatné údaje. ID smí obsahovat a-z, 0-9, _, :, - a rozměry musí být 1–512.');
      return st;
    }
    const customs = getCustoms(player).filter((i) => i.id !== id);
    customs.push({ id, name: name.slice(0, 40), sub: 'Vlastní', y: Number.isInteger(y) ? y : 0, size: parts });
    save(player, 'customs', customs);
    notify(player, `§aVlastní struktura §f${id}§a byla přidána do menu.`);
    return st.back;
  },

  async search(player, st) {
    const f = new ModalFormData()
      .title(formTitle('Hledat stavbu'))
      .textField('Název nebo část názvu (např. "hrad", "farma", "dragon")', 'hledaný text', st.last ?? '');
    const r = await show(player, f);
    if (r.canceled) return { view: 'main' };
    const q = norm(String(r.formValues[0] ?? '').trim());
    if (!q) return { view: 'search' };
    const words = q.split(/\s+/);
    const entries = ALL.filter((e) => {
      const hay = norm(`${e.item.name} ${e.item.id} ${e.cat.name} ${e.item.sub}`);
      return words.every((w) => hay.includes(w));
    });
    return { view: 'list', title: `§l§bHledání: §f${q}`, entries, page: 0, back: { view: 'search', last: q }, empty: `Nic nenalezeno pro "${q}".` };
  },

  async list(player, st) {
    const entries = st.entries;
    const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    const page = Math.min(st.page, pages - 1);
    const slice = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const favs = new Set(getFavs(player));
    const f = new ActionFormData().title(formTitle(st.title));
    f.body(entries.length
      ? `§7Nalezeno: §f${entries.length}§7 staveb` + (pages > 1 ? `   §8(strana ${page + 1}/${pages})` : '')
      : `§7${st.empty ?? 'Nic tu není.'}`);
    f.button('§l« Zpět', ICON.back);
    for (const e of slice) {
      const star = favs.has(e.item.id) ? '§e★ ' : '';
      const sub = e.item.sub ? `${e.item.sub} · ` : '';
      const big = volume(e.item.size) > BIG_VOLUME ? ' §c⚠' : '';
      f.button(`${star}§l${e.item.name}§r\n§8${sub}${dims(e.item.size)}${big}`, e.cat.icon);
    }
    const hasPrev = page > 0, hasNext = page < pages - 1;
    if (hasPrev) f.button('§l‹ Předchozí strana');
    if (hasNext) f.button('§lDalší strana ›');

    const r = await show(player, f);
    if (r.canceled) return null;
    let s = r.selection;
    if (s === 0) return st.back;
    s -= 1;
    if (s < slice.length) return { view: 'detail', entry: slice[s], back: { ...st, page } };
    s -= slice.length;
    if (hasPrev && s === 0) return { ...st, page: page - 1 };
    return { ...st, page: page + 1 };
  },

  async detail(player, st) {
    const { item, cat } = st.entry;
    const cfg = getSettings(player);
    const isFav = getFavs(player).includes(item.id);
    const isCustom = cat.id === 'custom';
    const vol = volume(item.size);
    let body = `§7Kategorie: §f${cat.name}\n§7Rozměry: §f${dims(item.size)} §8(š×v×h)\n§7Bloků v kostce: §f${vol.toLocaleString('cs-CZ')}\n§7Výškový offset: §f${item.y > 0 ? '+' : ''}${item.y}\n`;
    if (vol > BIG_VOLUME) body += '\n§c⚠ Velká stavba – okolí musí být načtené (stůj uprostřed volné plochy).\n';
    body += `\n§8Nastavení: ${POS_MODES[cfg.pos]}, otočení ${ROTS[cfg.rot]}, ${MIRRORS[cfg.mirror].toLowerCase()}, podložka ${cfg.terrain ? 'ano' : 'ne'}, ${ANIMS[cfg.anim].toLowerCase()}`;
    const f = new ActionFormData()
      .title(formTitle(item.name))
      .body(body)
      .button('§l§2Postavit', ICON.build)
      .button('§lUpravit nastavení stavění', ICON.settings)
      .button(isFav ? '§lOdebrat z oblíbených' : '§l§ePřidat do oblíbených', ICON.fav)
      .button(isCustom ? '§l§cOdebrat vlastní strukturu' : '§l« Zpět', isCustom ? ICON.info : ICON.back);
    if (isCustom) f.button('§l« Zpět', ICON.back);
    const r = await show(player, f);
    if (r.canceled) return null;
    switch (r.selection) {
      case 0: build(player, st.entry); return null;
      case 1: return { view: 'settingsMenu', back: st };
      case 2: {
        const favs = getFavs(player);
        save(player, 'fav', isFav ? favs.filter((i) => i !== item.id) : [...favs, item.id]);
        return st;
      }
      case 3:
        if (isCustom) {
          save(player, 'customs', getCustoms(player).filter((i) => i.id !== item.id));
          save(player, 'fav', getFavs(player).filter((i) => i !== item.id));
          save(player, 'recent', getRecent(player).filter((i) => i !== item.id));
          notify(player, `§aVlastní struktura §f${item.name}§a byla odebrána.`);
          return st.back;
        }
        return st.back;
      default: return st.back;
    }
  },

  async settingsMenu(player, st) {
    const f = new ActionFormData()
      .title(formTitle('Nastavení'))
      .body('§7Nastavení stavění a export aktuálního světa.')
      .button('§lNastavení stavění', ICON.settings)
      .button('§l§eExportovat svět\n§r§8.mcworld', ICON.export)
      .button('§l§eExportovat šablonu\n§r§8.mctemplate', ICON.export)
      .button('§l« Zpět', ICON.back);
    const r = await show(player, f);
    if (r.canceled || r.selection === 3) return st.back;
    if (r.selection === 0) return { view: 'settings', back: st };
    return { view: 'exportGuide', kind: r.selection === 1 ? 'mcworld' : 'mctemplate', back: st };
  },

  async exportGuide(player, st) {
    const template = st.kind === 'mctemplate';
    const f = new ActionFormData()
      .title(formTitle(template ? 'Export .mctemplate' : 'Export .mcworld'))
      .body(template
        ? '§7Použij nativní Minecraft menu:\n\n§fSeznam světů → tužka u světa → Export World Template / Exportovat šablonu světa.\n\n§8Addon nemá API pro zápis souborů .mctemplate, takže export musí potvrdit Minecraft mimo addon.'
        : '§7Použij nativní Minecraft menu:\n\n§fSeznam světů → tužka u světa → Export World / Exportovat svět.\n\n§8Addon nemá API pro zápis souborů .mcworld, takže export musí potvrdit Minecraft mimo addon.')
      .button('§l« Zpět do nastavení', ICON.back);
    const r = await show(player, f);
    return r.canceled ? st.back : st.back;
  },

  async settings(player, st) {
    const c = getSettings(player);
    const f = new ModalFormData()
      .title(formTitle('Nastavení stavění'))
      .dropdown('Umístění', POS_MODES, c.pos)
      .dropdown('Otočení', ROTS, c.rot)
      .dropdown('Zrcadlení', MIRRORS, c.mirror)
      .toggle('Nejdřív vyrovnat/vyčistit terén (podložka _x)', c.terrain)
      .dropdown('Animace stavění', ANIMS, c.anim)
      .slider('Délka animace (s)', 1, 30, 1, c.secs)
      .slider('Posun X (bloky)', -30, 30, 1, c.dx)
      .slider('Posun Y (bloky, navíc k offsetu stavby)', -15, 15, 1, c.dy)
      .slider('Posun Z (bloky)', -30, 30, 1, c.dz);
    const r = await show(player, f);
    if (r.canceled) return st.back;
    const v = r.formValues;
    save(player, 'settings', { pos: v[0], rot: v[1], mirror: v[2], terrain: v[3], anim: v[4], secs: v[5], dx: v[6], dy: v[7], dz: v[8] });
    return st.back;
  },
};

async function run(player) {
  let state = { view: 'main' };
  while (state) state = await views[state.view](player, state);
}

// ---------- stavění ----------
function facing(player) {
  const v = player.getViewDirection();
  if (Math.abs(v.x) > Math.abs(v.z)) return v.x > 0 ? 'E' : 'W';
  return v.z > 0 ? 'S' : 'N';
}

function build(player, entry) {
  const { item } = entry;
  const cfg = getSettings(player);
  const [sx, , sz] = item.size;
  const swap = cfg.rot === 1 || cfg.rot === 3;
  const ex = swap ? sz : sx; // efektivní půdorys po otočení
  const ez = swap ? sx : sz;
  const px = Math.floor(player.location.x);
  const py = Math.floor(player.location.y);
  const pz = Math.floor(player.location.z);

  let x0, z0;
  if (cfg.pos === 0) {
    switch (facing(player)) {
      case 'E': x0 = px + 2; z0 = pz - Math.floor(ez / 2); break;
      case 'W': x0 = px - ex - 1; z0 = pz - Math.floor(ez / 2); break;
      case 'S': z0 = pz + 2; x0 = px - Math.floor(ex / 2); break;
      default: z0 = pz - ez - 1; x0 = px - Math.floor(ex / 2); break;
    }
  } else if (cfg.pos === 1) {
    x0 = px; z0 = pz;
  } else {
    x0 = px - Math.floor(ex / 2); z0 = pz - Math.floor(ez / 2);
  }
  x0 += cfg.dx; z0 += cfg.dz;
  const y0 = py + item.y + cfg.dy;

  const rot = ROT_CMD[cfg.rot];
  const mir = MIRROR_CMD[cfg.mirror];
  const at = `${x0} ${y0} ${z0} ${rot} ${mir}`;
  const anim = ANIM_CMD[cfg.anim] ? ` ${ANIM_CMD[cfg.anim]} ${cfg.secs}` : '';
  const dim = player.dimension;

  try {
    if (cfg.terrain) {
      try { dim.runCommand(`structure load ${item.id}_x ${at}`); } catch { /* podložka je volitelná */ }
    }
    const res = dim.runCommand(`structure load ${item.id} ${at}${anim}`);
    if (res && res.successCount === 0) throw new Error('příkaz nic neprovedl');
    save(player, 'last_build', {
      token: `${system.currentTick}-${Math.random().toString(36).slice(2)}`,
      instanceId: `QC-${system.currentTick.toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      structure: item.id,
      dimension: dim.id,
      origin: { x: x0, y: y0, z: z0 },
      rot: cfg.rot,
      mirror: cfg.mirror,
    });
    const recent = [item.id, ...getRecent(player).filter((i) => i !== item.id)].slice(0, 12);
    save(player, 'recent', recent);
    notify(player, `§aPostaveno: §f${item.name} §8(${x0} ${y0} ${z0})`);
    sound(player, 'random.levelup');
  } catch (e) {
    notify(player, `§cNepodařilo se postavit §f${item.name}§c. Okolí asi není načtené, nebo nemáš povolené příkazy.`);
    sound(player, 'note.bass');
  }
}

// ---------- spouštění menu ----------
const opening = new Set();
function openMenu(player) {
  if (opening.has(player.id)) return;
  opening.add(player.id);
  run(player).catch((e) => console.warn('QuickCraft menu error: ' + e)).finally(() => opening.delete(player.id));
}

world.afterEvents.itemUse.subscribe((ev) => {
  if (ev.itemStack?.typeId === MENU_ITEM) openMenu(ev.source);
});

// chat příkaz (jen pokud ho daná verze API podporuje)
if (world.beforeEvents?.chatSend) {
  world.beforeEvents.chatSend.subscribe((ev) => {
    const m = ev.message.trim().toLowerCase();
    if (m === '!qc' || m === '!menu') {
      ev.cancel = true;
      const p = ev.sender;
      system.run(() => openMenu(p));
    }
  });
}
// /scriptevent qc:menu
if (system.afterEvents?.scriptEventReceive) {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id === 'qc:menu' && ev.sourceEntity?.typeId === 'minecraft:player') openMenu(ev.sourceEntity);
  });
}

// při prvním vstupu do světa dej hráči menu item
world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  const p = ev.player;
  if (p.hasTag('qc_given')) return;
  try {
    const stack = new ItemStack(MENU_ITEM, 1);
    stack.nameTag = MENU_ITEM_NAME;
    stack.lockMode = 'none';
    p.getComponent('minecraft:inventory').container.addItem(stack);
    p.addTag('qc_given');
    p.sendMessage('§bQuick Craft: §7dostal jsi menu item. Pravý klik / tap otevře menu (nebo napiš §f!qc§7).');
  } catch { /* ignore */ }
});
