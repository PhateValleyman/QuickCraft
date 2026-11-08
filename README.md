# QuickCraft pro Luanti

Lokální port QuickCraftu z Minecraft Bedrock do Luanti 5.17+. Přidává katalog připravených staveb, vyhledávání, oblíbené a nedávné stavby, nastavení umístění a otočení, podkladové varianty `_x` a kontrolní kámen pro správu postavených instancí.

## Instalace

1. Rozbal `quickcraft` do složky `mods/` zvoleného světa nebo do složky modů hry.
2. Povol mod ve světě (v nastavení modů nebo v `world.mt`).
3. Spusť svět. Mod při prvním vstupu přidá hráči předmět „QuickCraft — menu staveb“.
4. Otevři menu předmětem nebo příkazem `/qc`. Příkazy `/qc search <text>` a `/qc settings` slouží k rychlému hledání a nastavení.

Mod je připraven pro testovací světy VoxeLibre i Minetest Game. Běžné bloky mapuje na node dostupné v právě spuštěné hře; v jiných hrách se nepodporované bloky převedou na nejbližší obecný materiál.

## Stavění a správa

V katalogu vyber kategorii a stavbu, otevři detail a zvol **Postavit**. Výchozí umístění je před hráčem; změnit lze režim umístění, otočení, podkladovou variantu a posuny X/Y/Z. Po dokončení se na počáteční roh umístí kontrolní kámen. Pravým kliknutím na něj lze stavbu teleportovat, přesunout nebo odstranit.

Přesun odstraní původní registrovaný objem a nechá kontrolní kámen. Potom zamiř na cílový blok a zadej `/qc place`. Odstranění i přesun čistí celý uložený kvádr; původní terén pod stavbou se neobnovuje. Před těmito akcemi proto zkontroluj, že se v kvádru nenachází jiné stavby.

## Vlastní `.mts` šablony

Zkopíruj Luanti schematic do `structures/custom/<id>.mts` a přidej ji příkazem pro správce:

```text
/qc add <id> <název> <šířka> <výška> <hloubka>
```

Například `/qc add chata Moje chata 9 8 10`. Název může obsahovat mezery; rozměry musí odpovídat souboru.

## Co se nepřenáší přesně

Původní addon používá Bedrock formuláře, příkazy a blokový stavový model, které Luanti nemá. Port proto používá Luanti formspec a node API. Zpracováno je všech 514 souborů `.mcstructure` a všech 257 katalogových staveb. Bedrockový obsah obsahuje 611 entit a 8 046 pozic blokových metadat; Luanti schematic nemá obecné ekvivalenty, takže tyto prvky nejsou přeneseny. Některé orientace bloků, barvy/specifické varianty a kontejnery mohou být zjednodušeny a druhy dřeva se v některých hrách sjednotí. Bedrocková animace stavění, export `.mcworld`/`.mctemplate` a WAYpoint filmový efekt teleportu nejsou součástí portu; teleport je přímý. `-1` v původní paletě je převedeno na Luanti `ignore`, aby se zachovalo jako nepřepisované místo.

## Převod a ověření

`tools/build_luanti_mod.py` načte původní Bedrock NBT a vytvoří komprimované `.qcs` šablony a `catalog.json`. Mod je ověřen v izolovaných testovacích světech. Neprovádí instalaci na NAS a nemění původní testovací světy.

Převod zachovává rozměry a převádí pořadí bloků z Bedrock NBT na rozložení Luanti schematic. Podklady k formátům: [Bedrock `.mcstructure` NBT](https://wiki.bedrock.dev/nbt/mcstructure), [Luanti schematics API](https://api.luanti.org/schematics/) a [Luanti schematic file format](https://docs.luanti.org/for-creators/luanti-schematic-file-format/).

## Zdroj a oprávnění

Původní zdroj: [PhateValleyman/QuickCraft](https://github.com/PhateValleyman/QuickCraft). Repozitář při převodu neobsahoval licenční soubor; viz `SOURCE-NOTICE.md`. Před veřejným sdílením nebo dalším šířením převzatých šablon si vyžádej souhlas autora.
