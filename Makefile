# =============================================================================
#  QuickCraft — Makefile
#  Packages the behavior & resource packs into .mcpack files and bundles
#  them into a single .mcaddon file.
#
#  Usage:
#    make            -> scan structures + build .mcpack + .mcaddon
#    make scan       -> map every .mcstructure and generate exact dimensions
#    make packs      -> build only the .mcpack files
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
NODE            ?= node

EXCLUDES := \
	-x "*.DS_Store" \
	-x "*__MACOSX*" \
	-x "*.git*" \
	-x "*.mcpack" \
	-x "*.mcaddon" \
	-x "*.mcworld" \
	-x "*.mctemplate"

.PHONY: all scan packs bp rp addon clean rebuild check help

all: addon

# Scan every Bedrock structure file before packaging so dimensions stay exact.
scan: $(DIMENSIONS_JS)

$(DIMENSIONS_JS): $(SCANNER) $(shell find $(STRUCTURES_DIR) -type f -name '*.mcstructure' 2>/dev/null)
	@echo ">> Mapping .mcstructure dimensions"
	@$(PYTHON) $(SCANNER) $(STRUCTURES_DIR) $(DIMENSIONS_JS)

packs: bp rp

bp: $(BP_MCPACK)

rp: $(RP_MCPACK)

addon: packs $(MCADDON)

# Rebuild the behavior pack whenever the structure map changes.
$(BP_MCPACK): scan $(shell find $(BP_DIR) -type f 2>/dev/null)
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
	@command -v $(NODE) >/dev/null 2>&1 || (echo "   '$(NODE)' not installed"; exit 1)
	@echo ">> Checking JavaScript syntax..."
	@for file in $(shell find $(BP_DIR)/scripts -type f -name '*.js' -print); do \
		$(NODE) --check "$$file" || exit 1; \
	done
	@echo ">> Checking JSON resources..."
	@for file in $(shell find $(PACK_DIR) -type f -name '*.json' -print); do \
		$(PYTHON) -m json.tool "$$file" >/dev/null || exit 1; \
	done
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
	@echo "  check     verify folders, manifests, scripts, JSON, Python and zip"
	@echo "  clean     remove dist/"
	@echo "  rebuild   clean + all"
	@echo "  help      show this message"
