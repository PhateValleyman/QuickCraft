// QuickCraft in-game guide opened by the crafted guide item.
import { ActionFormData } from '@minecraft/server-ui';
import { system, world } from '@minecraft/server';

const GUIDE_ITEM = 'qc:guide';
const formTitle = (text) => `§l§bQuickCraft §8· §r${text}`;
const sleep = (ticks) => new Promise((resolve) => system.runTimeout(resolve, ticks));

// Retry forms while chat or another form temporarily occupies the player UI.
async function show(player, form) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await form.show(player);
    if (result.cancelationReason === 'UserBusy') {
      await sleep(10);
      continue;
    }
    return result;
  }
  return { canceled: true };
}

const PAGES = [
  {
    title: '1 / 6 · Začínáme',
    body: 'QuickCraft je menu pro rychlé stavění hotových struktur.\n\n' +
      'Potřebuješ svět s povolenými příkazy, protože add-on používá příkaz /structure load.\n\n' +
      'Po importu zapni v nastavení světa Behavior Pack i Resource Pack QuickCraft.',
  },
  {
    title: '2 / 6 · Itemy',
    body: '§bQuickCraft menu§r otevře katalog staveb.\n' +
      '§bStavební hůl§r je alternativní item pro otevření stejného katalogu.\n' +
      '§bPrůvodce§r otevře tuto knihu znovu.\n\n' +
      'Itemy lze vyrobit v crafting table podle receptů QuickCraft nebo získat příkazem /give.',
  },
  {
    title: '3 / 6 · Výběr stavby',
    body: 'V hlavním menu můžeš použít hledání, oblíbené, naposledy postavené nebo kategorie.\n\n' +
      'Detail stavby ukazuje rozměry, kategorii a ovládání. Před stavěním nastav pozici, otočení, zrcadlení, základ a animaci.',
  },
  {
    title: '4 / 6 · Vlastní struktury',
    body: 'Vytvoř nebo zkopíruj soubor .mcstructure do BP/structures a znovu importuj addon.\n\n' +
      'V menu otevři Vlastní struktury → Přidat / importovat a zadej ID souboru bez přípony, název a rozměry X Y Z.\n\n' +
      'Strukturu lze také uložit ve světě příkazem /structure save.',
  },
  {
    title: '5 / 6 · Kontrolní kámen',
    body: 'Po úspěšném postavení QuickCraft uloží instanci a na její origin umístí kontrolní kámen.\n\n' +
      'Klepnutím na kámen otevřeš oblíbené, informace, přesun nebo odstranění. Kámen je chráněn před náhodným rozbitím.\n\n' +
      'Přesun: spusť přesun, zamiř na nové místo a klepnutím potvrď umístění.',
  },
  {
    title: '6 / 6 · Tipy a řešení problémů',
    body: 'Velké stavby mohou vyžadovat načtené okolí a dostatek místa. Pokud stavba selže, přibliž se, načti chunky a zkontroluj povolení příkazů.\n\n' +
      'Resource Pack poskytuje společný atlas ikon pro menu, hůl, průvodce i kontrolní blok.\n\n' +
      'Verze projektu: QuickCraft 2.4.0 · Minecraft Bedrock 1.21.80+',
  },
];

async function openGuide(player, page = 0) {
  const index = Math.max(0, Math.min(PAGES.length - 1, page));
  const current = PAGES[index];
  const form = new ActionFormData()
    .title(formTitle(current.title))
    .body(`§7${current.body}`);
  if (index > 0) form.button('§l‹ Předchozí');
  if (index < PAGES.length - 1) form.button('§lDalší ›');
  form.button('§l« Zavřít');
  const result = await show(player, form);
  if (result.canceled) return;
  const previousOffset = index > 0 ? 1 : 0;
  if (index > 0 && result.selection === 0) return openGuide(player, index - 1);
  if (index < PAGES.length - 1 && result.selection === previousOffset) return openGuide(player, index + 1);
}

// The guide is intentionally handled in its own module so item behavior stays modular.
world.afterEvents.itemUse.subscribe((event) => {
  if (event.itemStack?.typeId !== GUIDE_ITEM) return;
  openGuide(event.source).catch((error) => console.warn('QuickCraft guide error: ' + error));
});
