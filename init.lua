local MODNAME = minetest.get_current_modname()
local MODPATH = minetest.get_modpath(MODNAME)
local storage = minetest.get_mod_storage()
local FORM = "quickcraft:menu"
local PAGE_SIZE = 12
local ROTATIONS = { "0", "90", "180", "270" }
local state = {}
local schematic_cache = {}
local warned_blocks = {}

local function read_file(path)
	local file = io.open(path, "rb")
	if not file then
		return nil
	end
	local data = file:read("*a")
	file:close()
	return data
end

local function read_json(path)
	local data = read_file(path)
	if not data then
		return nil
	end
	return minetest.parse_json(data)
end

local catalog_doc = read_json(MODPATH .. "/catalog.json") or { categories = {} }
local categories = catalog_doc.categories or {}
local all_entries = {}
local entry_by_id = {}
local category_by_id = {}
for _, category in ipairs(categories) do
	category_by_id[category.id] = category
	for _, item in ipairs(category.items or {}) do
		if item.available and item.id then
			item.category = category.id
			all_entries[#all_entries + 1] = item
			entry_by_id[item.id] = item
		end
	end
end

local custom_entries = minetest.deserialize(storage:get_string("custom_entries")) or {}
local function save_custom_entries()
	storage:set_string("custom_entries", minetest.serialize(custom_entries))
end
local function all_entries_with_custom()
	local result = {}
	for _, item in ipairs(all_entries) do result[#result + 1] = item end
	for _, item in ipairs(custom_entries) do result[#result + 1] = item end
	return result
end

local function esc(value)
	return minetest.formspec_escape(tostring(value or ""))
end

local function player_meta_list(player, key)
	local raw = player:get_meta():get_string("quickcraft:" .. key)
	if raw == "" then return {} end
	return minetest.deserialize(raw) or {}
end
local function set_player_meta_list(player, key, list)
	player:get_meta():set_string("quickcraft:" .. key, minetest.serialize(list))
end
local function notify(player, message)
	minetest.chat_send_player(player:get_player_name(), "[QuickCraft] " .. message)
end

local function node_candidates(base, states)
	local explicit = {
		air = { "air" },
		cave_air = { "air" },
		void_air = { "air" },
		stone = { "mcl_core:stone", "default:stone" },
		granite = { "mcl_core:granite", "default:stone" },
		diorite = { "mcl_core:diorite", "default:stone" },
		andesite = { "mcl_core:andesite", "default:stone" },
		deepslate = { "mcl_deepslate:deepslate", "mcl_core:stone", "default:stone" },
		cobblestone = { "mcl_core:cobble", "default:cobble" },
		mossy_cobblestone = { "mcl_core:mossycobble", "default:mossycobble" },
		stone_bricks = { "mcl_core:stonebrick", "default:stonebrick" },
		mossy_stone_bricks = { "mcl_core:stonebrickmossy", "default:stonebrick" },
		cracked_stone_bricks = { "mcl_core:stonebrickcracked", "default:stonebrick" },
		chiseled_stone_bricks = { "mcl_core:stonebrickcarved", "default:stonebrick" },
		bricks = { "mcl_core:brick_block", "default:brick_block" },
		dirt = { "mcl_core:dirt", "default:dirt" },
		coarse_dirt = { "mcl_core:coarse_dirt", "default:dirt" },
		rooted_dirt = { "mcl_core:rooted_dirt", "mcl_core:dirt", "default:dirt" },
		grass_block = { "mcl_core:dirt_with_grass", "default:dirt_with_grass" },
		podzol = { "mcl_core:podzol", "default:dirt_with_coniferous_litter", "default:dirt" },
		mycelium = { "mcl_core:mycelium", "default:dirt_with_grass" },
		sand = { "mcl_core:sand", "default:sand" },
		red_sand = { "mcl_core:redsand", "default:desert_sand" },
		gravel = { "mcl_core:gravel", "default:gravel" },
		sandstone = { "mcl_core:sandstone", "default:sandstone" },
		red_sandstone = { "mcl_core:redsandstone", "default:desert_stone" },
		oak_planks = { "mcl_core:wood", "default:wood" },
		spruce_planks = { "mcl_core:wood", "default:wood" },
		birch_planks = { "mcl_core:wood", "default:wood" },
		jungle_planks = { "mcl_core:wood", "default:wood" },
		acacia_planks = { "mcl_core:wood", "default:wood" },
		dark_oak_planks = { "mcl_core:wood", "default:wood" },
		mangrove_planks = { "mcl_core:wood", "default:wood" },
		cherry_planks = { "mcl_core:wood", "default:wood" },
		bamboo_planks = { "mcl_bamboo:bamboo_plank", "mcl_core:wood", "default:wood" },
		oak_log = { "mcl_core:tree", "default:tree" },
		spruce_log = { "mcl_core:tree", "default:tree" },
		birch_log = { "mcl_core:tree", "default:tree" },
		jungle_log = { "mcl_core:tree", "default:tree" },
		acacia_log = { "mcl_core:tree", "default:tree" },
		dark_oak_log = { "mcl_core:tree", "default:tree" },
		mangrove_log = { "mcl_core:tree", "default:tree" },
		cherry_log = { "mcl_core:tree", "default:tree" },
		oak_leaves = { "mcl_core:leaves", "default:leaves" },
		spruce_leaves = { "mcl_core:leaves", "default:leaves" },
		birch_leaves = { "mcl_core:leaves", "default:leaves" },
		jungle_leaves = { "mcl_core:leaves", "default:leaves" },
		glass = { "mcl_core:glass", "default:glass" },
		glass_pane = { "mcl_panes:pane_glass", "xpanes:pane_flat", "mcl_core:glass", "default:glass" },
		water = { "mcl_core:water_source", "default:water_source" },
		water_source = { "mcl_core:water_source", "default:water_source" },
		flowing_water = { "mcl_core:water_flowing", "default:water_flowing" },
		lava = { "mcl_core:lava_source", "default:lava_source" },
		lava_source = { "mcl_core:lava_source", "default:lava_source" },
		flowing_lava = { "mcl_core:lava_flowing", "default:lava_flowing" },
		coal_ore = { "mcl_core:stone_with_coal", "default:stone_with_coal" },
		iron_ore = { "mcl_core:stone_with_iron", "default:stone_with_iron" },
		gold_ore = { "mcl_core:stone_with_gold", "default:stone_with_gold" },
		copper_ore = { "mcl_copper:stone_with_copper", "default:stone_with_copper" },
		diamond_ore = { "mcl_core:stone_with_diamond", "default:stone_with_diamond" },
		lapis_ore = { "mcl_core:stone_with_lapis", "default:stone_with_mese" },
		redstone_ore = { "mcl_redstone:stone_with_redstone", "default:stone" },
		iron_block = { "mcl_core:ironblock", "default:steelblock" },
		gold_block = { "mcl_core:goldblock", "default:goldblock" },
		diamond_block = { "mcl_core:diamondblock", "default:diamondblock" },
		emerald_block = { "mcl_core:emeraldblock", "default:diamondblock" },
		bookshelf = { "mcl_books:bookshelf", "default:bookshelf" },
		crafting_table = { "mcl_crafting_table:crafting_table", "default:wood" },
		furnace = { "mcl_furnaces:furnace", "default:furnace" },
		chest = { "mcl_chests:chest", "default:chest" },
		torch = { "mcl_torches:torch", "default:torch" },
		lantern = { "mcl_lanterns:lantern", "mcl_torches:torch", "default:torch" },
		glowstone = { "mcl_nether:glowstone", "default:meselamp" },
		sea_lantern = { "mcl_ocean:sea_lantern", "default:meselamp" },
		obsidian = { "mcl_core:obsidian", "default:obsidian" },
		bedrock = { "mcl_core:bedrock", "default:stone" },
		netherrack = { "mcl_nether:netherrack", "default:stone" },
		end_stone = { "mcl_end:end_stone", "default:stone" },
		tnt = { "mcl_tnt:tnt", "default:tnt" },
		ladder = { "mcl_core:ladder", "default:ladder" },
		iron_bars = { "mcl_panes:iron_bars", "xpanes:bar_flat", "default:steelblock" },
		fence = { "mcl_fences:fence", "default:fence_wood" },
		fence_gate = { "mcl_fences:fence_gate", "doors:gate_wood_closed", "default:fence_wood" },
		stone_stairs = { "mcl_stairs:stair_stone_rough", "stairs:stair_stonebrick" },
		oak_stairs = { "mcl_stairs:stair_wood", "stairs:stair_wood", "mcl_core:wood", "default:wood" },
		oak_slab = { "mcl_stairs:slab_wood", "stairs:slab_wood", "mcl_core:wood", "default:wood" },
		oak_door = { "mcl_doors:wooden_door_b_1", "doors:door_wood_a", "default:wood" },
		flower_pot = { "mcl_flowerpots:flower_pot", "default:clay" },
		white_concrete = { "mcl_core:concrete_white", "mcl_core:stone", "default:stone" },
		red_concrete = { "mcl_core:concrete_red", "mcl_core:stone", "default:stone" },
		white_terracotta = { "mcl_core:clay_white", "mcl_core:stone", "default:stone" },
		red_terracotta = { "mcl_core:clay_red", "mcl_core:stone", "default:stone" },
	}
	local candidates = explicit[base]
	if not candidates then
		local color = states and states.color
		if not color and type(base) == "string" then
			color = base:match("^([a-z_]+)_wool$") or base:match("^([a-z_]+)_carpet$")
		end
		if color then
			candidates = { "mcl_wool:" .. color, "wool:" .. color, "mcl_core:stone", "default:stone" }
		elseif type(base) == "string" and base:match("_stairs$") then
			candidates = { "mcl_stairs:stair_wood", "stairs:stair_wood", "mcl_core:wood", "default:wood" }
		elseif type(base) == "string" and base:match("_slab$") then
			candidates = { "mcl_stairs:slab_wood", "stairs:slab_wood", "mcl_core:wood", "default:wood" }
		elseif type(base) == "string" and (base:match("_log$") or base:match("_wood$")) then
			candidates = { "mcl_core:tree", "default:tree", "mcl_core:wood", "default:wood" }
		elseif type(base) == "string" and base:match("_leaves$") then
			candidates = { "mcl_core:leaves", "default:leaves" }
		elseif type(base) == "string" and base:match("_planks$") then
			candidates = { "mcl_core:wood", "default:wood" }
		elseif type(base) == "string" and base:match("_door$") then
			candidates = { "mcl_doors:wooden_door_b_1", "doors:door_wood_a", "mcl_core:wood", "default:wood" }
		elseif type(base) == "string" and base:match("_wool$") then
			candidates = { "mcl_wool:white", "wool:white", "mcl_core:stone", "default:stone" }
		elseif type(base) == "string" and base:match("glass") then
			candidates = { "mcl_core:glass", "default:glass" }
		elseif type(base) == "string" and base:match("stone") then
			candidates = { "mcl_core:stone", "default:stone" }
		elseif type(base) == "string" and (base:match("grass") or base:match("flower") or base:match("sapling")) then
			candidates = { "mcl_core:dirt_with_grass", "default:dirt_with_grass", "mcl_core:grass", "air" }
		else
			candidates = { "mcl_core:stone", "default:stone" }
		end
	end
	return candidates
end

local function resolve_block(source, states)
	if type(source) ~= "string" then return "air", 0 end
	local namespace, base = source:match("^([^:]+):(.+)$")
	if namespace ~= "minecraft" and minetest.registered_nodes[source] then
		return source, 0
	end
	local candidates = node_candidates(base or source, states or {})
	for _, name in ipairs(candidates) do
		if minetest.registered_nodes[name] then
			return name, 0
		end
	end
	local fallback = minetest.registered_nodes["mcl_core:stone"] and "mcl_core:stone" or "default:stone"
	if not warned_blocks[source] then
		warned_blocks[source] = true
		minetest.log("warning", "[QuickCraft] No node mapping for " .. source .. "; using " .. fallback)
	end
	return fallback, 0
end

local function load_schematic(id)
	if schematic_cache[id] then return schematic_cache[id] end
	local custom = id:match("^custom:") and id:sub(8) or nil
	if custom then
		local path = MODPATH .. "/structures/custom/" .. custom .. ".mts"
		if not read_file(path) then return nil, "missing .mts file: " .. custom end
		local schematic = minetest.read_schematic(path)
		if schematic then schematic_cache[id] = schematic end
		return schematic
	end
	local path = MODPATH .. "/structures/" .. id .. ".qcs"
	local packed = read_file(path)
	if not packed then return nil, "missing converted template: " .. id end
	local json = minetest.decompress(packed, "deflate")
	if not json then return nil, "could not decompress template: " .. id end
	local source = minetest.parse_json(json)
	if not source or source.v ~= 1 or not source.size or not source.layers then
		return nil, "invalid converted template: " .. id
	end
	local sx, sy, sz = source.size[1], source.size[2], source.size[3]
	local total = sx * sy * sz
	local palette = {}
	for i, block in ipairs(source.palette or {}) do
		palette[i] = { resolve_block(block.n, block.s), block.s }
	end
	local layers = source.layers
	local primary = layers[1] or {}
	local secondary = layers[2] or {}
	local data = {}
	for z = 0, sz - 1 do
		for y = 0, sy - 1 do
			for x = 0, sx - 1 do
				local source_index = x * sy * sz + y * sz + z + 1
				local index = primary[source_index]
				if (not index or index < 0) and secondary[source_index] and secondary[source_index] >= 0 then
					index = secondary[source_index]
				end
				local resolved = index and index >= 0 and palette[index + 1]
				local node_name = resolved and resolved[1] or "ignore"
				data[#data + 1] = { name = node_name, prob = 255, param2 = 0 }
			end
		end
	end
	local schematic = { size = { x = sx, y = sy, z = sz }, data = data }
	if #data ~= total then return nil, "converted template has an invalid node count: " .. id end
	schematic_cache[id] = schematic
	return schematic
end

local function get_instances()
	return minetest.deserialize(storage:get_string("instances")) or {}
end
local function save_instances(instances)
	storage:set_string("instances", minetest.serialize(instances))
end
local function get_instance(id)
	for _, instance in ipairs(get_instances()) do
		if instance.id == id then return instance end
	end
end
local function instance_id()
	return "QC-" .. tostring(os.time()) .. "-" .. tostring(math.random(0, 65535))
end

local function mark_control(pos, id)
	minetest.set_node(pos, { name = "quickcraft:control" })
	local meta = minetest.get_meta(pos)
	meta:set_string("instance_id", id)
end

local function clear_box(instance, keep_origin)
	local p = instance.origin
	local size = instance.size
	local p1 = { x = p.x, y = p.y, z = p.z }
	local p2 = { x = p.x + size.x - 1, y = p.y + size.y - 1, z = p.z + size.z - 1 }
	local vm = minetest.get_voxel_manip()
	local emin, emax = vm:read_from_map(p1, p2)
	local area = VoxelArea:new({ MinEdge = emin, MaxEdge = emax })
	local data = vm:get_data()
	local p2data = vm:get_param2_data()
	local air = minetest.get_content_id("air")
	local marker = minetest.get_content_id("quickcraft:control")
	for z = p1.z, p2.z do
		for y = p1.y, p2.y do
			for x = p1.x, p2.x do
				if not (keep_origin and x == p.x and y == p.y and z == p.z) then
					local index = area:index(x, y, z)
					data[index] = air
					p2data[index] = 0
				end
			end
		end
	end
	if keep_origin then
		local index = area:index(p.x, p.y, p.z)
		data[index] = marker
	end
	vm:set_data(data)
	vm:set_param2_data(p2data)
	vm:write_to_map()
	return true
end

local function save_player_history(player, key, id, limit)
	local list = player_meta_list(player, key)
	local result = { id }
	for _, old in ipairs(list) do
		if old ~= id and #result < limit then result[#result + 1] = old end
	end
	set_player_meta_list(player, key, result)
end

local function effective_size(size, rotation)
	if rotation == 1 or rotation == 3 then return { x = size[3], y = size[2], z = size[1] } end
	return { x = size[1], y = size[2], z = size[3] }
end

local function build_origin(player, item, cfg)
	local pos = player:get_pos()
	local px, py, pz = math.floor(pos.x), math.floor(pos.y), math.floor(pos.z)
	local size = effective_size(item.size, cfg.rotation)
	local view = player:get_look_dir()
	local x0, z0
	if cfg.position == 2 then
		x0 = px - math.floor(size.x / 2)
		z0 = pz - math.floor(size.z / 2)
	elseif cfg.position == 1 then
		x0, z0 = px, pz
	else
		if math.abs(view.x) > math.abs(view.z) then
			if view.x > 0 then
				x0, z0 = px + 2, pz - math.floor(size.z / 2)
			else
				x0, z0 = px - size.x - 1, pz - math.floor(size.z / 2)
			end
		elseif view.z > 0 then
			x0, z0 = px - math.floor(size.x / 2), pz + 2
		else
			x0, z0 = px - math.floor(size.x / 2), pz - size.z - 1
		end
	end
	return { x = x0 + cfg.dx, y = py + (item.y or 0) + cfg.dy, z = z0 + cfg.dz }, size
end

local function player_settings(player)
	local meta = player:get_meta()
	local settings = minetest.deserialize(meta:get_string("quickcraft:settings")) or {}
	return {
		position = math.max(0, math.min(2, tonumber(settings.position) or 0)),
		rotation = math.max(0, math.min(3, tonumber(settings.rotation) or 0)),
		terrain = settings.terrain ~= false,
		dx = math.max(-30, math.min(30, tonumber(settings.dx) or 0)),
		dy = math.max(-15, math.min(15, tonumber(settings.dy) or 0)),
		dz = math.max(-30, math.min(30, tonumber(settings.dz) or 0)),
	}
end

local function place_item(player, item, forced_origin, existing_instance)
	local primary, err = load_schematic(item.id)
	if not primary then notify(player, "Nelze načíst " .. item.id .. ": " .. tostring(err)); return false end
	local cfg = player_settings(player)
	local origin, size
	if forced_origin then
		origin = { x = forced_origin.x, y = forced_origin.y, z = forced_origin.z }
		size = effective_size(item.size, cfg.rotation)
	else
		origin, size = build_origin(player, item, cfg)
	end
	local rotation = ROTATIONS[cfg.rotation + 1] or "0"
	if cfg.terrain then
		local foundation = load_schematic(item.id .. "_x")
		if foundation then
			minetest.place_schematic(origin, foundation, rotation, nil, true)
		end
	end
	local ok, place_error = pcall(minetest.place_schematic, origin, primary, rotation, nil, true)
	if not ok or place_error == nil then
		notify(player, "Stavbu se nepodařilo vložit: " .. tostring(place_error or "neznámá chyba"))
		return false
	end
	local id = existing_instance and existing_instance.id or instance_id()
	mark_control(origin, id)
	local instances = get_instances()
	local record = {
		id = id,
		structure = item.id,
		name = item.name or item.id,
		origin = origin,
		size = size,
		owner = existing_instance and existing_instance.owner or player:get_player_name(),
		created = existing_instance and existing_instance.created or os.time(),
	}
	local found = false
	for i, instance in ipairs(instances) do
		if instance.id == id then instances[i] = record; found = true; break end
	end
	if not found then instances[#instances + 1] = record end
	save_instances(instances)
	if existing_instance then
		local old = existing_instance.origin
		if old and (old.x ~= origin.x or old.y ~= origin.y or old.z ~= origin.z) then
			minetest.set_node(old, { name = "air" })
		end
	end
	save_player_history(player, "recent", item.id, 12)
	schematic_cache = {}
	notify(player, "Postaveno: " .. tostring(item.name or item.id) .. " (" .. origin.x .. ", " .. origin.y .. ", " .. origin.z .. ")")
	return true
end

local function make_main(player, page)
	page = page or 1
	local first = (page - 1) * 8 + 1
	local last = math.min(#categories, first + 7)
	local fs = { "formspec_version[6]size[10,8]", "label[0.5,0.35;QuickCraft — katalog staveb]" }
	fs[#fs + 1] = "button[0.5,0.8;2.8,0.7;search;Hledat]"
	fs[#fs + 1] = "button[3.5,0.8;2.8,0.7;favorites;Oblíbené]"
	fs[#fs + 1] = "button[6.5,0.8;3,0.7;recent;Naposledy postavené]"
	for index = first, last do
		local category = categories[index]
		local local_index = index - first
		local col = local_index % 2
		local row = math.floor(local_index / 2)
		local count = 0
		for _, item in ipairs(category.items or {}) do if item.available then count = count + 1 end end
		fs[#fs + 1] = string.format("button[%.1f,%.1f;4.4,0.8;cat_%d;%s (%d)]", 0.5 + col * 4.7, 1.8 + row * 0.95, index, esc(category.name), count)
	end
	fs[#fs + 1] = "button[0.5,6.75;2.5,0.7;settings;Nastavení]"
	fs[#fs + 1] = "button[3.2,6.75;2.5,0.7;custom;Vlastní .mts]"
	if page > 1 then fs[#fs + 1] = "button[6.0,6.75;1.4,0.7;cat_prev;‹]" end
	if last < #categories then fs[#fs + 1] = "button[7.6,6.75;1.8,0.7;cat_next;Další ›]" end
	fs[#fs + 1] = "label[0.5,7.55;" .. esc(#all_entries .. " přednastavených staveb") .. "]"
	state[player:get_player_name()] = { view = "main", page = page }
	minetest.show_formspec(player:get_player_name(), FORM, table.concat(fs))
end

local function make_list(player, title, entries, page, back)
	page = page or 1
	local max_page = math.max(1, math.ceil(#entries / PAGE_SIZE))
	page = math.max(1, math.min(max_page, page))
	local fs = { "formspec_version[6]size[10,8]", "label[0.5,0.35;" .. esc(title) .. " — " .. #entries .. " položek]" }
	local first = (page - 1) * PAGE_SIZE + 1
	local last = math.min(#entries, first + PAGE_SIZE - 1)
	for index = first, last do
		local local_index = index - first
		local col = local_index % 2
		local row = math.floor(local_index / 2)
		local item = entries[index]
		local star = item.is_favorite and "★ " or ""
		local label = star .. tostring(item.name or item.id) .. "  [" .. table.concat(item.size or { "?", "?", "?" }, "×") .. "]"
		fs[#fs + 1] = string.format("button[%.1f,%.1f;4.5,0.78;item_%d;%s]", 0.5 + col * 4.7, 1.0 + row * 0.9, index, esc(label))
	end
	fs[#fs + 1] = "button[0.5,6.7;2.2,0.7;back;Zpět]"
	if page > 1 then fs[#fs + 1] = "button[6.5,6.7;1.2,0.7;prev;‹]" end
	if page < max_page then fs[#fs + 1] = "button[7.8,6.7;1.7,0.7;next;Další ›]" end
	state[player:get_player_name()] = { view = "list", title = title, entries = entries, page = page, back = back }
	minetest.show_formspec(player:get_player_name(), FORM, table.concat(fs))
end

local function mark_favorites(player, entries)
	local favs = player_meta_list(player, "favorites")
	local set = {}
	for _, id in ipairs(favs) do set[id] = true end
	local result = {}
	for _, item in ipairs(entries) do
		local copy = {}
		for key, value in pairs(item) do copy[key] = value end
		copy.is_favorite = set[item.id] == true
		result[#result + 1] = copy
	end
	return result
end

local function item_by_any_id(id)
	if entry_by_id[id] then return entry_by_id[id] end
	for _, item in ipairs(custom_entries) do if item.id == id then return item end end
end

local function make_detail(player, item, back)
	local size = item.size or { "?", "?", "?" }
	local vol = (tonumber(size[1]) or 0) * (tonumber(size[2]) or 0) * (tonumber(size[3]) or 0)
	local cat = category_by_id[item.category]
	local favs = player_meta_list(player, "favorites")
	local is_fav = false
	for _, id in ipairs(favs) do if id == item.id then is_fav = true end end
	local fs = {
		"formspec_version[6]size[9,7]",
		"label[0.5,0.4;" .. esc(item.name or item.id) .. "]",
		"textarea[0.5,1.0;8,2.2;;;" .. esc((cat and cat.name or "Vlastní šablona") .. "\nRozměry: " .. table.concat(size, " × ") .. "\nObjem: " .. vol .. " bloků\nVýškový posun: " .. tostring(item.y or 0) .. "\nUmístění a otočení lze upravit v nastavení.") .. "]",
		"button[0.5,3.7;3.7,0.8;build;Postavit]",
		"button[4.5,3.7;3.7,0.8;favorite;" .. (is_fav and "Odebrat z oblíbených" or "Přidat do oblíbených") .. "]",
		"button[0.5,4.8;3.7,0.8;settings;Nastavení stavění]",
		"button[4.5,4.8;3.7,0.8;back;Zpět]",
	}
	state[player:get_player_name()] = { view = "detail", item = item, back = back }
	minetest.show_formspec(player:get_player_name(), FORM, table.concat(fs))
end

local function make_search(player)
	state[player:get_player_name()] = { view = "search" }
	minetest.show_formspec(player:get_player_name(), FORM,
		"formspec_version[6]size[8,4]label[0.5,0.4;Hledat stavbu podle názvu nebo ID]" ..
		"field[0.5,1.6;7,0.8;query;Název;]field_enter_after_edit[query;true]" ..
		"button[0.5,2.4;3,0.8;search;Hledat]button[4,2.4;3,0.8;back;Zpět]")
end

local function make_settings(player)
	local cfg = player_settings(player)
	state[player:get_player_name()] = { view = "settings" }
	local position = cfg.position + 1
	local rotation = cfg.rotation + 1
	local terrain = cfg.terrain and "true" or "false"
	minetest.show_formspec(player:get_player_name(), FORM,
		"formspec_version[6]size[9,7]label[0.5,0.35;Nastavení stavění]" ..
		"dropdown[0.5,1.2;4,0.8;position;Před hráčem,Roh na hráči,Na střed;" .. position .. "]" ..
		"dropdown[4.7,1.2;3.8,0.8;rotation;0°,90°,180°,270°;" .. rotation .. "]" ..
		"checkbox[0.7,2.2;terrain;Položit také podkladovou variantu _x;" .. terrain .. "]" ..
		"field[0.5,3.4;2.2,0.8;dx;Posun X;" .. cfg.dx .. "]" ..
		"field[3.2,3.4;2.2,0.8;dy;Posun Y;" .. cfg.dy .. "]" ..
		"field[5.9,3.4;2.2,0.8;dz;Posun Z;" .. cfg.dz .. "]" ..
		"button[0.5,5.0;3.2,0.8;save_settings;Uložit]button[4.3,5.0;3.2,0.8;back;Zpět]")
end

local function make_instance(player, id)
	local instance = get_instance(id)
	if not instance then notify(player, "Tato instance už neexistuje."); return end
	state[player:get_player_name()] = { view = "instance", instance_id = id }
	minetest.show_formspec(player:get_player_name(), FORM,
		"formspec_version[6]size[8,7]label[0.5,0.35;" .. esc(instance.name) .. "]" ..
		"textarea[0.5,0.9;7,2;;Stavba;ID: " .. esc(instance.structure) .. "\nPozice: " .. instance.origin.x .. ", " .. instance.origin.y .. ", " .. instance.origin.z .. "\nMajitel: " .. esc(instance.owner) .. "]" ..
		"button[0.5,3.2;3.3,0.8;teleport;Teleportovat]button[4.0,3.2;3.3,0.8;move;Přesunout]" ..
		"button[0.5,4.3;3.3,0.8;remove;Odstranit…]button[4.0,4.3;3.3,0.8;instance_back;Zavřít]")
end

local function make_confirm_remove(player, id)
	state[player:get_player_name()] = { view = "confirm_remove", instance_id = id }
	minetest.show_formspec(player:get_player_name(), FORM,
		"formspec_version[6]size[8,5]label[0.5,0.5;Odstranit stavbu?]" ..
		"textarea[0.5,1.1;7,1.5;;Upozornění;QuickCraft vyčistí celý registrovaný kvádr včetně terénu pod stavbou. Obnovení původního terénu není k dispozici.]" ..
		"button[0.7,3.1;3,0.9;confirm_remove;Ano, vyčistit kvádr]button[4.3,3.1;3,0.9;cancel;Zrušit]")
end

local function remove_instance(id)
	local instance = get_instance(id)
	if not instance then return false end
	clear_box(instance, false)
	local remaining = {}
	for _, item in ipairs(get_instances()) do if item.id ~= id then remaining[#remaining + 1] = item end end
	save_instances(remaining)
	return true
end

local function begin_move(player, id)
	local instance = get_instance(id)
	if not instance then return false end
	clear_box(instance, true)
	player:get_meta():set_string("quickcraft:moving", id)
	notify(player, "Stavba vyčištěna. Dívej se na cílový blok a napiš /qc place; kontrolní kámen zůstává na původním místě.")
	return true
end

local function move_to_look(player)
	local id = player:get_meta():get_string("quickcraft:moving")
	if id == "" then notify(player, "Nemáš rozpracovaný přesun."); return false end
	local instance = get_instance(id)
	if not instance then player:get_meta():set_string("quickcraft:moving", ""); notify(player, "Přesouvaná instance už neexistuje."); return false end
	local eye = vector.add(player:get_pos(), { x = 0, y = 1.5, z = 0 })
	local direction = player:get_look_dir()
	local finish = vector.add(eye, vector.multiply(direction, 64))
	local ray = minetest.raycast(eye, finish, false, false)
	local destination
	for pointed in ray do
		if pointed.type == "node" and pointed.above then
			destination = { x = pointed.above.x, y = pointed.above.y, z = pointed.above.z }
			break
		end
	end
	if not destination then notify(player, "Nedíváš se na blok, kam lze stavbu přesunout."); return false end
	local item = item_by_any_id(instance.structure)
	if not item then notify(player, "Původní šablona není dostupná."); return false end
	if place_item(player, item, destination, instance) then
		player:get_meta():set_string("quickcraft:moving", "")
		return true
	end
	return false
end

local function open_main(player, page)
	make_main(player, page or 1)
end

minetest.register_node("quickcraft:control", {
	description = "QuickCraft — kontrolní kámen",
	tiles = { "quickcraft_control.png" },
	groups = { cracky = 1, oddly_breakable_by_hand = 1, not_in_creative_inventory = 1 },
	drop = "",
	is_ground_content = false,
	can_dig = function() return false end,
	on_rightclick = function(pos, _, clicker)
		if clicker and clicker:is_player() then
			local id = minetest.get_meta(pos):get_string("instance_id")
			if id ~= "" then make_instance(clicker, id) end
		end
	end,
})

minetest.register_craftitem("quickcraft:menu", {
	description = "QuickCraft — menu staveb",
	inventory_image = "quickcraft_menu.png",
	stack_max = 1,
	on_place = function(itemstack, user)
		if user and user:is_player() then open_main(user, 1) end
		return itemstack
	end,
	on_secondary_use = function(itemstack, user)
		if user and user:is_player() then open_main(user, 1) end
		return itemstack
	end,
})

minetest.register_chatcommand("qc", {
	params = "[search <text> | settings | place | add <id> <name> <x> <y> <z>]",
	description = "Otevře QuickCraft nebo spustí jeho pomocnou funkci",
	func = function(name, params)
		local player = minetest.get_player_by_name(name)
		if not player then return false, "Hráč nebyl nalezen." end
		local command, rest = params:match("^(%S+)%s*(.*)$")
		if not command or command == "" then open_main(player, 1); return true, "" end
		if command == "settings" then make_settings(player); return true, "" end
		if command == "place" then return move_to_look(player), "" end
		if command == "search" then
			if rest == "" then make_search(player); return true, "" end
			local q = rest:lower()
			local entries = {}
			for _, item in ipairs(all_entries_with_custom()) do
				if (item.name or ""):lower():find(q, 1, true) or (item.id or ""):lower():find(q, 1, true) then entries[#entries + 1] = item end
			end
			make_list(player, "Hledání: " .. rest, mark_favorites(player, entries), 1, { view = "main", page = 1 })
			return true, ""
		end
		if command == "add" then
			if not minetest.check_player_privs(name, { server = true }) then return false, "Přidání šablony vyžaduje oprávnění server." end
			local id, display, sx, sy, sz = rest:match("^(%S+)%s+(.+)%s+(%d+)%s+(%d+)%s+(%d+)$")
			if not id then return false, "Použití: /qc add <id> <název> <x> <y> <z>; soubor <id>.mts vlož do mod/structures/custom/." end
			id = id:lower()
			if not id:match("^[a-z0-9_%-]+$") then return false, "ID smí obsahovat jen a-z, 0-9, pomlčku a podtržítko." end
			local path = MODPATH .. "/structures/custom/" .. id .. ".mts"
			if not read_file(path) then return false, "Soubor nebyl nalezen: " .. id .. ".mts" end
			custom_entries[#custom_entries + 1] = { id = "custom:" .. id, name = display, size = { tonumber(sx), tonumber(sy), tonumber(sz) }, y = 0, category = "custom", available = true }
			save_custom_entries()
			return true, "Vlastní šablona přidána: " .. display
		end
		return false, "Neznámá volba. Použij /qc, /qc search, /qc settings nebo /qc place."
	end,
})

minetest.register_chatcommand("qcmenu", {
	params = "",
	description = "Otevře QuickCraft katalog staveb",
	func = function(name)
		local player = minetest.get_player_by_name(name)
		if player then open_main(player, 1) end
		return true, ""
	end,
})

minetest.register_on_joinplayer(function(player)
	local meta = player:get_meta()
	if meta:get_int("quickcraft:given") == 0 then
		local inv = player:get_inventory()
		if inv and inv:room_for_item("main", "quickcraft:menu") then
			inv:add_item("main", "quickcraft:menu")
			meta:set_int("quickcraft:given", 1)
		end
	end
end)

minetest.register_on_player_receive_fields(function(player, formname, fields)
	if formname ~= FORM then return false end
	local name = player:get_player_name()
	local current = state[name] or { view = "main", page = 1 }
	if fields.quit then state[name] = nil; return true end
	if current.view == "main" then
		if fields.search then make_search(player); return true end
		if fields.favorites then
			local favs = player_meta_list(player, "favorites")
			local entries = {}
			for _, id in ipairs(favs) do local item = item_by_any_id(id); if item then entries[#entries + 1] = item end end
			make_list(player, "Oblíbené", mark_favorites(player, entries), 1, { view = "main", page = current.page }); return true
		end
		if fields.recent then
			local entries = {}
			for _, id in ipairs(player_meta_list(player, "recent")) do local item = item_by_any_id(id); if item then entries[#entries + 1] = item end end
			make_list(player, "Naposledy postavené", mark_favorites(player, entries), 1, { view = "main", page = current.page }); return true
		end
		if fields.settings then make_settings(player); return true end
		if fields.custom then
			make_list(player, "Vlastní .mts", mark_favorites(player, custom_entries), 1, { view = "main", page = current.page }); return true
		end
		if fields.cat_prev then open_main(player, current.page - 1); return true end
		if fields.cat_next then open_main(player, current.page + 1); return true end
		for index = 1, #categories do
			if fields["cat_" .. index] then
				local category = categories[index]
				local entries = {}
				for _, item in ipairs(category.items or {}) do if item.available then entries[#entries + 1] = item end end
				make_list(player, category.name, mark_favorites(player, entries), 1, { view = "main", page = current.page }); return true
			end
		end
	elseif current.view == "list" then
		if fields.back then
			local back = current.back or { view = "main", page = 1 }
			if back.view == "main" then open_main(player, back.page) else make_list(player, back.title, back.entries or {}, back.page or 1, back.back) end
			return true
		end
		if fields.prev then make_list(player, current.title, current.entries, current.page - 1, current.back); return true end
		if fields.next then make_list(player, current.title, current.entries, current.page + 1, current.back); return true end
		for index = (current.page - 1) * PAGE_SIZE + 1, math.min(#current.entries, current.page * PAGE_SIZE) do
			if fields["item_" .. index] then make_detail(player, current.entries[index], current); return true end
		end
	elseif current.view == "search" then
		if fields.back then open_main(player, 1); return true end
		if fields.search or fields.key_enter then
			local query = (fields.query or ""):lower()
			local entries = {}
			for _, item in ipairs(all_entries_with_custom()) do
				if query == "" or (item.name or ""):lower():find(query, 1, true) or (item.id or ""):lower():find(query, 1, true) then entries[#entries + 1] = item end
			end
			make_list(player, "Hledání: " .. (fields.query or ""), mark_favorites(player, entries), 1, { view = "main", page = 1 }); return true
		end
	elseif current.view == "detail" then
		if fields.back then
			local back = current.back
			if back and back.view == "list" then make_list(player, back.title, back.entries, back.page, back.back) else open_main(player, (back and back.page) or 1) end
			return true
		end
		if fields.build then place_item(player, current.item); state[name] = nil; return true end
		if fields.settings then make_settings(player); return true end
		if fields.favorite then
			local favs = player_meta_list(player, "favorites")
			local found, updated = false, {}
			for _, id in ipairs(favs) do if id == current.item.id then found = true else updated[#updated + 1] = id end end
			if not found then updated[#updated + 1] = current.item.id end
			set_player_meta_list(player, "favorites", updated)
			make_detail(player, current.item, current.back)
			return true
		end
	elseif current.view == "settings" then
		if fields.back then open_main(player, 1); return true end
		if fields.save_settings then
			local cfg = {
				position = math.max(0, math.min(2, (tonumber(fields.position) or 1) - 1)),
				rotation = math.max(0, math.min(3, (tonumber(fields.rotation) or 1) - 1)),
				terrain = fields.terrain == "true",
				dx = math.max(-30, math.min(30, tonumber(fields.dx) or 0)),
				dy = math.max(-15, math.min(15, tonumber(fields.dy) or 0)),
				dz = math.max(-30, math.min(30, tonumber(fields.dz) or 0)),
			}
			player:get_meta():set_string("quickcraft:settings", minetest.serialize(cfg))
			notify(player, "Nastavení uloženo.")
			open_main(player, 1)
			return true
		end
	elseif current.view == "instance" then
		local instance = get_instance(current.instance_id)
		if fields.instance_back then open_main(player, 1); return true end
		if not instance then notify(player, "Instance už neexistuje."); open_main(player, 1); return true end
		if fields.teleport then player:set_pos({ x = instance.origin.x, y = instance.origin.y + 1, z = instance.origin.z }); state[name] = nil; return true end
		if fields.move then begin_move(player, instance.id); state[name] = nil; return true end
		if fields.remove then make_confirm_remove(player, instance.id); return true end
	elseif current.view == "confirm_remove" then
		if fields.cancel then make_instance(player, current.instance_id); return true end
		if fields.confirm_remove then
			if remove_instance(current.instance_id) then notify(player, "Registrovaný objem byl vyčištěn.") end
			state[name] = nil
			return true
		end
	end
	return true
end)

local qc_api = rawget(_G, "quickcraft") or {}
qc_api.api_version = 1
qc_api.catalog = categories
qc_api.load_schematic = load_schematic
qc_api.resolve_block = resolve_block
qc_api.get_instances = get_instances
rawset(_G, "quickcraft", qc_api)

minetest.log("action", "[QuickCraft] Loaded " .. #all_entries .. " catalog structures in " .. tostring(minetest.get_game_info().id))
