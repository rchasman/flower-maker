use spacetimedb::{Identity, ReducerContext, SpacetimeType, Table, Timestamp};
use spacetimedb::rand::Rng;

// ═══════════════════════════════════════════════════════════════════════════
// Custom Types
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Clone, Debug, PartialEq, SpacetimeType)]
pub enum SessionStatus { Designing, Ordered, Complete }

#[derive(Clone, Debug, PartialEq, SpacetimeType)]
pub enum OrderSource { Human, Agent }

#[derive(Clone, Debug, PartialEq, SpacetimeType)]
pub enum EmoteKind { Wave, Sparkle, Rain, Bloom, Wilt, Dance, Pollinate }

#[derive(Clone, Debug, PartialEq, SpacetimeType)]
pub enum SkinRarity { Common, Uncommon, Rare, Epic, Legendary }

// ═══════════════════════════════════════════════════════════════════════════
// Tables
// ═══════════════════════════════════════════════════════════════════════════

#[spacetimedb::table(accessor = user, public)]
pub struct User {
    #[primary_key]
    identity: Identity,
    name: Option<String>,
    online: bool,
    current_session_id: Option<u64>,
    total_orders: u32,
    xp: u64,
    level: u32,
    joined_at: Timestamp,
}

#[spacetimedb::table(accessor = flower_session, public)]
pub struct FlowerSession {
    #[primary_key]
    #[auto_inc]
    id: u64,
    owner: Identity,
    created_at: Timestamp,
    status: SessionStatus,
    prompt: String,
    canvas_x: f64,
    canvas_y: f64,
    arrangement_level: u32,   // 1=stem, 3=group, 10=bouquet, etc.
    flower_count: u32,
    generation: u32,          // how many merges deep
    fitness_json: String,     // serialized fitness scores per environment
}

#[spacetimedb::table(accessor = flower_spec, public)]
pub struct FlowerSpec {
    #[primary_key]
    session_id: u64,
    spec_json: String,
    version: u32,
    updated_at: Timestamp,
}

#[spacetimedb::table(
    accessor = part_override,
    public,
    index(name = "idx_override_session", accessor = idx_override_session, btree(columns = [session_id]))
)]
pub struct FlowerPartOverride {
    #[primary_key]
    #[auto_inc]
    id: u64,
    session_id: u64,
    part_path: String,
    override_json: String,
    forked_from: String,
    created_at: Timestamp,
}

#[spacetimedb::table(
    accessor = flower_order,
    public,
    index(name = "idx_order_session", accessor = idx_order_session, btree(columns = [session_id]))
)]
pub struct FlowerOrder {
    #[primary_key]
    #[auto_inc]
    id: u64,
    session_id: u64,
    orderer: Identity,
    ordered_at: Timestamp,
    source: OrderSource,
    note: Option<String>,
}

// ── Metagame: Environments, Fitness, Leaderboards ────────────────────────

#[spacetimedb::table(accessor = environment, public)]
pub struct Environment {
    #[primary_key]
    #[auto_inc]
    id: u64,
    name: String,
    config_json: String,
    is_active: bool,
    created_at: Timestamp,
}

#[spacetimedb::table(
    accessor = fitness_score,
    public,
    index(name = "idx_fitness_env", accessor = idx_fitness_env, btree(columns = [environment_id])),
    index(name = "idx_fitness_session", accessor = idx_fitness_session, btree(columns = [session_id]))
)]
pub struct FitnessScore {
    #[primary_key]
    #[auto_inc]
    id: u64,
    session_id: u64,
    environment_id: u64,
    score: f64,
    generation: u32,
    evaluated_at: Timestamp,
}

#[spacetimedb::table(
    accessor = leaderboard_entry,
    public,
    index(name = "idx_lb_env", accessor = idx_lb_env, btree(columns = [environment_id]))
)]
pub struct LeaderboardEntry {
    #[primary_key]
    #[auto_inc]
    id: u64,
    environment_id: u64,
    session_id: u64,
    owner: Identity,
    score: f64,
    rank: u32,
    flower_name: String,
    updated_at: Timestamp,
}

// ── Chat ──────────────────────────────────────────────────────────────────

