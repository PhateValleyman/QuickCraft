# Výsledky lokálního ověření

Testy proběhly na Luanti 5.17.0 v nových dočasných světech Minetest Game i VoxeLibre. Oba testovací běhy prošly: mod se načetl, cílové bloky se namapovaly a stavba `starter_house1` se skutečně vložila do testovací mapy.

V obou hrách se ověřilo načtení pěti šablon: `starter_house1`, `starter_house1_x`, `castle1`, `green_house` a `statue_godzila`. Test zahrnul také běžné mapování kamenných schodů, plotu, brány a knihovny. Převodní skript samostatně zpracoval všech 514 vstupních `.mcstructure` bez chyby a všechny položky 257-kusového katalogu mají odpovídající šablonu.

`statue_godzila` má rozměry 138 × 120 × 104, tedy 1 722 240 pozic bloků. V testu byla načtena a zkontrolována, ale nebyla celá stavěna; její načítání může na slabším serveru způsobit znatelnou prodlevu.

Testy se týkaly pouze nově vytvořených izolovaných lokálních světů. Původní uživatelské světy zůstaly beze změn. Mod nebyl instalován na fyzické zařízení ani publikován na GitHubu.
