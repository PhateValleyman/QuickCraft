minetest.register_on_mods_loaded(function()
	minetest.after(1, function()
		local function fail(message)
			minetest.log("error", "[QuickCraft Verify] FAIL: " .. message)
			minetest.safe_file_write(minetest.get_worldpath() .. "/quickcraft-verify.txt", "FAIL\n" .. message .. "\n")
			minetest.request_shutdown("QuickCraft verification failed")
		end

		local qc = rawget(_G, "quickcraft")
		if not qc or qc.api_version ~= 1 then
			fail("QuickCraft API is missing")
			return
		end
		if not minetest.registered_items["quickcraft:menu"] or not minetest.registered_nodes["quickcraft:control"] then
			fail("menu item or control node was not registered")
			return
		end
		for _, source in ipairs({ "minecraft:stone_stairs", "minecraft:fence", "minecraft:fence_gate", "minecraft:bookshelf" }) do
			local mapped = qc.resolve_block(source, {})
			if not mapped or mapped == "mcl_core:stone" or mapped == "default:stone" or not minetest.registered_nodes[mapped] then
				fail(source .. " has no specific registered mapping (got " .. tostring(mapped) .. ")")
				return
			end
		end

		local ids = { "starter_house1", "starter_house1_x", "castle1", "green_house", "statue_godzila" }
		local summaries = {}
		for _, id in ipairs(ids) do
			local ok, schematic, reason = pcall(qc.load_schematic, id)
			if not ok or not schematic then
				fail(id .. " failed to load: " .. tostring(reason or schematic))
				return
			end
			local expected = schematic.size.x * schematic.size.y * schematic.size.z
			if #schematic.data ~= expected then
				fail(id .. " has " .. #schematic.data .. " nodes; expected " .. expected)
				return
			end
			for index, node in ipairs(schematic.data) do
				if not node.name or (node.name ~= "air" and not minetest.registered_nodes[node.name]) then
					fail(id .. " contains unregistered node at data index " .. index .. ": " .. tostring(node.name))
					return
				end
			end
			summaries[#summaries + 1] = string.format("%s %dx%dx%d nodes=%d", id, schematic.size.x, schematic.size.y, schematic.size.z, expected)
		end

		local minp = { x = 0, y = -8, z = 0 }
		local maxp = { x = 12, y = 20, z = 12 }
		minetest.emerge_area(minp, maxp, function(_, _, remaining)
			if remaining ~= 0 then return end
			local schematic = qc.load_schematic("starter_house1")
			local first = schematic.data[1]
			local ok, placed_result = pcall(minetest.place_schematic, { x = 0, y = 0, z = 0 }, schematic, "0", nil, true)
			if not ok or placed_result ~= true then
				fail("place_schematic call failed: " .. tostring(placed_result))
				return
			end
			local placed = minetest.get_node({ x = 0, y = 0, z = 0 }).name
			if placed ~= first.name then
				fail("placed origin node mismatch: got " .. placed .. ", expected " .. first.name)
				return
			end
			local report = table.concat({
				"PASS",
				"game=" .. tostring(minetest.get_game_info().id),
				table.concat(summaries, "\n"),
				"placement=starter_house1 origin=" .. placed,
			}, "\n") .. "\n"
			minetest.safe_file_write(minetest.get_worldpath() .. "/quickcraft-verify.txt", report)
			minetest.log("action", "[QuickCraft Verify] " .. report:gsub("\n", " | "))
			minetest.request_shutdown("QuickCraft verification passed")
		end)
	end)
end)
