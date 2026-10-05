# =============================================================================
#  QuickCraft — Makefile
#  Packages the behavior & resource packs into .mcpack files and bundles
#  them into a single .mcaddon file.
#
#  Usage:
#    make            -> scan structures + build .mcpack + .mcaddon
#    make scan       -> map every .mcstructure and generate exact dimensions
#    make packs      -> build only the .mcpack files
#    make sync       -> sync BP->RP dependency (auto-activate resource pack)
#    make lint       -> syntax-check all scripts
#    make bp         -> build only the behavior pack (.mcpack)
#    make rp         -> build only the resource pack (.mcpack)
#    make addon      -> build only the .mcaddon (requires packs)
#    make clean      -> remove everything from dist/
#    make rebuild    -> clean + build
# =============================================================================

# ---- Configuration ----------------------------------------------------------

PACK_DIR        := pack
BP_DIR          := $(PACK_DIR)/behavior_pack/QuickCraft
RP_DIR          := $(PACK_DIR)/resource_pack/QuickCraft
STRUCTURES_DIR  := $(BP_DIR)/structures
DIMENSIONS_JS   := $(BP_DIR)/scripts/structure_dimensions.js
SCANNER         := tools/scan_structures.py
PACKS_TOOL      := tools/packs.py
NODE            ?= node

DIST_DIR        := dist
NAME            := QuickCraft
BP_NAME         := $(NAME)_BP
RP_NAME         := $(NAME)_RP
BP_MCPACK       := $(DIST_DIR)/$(BP_NAME).mcpack
RP_MCPACK       := $(DIST_DIR)/$(RP_NAME).mcpack
MCADDON         := $(DIST_DIR)/$(NAME).mcaddon

ZIP             := zip
ZIPFLAGS        := -r -q -X
PYTHON          ?= python3

EXCLUDES := \
	-x "*.DS_Store" \
	-x "*__MACOSX*" \
	-x "*.git*" \
	-x "*.mcpack" \
	-x "*.mcaddon" \
	-x "*.mcworld" \
	-x "*.mctemplate"

.PHONY: all scan sync lint packs bp rp addon clean rebuild check help

all: addon

# Scan every Bedrock structure file before packaging so dimensions stay exact.
scan: $(DIMENSIONS_JS)

$(DIMENSIONS_JS): $(SCANNER) $(shell find $(STRUCTURES_DIR) -type f -name '*.mcstructure' 2>/dev/null)
	@echo ">> Mapping .mcstructure dimensions"
	@$(PYTHON) $(SCANNER) $(STRUCTURES_DIR) $(DIMENSIONS_JS)

# Keep BP -> RP dependency (UUID + version) in sync so the resource pack is
# activated automatically together with the behavior pack.
sync:
	@$(PYTHON) $(PACKS_TOOL) sync

# Catch script syntax errors (e.g. duplicate imports) before they ship;
# a single broken module stops the whole behavior pack script from loading.
lint:
	@echo ">> Checking script syntax"
	@command -v $(NODE) >/dev/null 2>&1 || (echo "   'node' not installed - skipping"; exit 0)
	@for f in $(BP_DIR)/scripts/*.js; do \
		$(NODE) --input-type=module --check < "$$f" || (echo "   syntax error in $$f"; exit 1); \
	done
	@echo "   OK."

packs: bp rp

bp: $(BP_MCPACK)

rp: $(RP_MCPACK)

addon: packs $(MCADDON)

# Rebuild the behavior pack whenever the structure map changes.
$(BP_MCPACK): lint sync scan $(shell find $(BP_DIR) -type f 2>/dev/null)
	@echo ">> Packaging behavior pack -> $(BP_MCPACK)"
	@mkdir -p $(DIST_DIR)
	@rm -f $(BP_MCPACK)
	@cd $(BP_DIR) && $(ZIP) $(ZIPFLAGS) "$(abspath $(BP_MCPACK))" . $(EXCLUDES)
	@echo "   done."

$(RP_MCPACK): $(shell find $(RP_DIR) -type f 2>/dev/null)
	@echo ">> Packaging resource pack -> $(RP_MCPACK)"
	@mkdir -p $(DIST_DIR)
	@rm -f $(RP_MCPACK)
	@cd $(RP_DIR) && $(ZIP) $(ZIPFLAGS) "$(abspath $(RP_MCPACK))" . $(EXCLUDES)
	@echo "   done."

$(MCADDON): $(BP_MCPACK) $(RP_MCPACK)
	@echo ">> Bundling -> $(MCADDON)"
	@rm -f $(MCADDON)
	@cd $(DIST_DIR) && $(ZIP) $(ZIPFLAGS) "$(abspath $(MCADDON))" \
		"$(BP_NAME).mcpack" "$(RP_NAME).mcpack"
	@echo "   done."

check:
	@echo ">> Checking required folders..."
	@test -d "$(BP_DIR)" || (echo "   missing: $(BP_DIR)"; exit 1)
	@test -d "$(RP_DIR)" || (echo "   missing: $(RP_DIR)"; exit 1)
	@test -d "$(STRUCTURES_DIR)" || (echo "   missing: $(STRUCTURES_DIR)"; exit 1)
	@test -f "$(BP_DIR)/manifest.json" || (echo "   missing: $(BP_DIR)/manifest.json"; exit 1)
	@test -f "$(RP_DIR)/manifest.json" || (echo "   missing: $(RP_DIR)/manifest.json"; exit 1)
	@command -v $(ZIP) >/dev/null 2>&1 || (echo "   'zip' not installed"; exit 1)
	@command -v $(PYTHON) >/dev/null 2>&1 || (echo "   '$(PYTHON)' not installed"; exit 1)
	@echo "   OK."

clean:
	@echo ">> Cleaning $(DIST_DIR)/"
	@rm -rf $(DIST_DIR)

rebuild: clean all

help:
	@echo "QuickCraft — available targets:"
	@echo "  all       (default) scan + build .mcpack + .mcaddon"
	@echo "  scan      map all .mcstructure dimensions"
	@echo "  packs     build only the .mcpack files"
	@echo "  bp        build only the behavior pack (.mcpack)"
	@echo "  rp        build only the resource pack (.mcpack)"
	@echo "  addon     build only the .mcaddon"
	@echo "  check     verify folders, manifests, Python and zip"
	@echo "  clean     remove dist/"
	@echo "  rebuild   clean + all"
	@echo "  help      show this message"
