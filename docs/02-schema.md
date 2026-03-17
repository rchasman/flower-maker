# SpacetimeDB Schema

## Tables (12)

### Game State

**User** — player profile and progression
- identity (PK), name, online, current_session_id, total_orders, xp, level, joined_at

**FlowerSession** — a flower-building workspace
- id (PK, auto_inc), owner, created_at, status (Designing/Ordered/Complete), prompt, canvas_x, canvas_y, arrangement_level, flower_count, generation, fitness_json

**FlowerSpec** — the AI-generated botanical spec for a session
- session_id (PK), spec_json (serialized FlowerSpec), version, updated_at

**FlowerPartOverride** — per-instance tweaks (forks)
- id (PK), session_id (btree index), part_path, override_json, forked_from, created_at

**FlowerOrder** — orders placed by humans or agents
- id (PK), session_id (btree index), orderer, ordered_at, source (Human/Agent), note

### Metagame

**Environment** — abstract scoring contexts for fitness leaderboards
- id (PK), name, config_json, is_active, created_at
- 6 presets seeded on init: Tropical, Alpine, Desert, Temperate, Nocturnal, Storm

**FitnessScore** — how well a flower scores in an environment
- id (PK), session_id (btree), environment_id (btree), score, generation, evaluated_at

**LeaderboardEntry** — top-50 flowers per environment
- id (PK), environment_id (btree), session_id, owner, score, rank, flower_name, updated_at

### Social

**ChatMessage** — global chat with optional emotes
- id (PK), sender, text, sent_at, emote

### Progression

**SkinDefinition** — cosmetic skins with rarity tiers
- id (PK), name, description, rarity (Common→Legendary), unlock_xp, css_class

**UserSkin** — unlocked skins per user
- id (PK), owner (btree), skin_id, unlocked_at, equipped

**EmoteUnlock** — unlocked emotes per user
- id (PK), owner, emote (Wave/Sparkle/Rain/Bloom/Wilt/Dance/Pollinate), unlocked_at

## Key Reducers

- `create_session(prompt)` — creates session + blank spec at random position
- `update_flower_spec(session_id, spec_json)` — updates the AI-generated spec
- `fork_part(session_id, part_path, override_json, forked_from)` — create part override
- `merge_sessions(a_id, b_id, ai_json)` — breed via genetics, combine, archive parents, evaluate fitness, award XP
- `evaluate_session_fitness(session_id)` — score against all environments
- `place_order(session_id, source, note)` — create order, award XP, unlock skins/emotes
- `send_chat(text)` / `send_emote(emote)` — global chat
- `set_name(name)` / `equip_skin(skin_id)` — profile