#[spacetimedb::table(accessor = chat_message, public)]
pub struct ChatMessage {
    #[primary_key]
    #[auto_inc]
    id: u64,
    sender: Identity,
    text: String,
    sent_at: Timestamp,
    emote: Option<EmoteKind>,
}

// ── Progression & Skins ──────────────────────────────────────────────────

#[spacetimedb::table(accessor = skin_definition, public)]
pub struct SkinDefinition {
    #[primary_key]
    #[auto_inc]
    id: u64,
    name: String,
    description: String,
    rarity: SkinRarity,
    unlock_xp: u64,
    css_class: String,
}

#[spacetimedb::table(
    accessor = user_skin,
    public,
    index(name = "idx_uskin_owner", accessor = idx_uskin_owner, btree(columns = [owner]))
)]
pub struct UserSkin {
    #[primary_key]
    #[auto_inc]
    id: u64,
    owner: Identity,
    skin_id: u64,
    unlocked_at: Timestamp,
    equipped: bool,
}

#[spacetimedb::table(accessor = emote_unlock, public)]
pub struct EmoteUnlock {
    #[primary_key]
    #[auto_inc]
    id: u64,
    owner: Identity,
    emote: EmoteKind,
    unlocked_at: Timestamp,
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: ownership check
// ═══════════════════════════════════════════════════════════════════════════

fn require_session_owner(ctx: &ReducerContext, session_id: u64) -> Result<FlowerSession, String> {
    let session = ctx.db.flower_session().id().find(session_id)
        .ok_or_else(|| "Session not found".to_string())?;
    if session.owner != ctx.sender() {
        return Err("Not the session owner".to_string());
    }
    Ok(session)
}

fn require_user(ctx: &ReducerContext) -> Result<User, String> {
    ctx.db.user().identity().find(ctx.sender())
        .ok_or_else(|| "User not found".to_string())
}

// ═══════════════════════════════════════════════════════════════════════════
// Lifecycle Reducers
// ═══════════════════════════════════════════════════════════════════════════

#[spacetimedb::reducer(init)]
pub fn init(ctx: &ReducerContext) {
    // Seed default skins
    let skins = vec![
        ("Seedling", "Your first sprout", SkinRarity::Common, 0u64, "skin-seedling"),
        ("Petal Pusher", "10 flowers ordered", SkinRarity::Uncommon, 500, "skin-petal-pusher"),
        ("Garden Keeper", "A seasoned grower", SkinRarity::Rare, 2000, "skin-garden-keeper"),
        ("Bloom Lord", "Master of the garden", SkinRarity::Epic, 10000, "skin-bloom-lord"),
        ("Eternal Flower", "Legend of the meadow", SkinRarity::Legendary, 50000, "skin-eternal"),
    ];
    for (name, desc, rarity, xp, css) in skins {
        ctx.db.skin_definition().insert(SkinDefinition {
            id: 0,
            name: name.to_string(),
            description: desc.to_string(),
            rarity,
            unlock_xp: xp,
            css_class: css.to_string(),
        });
    }

    // Seed environments from flower-core canonical definitions
    let envs = flower_core::environment::all_environments();
    for env in &envs {
        let config_json = serde_json::to_string(env).unwrap_or_default();
        ctx.db.environment().insert(Environment {
            id: 0,
            name: env.name.clone(),
            config_json,
            is_active: true,
            created_at: ctx.timestamp,
        });
    }

    log::info!("flower-maker module initialized with {} skins, {} environments", 5, envs.len());
}

#[spacetimedb::reducer(client_connected)]
pub fn client_connected(ctx: &ReducerContext) {
    match ctx.db.user().identity().find(ctx.sender()) {
        Some(existing) => {
            ctx.db.user().identity().update(User { online: true, ..existing });
        }
        None => {
            ctx.db.user().insert(User {
                identity: ctx.sender(),
                name: None,
                online: true,
                current_session_id: None,
                total_orders: 0,
                xp: 0,
                level: 1,
                joined_at: ctx.timestamp,
            });
            // Everyone gets Wave emote free
            ctx.db.emote_unlock().insert(EmoteUnlock {
                id: 0,
                owner: ctx.sender(),
                emote: EmoteKind::Wave,
                unlocked_at: ctx.timestamp,
            });
            log::info!("New user connected: {:?}", ctx.sender());
        }
    }
}

#[spacetimedb::reducer(client_disconnected)]
pub fn client_disconnected(ctx: &ReducerContext) {
    if let Some(existing) = ctx.db.user().identity().find(ctx.sender()) {
        ctx.db.user().identity().update(User { online: false, ..existing });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Session & Flower Reducers
// ═══════════════════════════════════════════════════════════════════════════

#[spacetimedb::reducer]
pub fn create_session(ctx: &ReducerContext, prompt: String) -> Result<(), String> {
    if prompt.is_empty() {
        return Err("Prompt cannot be empty".to_string());
    }

    // Random canvas position via deterministic RNG
    let x = (ctx.rng().r#gen::<u32>() % 10000) as f64 / 100.0;
    let y = (ctx.rng().r#gen::<u32>() % 10000) as f64 / 100.0;

    let session = ctx.db.flower_session().insert(FlowerSession {
        id: 0,
        owner: ctx.sender(),
        created_at: ctx.timestamp,
        status: SessionStatus::Designing,
        prompt,
        canvas_x: x,
        canvas_y: y,
        arrangement_level: 1,
        flower_count: 1,
        generation: 0,
        fitness_json: "{}".to_string(),
    });

    ctx.db.flower_spec().insert(FlowerSpec {
        session_id: session.id,
        spec_json: String::from("{}"),
        version: 0,
        updated_at: ctx.timestamp,
    });

    if let Some(user) = ctx.db.user().identity().find(ctx.sender()) {
        ctx.db.user().identity().update(User {
            current_session_id: Some(session.id),
            ..user
        });
    }

    log::info!("Session {} created at ({:.1}, {:.1})", session.id, x, y);
    Ok(())
}

#[spacetimedb::reducer]
pub fn update_flower_spec(ctx: &ReducerContext, session_id: u64, spec_json: String) -> Result<(), String> {
    let _session = require_session_owner(ctx, session_id)?;
    let existing = ctx.db.flower_spec().session_id().find(session_id)
        .ok_or_else(|| "Spec not found".to_string())?;

    ctx.db.flower_spec().session_id().update(FlowerSpec {
        spec_json,
        version: existing.version + 1,
        updated_at: ctx.timestamp,
        ..existing
    });
    Ok(())
}

#[spacetimedb::reducer]
pub fn fork_part(
    ctx: &ReducerContext,
    session_id: u64,
    part_path: String,
    override_json: String,
    forked_from: String,
) -> Result<(), String> {
    let _session = require_session_owner(ctx, session_id)?;
    ctx.db.part_override().insert(FlowerPartOverride {
        id: 0,
        session_id,
        part_path,
        override_json,
        forked_from,
        created_at: ctx.timestamp,
    });
    Ok(())
}

#[spacetimedb::reducer]
pub fn update_part_override(ctx: &ReducerContext, override_id: u64, override_json: String) -> Result<(), String> {
    let existing = ctx.db.part_override().id().find(override_id)
        .ok_or_else(|| "Override not found".to_string())?;
    let _session = require_session_owner(ctx, existing.session_id)?;
    ctx.db.part_override().id().update(FlowerPartOverride { override_json, ..existing });
    Ok(())
}

#[spacetimedb::reducer]
pub fn delete_part_override(ctx: &ReducerContext, override_id: u64) -> Result<(), String> {
    let existing = ctx.db.part_override().id().find(override_id)
        .ok_or_else(|| "Override not found".to_string())?;
    let _session = require_session_owner(ctx, existing.session_id)?;
    ctx.db.part_override().id().delete(override_id);
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════
// Orders & Progression
// ═══════════════════════════════════════════════════════════════════════════

#[spacetimedb::reducer]
pub fn place_order(ctx: &ReducerContext, session_id: u64, source: OrderSource, note: Option<String>) -> Result<(), String> {
    let session = require_session_owner(ctx, session_id)?;
    if session.status != SessionStatus::Designing {
        return Err("Session is not in designing state".to_string());
    }

    ctx.db.flower_order().insert(FlowerOrder {
        id: 0,
        session_id,
        orderer: ctx.sender(),
        ordered_at: ctx.timestamp,
        source,
        note,
    });

    ctx.db.flower_session().id().update(FlowerSession {
        status: SessionStatus::Ordered,
        ..session
    });

    // Award XP for ordering
    let user = require_user(ctx)?;
    let xp_award: u64 = 100;
    let new_xp = user.xp + xp_award;
    let new_level = (new_xp / 500) as u32 + 1;
    let new_orders = user.total_orders + 1;

    ctx.db.user().identity().update(User {
        xp: new_xp,
        level: new_level,
        total_orders: new_orders,
        ..user
    });

    // Check skin unlocks
    for skin in ctx.db.skin_definition().iter() {
        if new_xp >= skin.unlock_xp {
            let already_unlocked = ctx.db.user_skin().idx_uskin_owner()
                .filter(&ctx.sender())
                .any(|us| us.skin_id == skin.id);
            if !already_unlocked {
                ctx.db.user_skin().insert(UserSkin {
                    id: 0,
                    owner: ctx.sender(),
                    skin_id: skin.id,
                    unlocked_at: ctx.timestamp,
                    equipped: false,
                });
                log::info!("User unlocked skin: {}", skin.name);
            }
        }
    }

    // Unlock emotes at milestones
    let emote_milestones = vec![
        (3, EmoteKind::Sparkle),
        (10, EmoteKind::Rain),
        (25, EmoteKind::Bloom),
        (50, EmoteKind::Dance),
        (100, EmoteKind::Pollinate),
    ];
    for (threshold, emote) in emote_milestones {
        if new_orders >= threshold {
            let already_has = ctx.db.emote_unlock().iter()
                .any(|eu| eu.owner == ctx.sender() && eu.emote == emote);
            if !already_has {
                ctx.db.emote_unlock().insert(EmoteUnlock {
                    id: 0,
                    owner: ctx.sender(),
                    emote: emote.clone(),
                    unlocked_at: ctx.timestamp,
                });
                log::info!("User unlocked emote: {:?}", emote);
            }
        }
    }

    log::info!("Order placed for session {}. XP: {} → {}", session_id, user.xp, new_xp);
    Ok(())
}

#[spacetimedb::reducer]
pub fn complete_session(ctx: &ReducerContext, session_id: u64) -> Result<(), String> {
    let session = require_session_owner(ctx, session_id)?;
    ctx.db.flower_session().id().update(FlowerSession {
        status: SessionStatus::Complete,
        ..session
    });
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════
// Chat & Emotes
// ═══════════════════════════════════════════════════════════════════════════

#[spacetimedb::reducer]
pub fn send_chat(ctx: &ReducerContext, text: String) -> Result<(), String> {
    if text.is_empty() {
        return Err("Message cannot be empty".to_string());
    }
    if text.len() > 500 {
        return Err("Message too long (max 500 chars)".to_string());
    }
    ctx.db.chat_message().insert(ChatMessage {
        id: 0,
        sender: ctx.sender(),
        text,
        sent_at: ctx.timestamp,
        emote: None,
    });
    Ok(())
}

#[spacetimedb::reducer]
pub fn send_emote(ctx: &ReducerContext, emote: EmoteKind) -> Result<(), String> {
    // Verify the user owns this emote
    let has_emote = ctx.db.emote_unlock().iter()
        .any(|eu| eu.owner == ctx.sender() && eu.emote == emote);
    if !has_emote {
        return Err("You haven't unlocked this emote yet".to_string());
    }

    ctx.db.chat_message().insert(ChatMessage {
        id: 0,
        sender: ctx.sender(),
        text: String::new(),
        sent_at: ctx.timestamp,
        emote: Some(emote),
    });
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════
// Profile & Skins
// ═══════════════════════════════════════════════════════════════════════════

#[spacetimedb::reducer]
pub fn set_name(ctx: &ReducerContext, name: String) -> Result<(), String> {
    if name.is_empty() { return Err("Name cannot be empty".to_string()); }
    if name.len() > 32 { return Err("Name too long (max 32 chars)".to_string()); }
    let user = require_user(ctx)?;
    ctx.db.user().identity().update(User { name: Some(name), ..user });
    Ok(())
}

#[spacetimedb::reducer]
pub fn equip_skin(ctx: &ReducerContext, skin_id: u64) -> Result<(), String> {
    // Unequip all current skins for this user
    for us in ctx.db.user_skin().iter() {
        if us.owner == ctx.sender() && us.equipped {
            ctx.db.user_skin().id().update(UserSkin { equipped: false, ..us });
        }
    }
    // Equip the requested skin
    let target = ctx.db.user_skin().iter()
        .find(|us| us.owner == ctx.sender() && us.skin_id == skin_id)
        .ok_or_else(|| "You don't own this skin".to_string())?;
    ctx.db.user_skin().id().update(UserSkin { equipped: true, ..target });
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════
// Merge & Fitness
// ═══════════════════════════════════════════════════════════════════════════

fn arrangement_level_for_count(count: u32) -> u32 {
    match count {
        0..=1 => 1,
        2..=3 => 2,
        4..=6 => 3,
        7..=9 => 4,
        10..=19 => 5,
        20..=49 => 6,
        _ => 7,
    }
}

#[spacetimedb::reducer]
pub fn merge_sessions(
    ctx: &ReducerContext,
    session_a_id: u64,
    session_b_id: u64,
    ai_arrangement_json: String,
) -> Result<(), String> {
    // Both sessions must be owned by the caller and in Designing status
    let session_a = require_session_owner(ctx, session_a_id)?;
    let session_b = require_session_owner(ctx, session_b_id)?;

    if session_a.status != SessionStatus::Designing {
        return Err("Session A is not in designing state".to_string());
    }
    if session_b.status != SessionStatus::Designing {
        return Err("Session B is not in designing state".to_string());
    }

    // Load specs
    let spec_a = ctx.db.flower_spec().session_id().find(session_a_id)
        .ok_or_else(|| "Spec A not found".to_string())?;
    let spec_b = ctx.db.flower_spec().session_id().find(session_b_id)
        .ok_or_else(|| "Spec B not found".to_string())?;

    // Cross-breed using genetics (deterministic via ctx.rng seed)
    let seed = ctx.rng().r#gen::<u64>();
    let parent_a: flower_core::catalog::FlowerSpec = serde_json::from_str(&spec_a.spec_json)
        .map_err(|e| format!("Failed to parse spec A: {e}"))?;
    let parent_b: flower_core::catalog::FlowerSpec = serde_json::from_str(&spec_b.spec_json)
        .map_err(|e| format!("Failed to parse spec B: {e}"))?;
    let child = flower_core::genetics::cross(&parent_a, &parent_b, seed);
    let child_json = serde_json::to_string(&child)
        .map_err(|e| format!("Failed to serialize child: {e}"))?;

    // Combined stats
    let total_flowers = session_a.flower_count + session_b.flower_count;
    let new_generation = session_a.generation.max(session_b.generation) + 1;
    let new_level = arrangement_level_for_count(total_flowers);
    let mid_x = (session_a.canvas_x + session_b.canvas_x) / 2.0;
    let mid_y = (session_a.canvas_y + session_b.canvas_y) / 2.0;

    // Create child session
    let child_session = ctx.db.flower_session().insert(FlowerSession {
        id: 0,
        owner: ctx.sender(),
        created_at: ctx.timestamp,
        status: SessionStatus::Designing,
        prompt: format!("{} × {}", session_a.prompt, session_b.prompt),
        canvas_x: mid_x,
        canvas_y: mid_y,
        arrangement_level: new_level,
        flower_count: total_flowers,
        generation: new_generation,
        fitness_json: "{}".to_string(),
    });

    ctx.db.flower_spec().insert(FlowerSpec {
        session_id: child_session.id,
        spec_json: child_json,
        version: 0,
        updated_at: ctx.timestamp,
    });

    // Archive parents
    ctx.db.flower_session().id().update(FlowerSession {
        status: SessionStatus::Complete,
        ..session_a
    });
    ctx.db.flower_session().id().update(FlowerSession {
        status: SessionStatus::Complete,
        ..session_b
    });

    // Award XP for merging
    if let Some(user) = ctx.db.user().identity().find(ctx.sender()) {
        let new_xp = user.xp + 50;
        ctx.db.user().identity().update(User {
            xp: new_xp,
            level: (new_xp / 500) as u32 + 1,
            current_session_id: Some(child_session.id),
            ..user
        });
    }

    // Evaluate fitness in all active environments
    evaluate_fitness_internal(ctx, child_session.id, &child);

    log::info!(
        "Merged sessions {} + {} → {} (gen {}, {} flowers, level {})",
        session_a_id, session_b_id, child_session.id,
        new_generation, total_flowers, new_level
    );
    Ok(())
}

fn evaluate_fitness_internal(
    ctx: &ReducerContext,
    session_id: u64,
    spec: &flower_core::catalog::FlowerSpec,
) {
    let mut scores = serde_json::Map::new();

    for env_row in ctx.db.environment().iter() {
        if !env_row.is_active {
            continue;
        }
        let env: flower_core::environment::Environment = match serde_json::from_str(&env_row.config_json) {
            Ok(e) => e,
            Err(_) => continue,
        };

        let score = flower_core::fitness::evaluate(spec, &env);
        scores.insert(env_row.name.clone(), serde_json::Value::from(score));

        // Upsert fitness score
        let existing = ctx.db.fitness_score().iter()
            .find(|fs| fs.session_id == session_id && fs.environment_id == env_row.id);

        match existing {
            Some(fs) => {
                ctx.db.fitness_score().id().update(FitnessScore {
                    score,
                    evaluated_at: ctx.timestamp,
                    ..fs
                });
            }
            None => {
                ctx.db.fitness_score().insert(FitnessScore {
                    id: 0,
                    session_id,
                    environment_id: env_row.id,
                    score,
                    generation: 0,
                    evaluated_at: ctx.timestamp,
                });
            }
        }

        // Update leaderboard if score qualifies (top 50)
        let lb_entries: Vec<LeaderboardEntry> = ctx.db.leaderboard_entry()
            .idx_lb_env()
            .filter(&env_row.id)
            .collect();

        let qualifies = lb_entries.len() < 50
            || lb_entries.iter().any(|e| score > e.score);

        if qualifies {
            // Remove existing entry for this session if any
            if let Some(existing_entry) = lb_entries.iter().find(|e| e.session_id == session_id) {
                ctx.db.leaderboard_entry().id().delete(existing_entry.id);
            } else if lb_entries.len() >= 50 {
                // Remove lowest scoring entry
                if let Some(lowest) = lb_entries.iter().min_by(|a, b| a.score.partial_cmp(&b.score).unwrap_or(std::cmp::Ordering::Equal)) {
                    ctx.db.leaderboard_entry().id().delete(lowest.id);
                }
            }

            ctx.db.leaderboard_entry().insert(LeaderboardEntry {
                id: 0,
                environment_id: env_row.id,
                session_id,
                owner: ctx.sender(),
                score,
                rank: 0, // computed on read
                flower_name: spec.name.clone(),
                updated_at: ctx.timestamp,
            });
        }
    }

    // Update fitness_json on the session
    if let Some(session) = ctx.db.flower_session().id().find(session_id) {
        let fitness_str = serde_json::Value::Object(scores).to_string();
        ctx.db.flower_session().id().update(FlowerSession {
            fitness_json: fitness_str,
            ..session
        });
    }
}

#[spacetimedb::reducer]
pub fn evaluate_session_fitness(ctx: &ReducerContext, session_id: u64) -> Result<(), String> {
    let _session = require_session_owner(ctx, session_id)?;
    let spec_row = ctx.db.flower_spec().session_id().find(session_id)
        .ok_or_else(|| "Spec not found".to_string())?;
    let spec: flower_core::catalog::FlowerSpec = serde_json::from_str(&spec_row.spec_json)
        .map_err(|e| format!("Failed to parse spec: {e}"))?;

    evaluate_fitness_internal(ctx, session_id, &spec);
    Ok(())
}
