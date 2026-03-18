use spacetimedb::{Identity, ReducerContext, SpacetimeType, Table, Timestamp};
use spacetimedb::rand::Rng;

// ═══════════════════════════════════════════════════════════════════════════
// Custom Types
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Clone, Debug, PartialEq, SpacetimeType)]
pub enum SessionStatus { Designing, Ordered, Complete }

#[derive(Clone, Debug, PartialEq, SpacetimeType)]
pub enum OrderSource { Human, Agent }

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

// ── Chat ──────────────────────────────────────────────────────────────────

#[spacetimedb::table(accessor = chat_message, public)]
pub struct ChatMessage {
    #[primary_key]
    #[auto_inc]
    id: u64,
    sender: Identity,
    text: String,
    sent_at: Timestamp,
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
pub fn init(_ctx: &ReducerContext) {
    log::info!("flower-maker module initialized");
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
                joined_at: ctx.timestamp,
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

    let user = require_user(ctx)?;
    ctx.db.user().identity().update(User {
        total_orders: user.total_orders + 1,
        ..user
    });

    log::info!("Order placed for session {}", session_id);
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
    });
    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════════
// Profile
// ═══════════════════════════════════════════════════════════════════════════

#[spacetimedb::reducer]
pub fn set_name(ctx: &ReducerContext, name: String) -> Result<(), String> {
    if name.is_empty() { return Err("Name cannot be empty".to_string()); }
    if name.len() > 32 { return Err("Name too long (max 32 chars)".to_string()); }
    let user = require_user(ctx)?;
    ctx.db.user().identity().update(User { name: Some(name), ..user });
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
    });

    ctx.db.flower_spec().insert(FlowerSpec {
        session_id: child_session.id,
        spec_json: child_json,
        version: 0,
        updated_at: ctx.timestamp,
    });

    // Store AI arrangement as a part override on the child
    if !ai_arrangement_json.is_empty() {
        ctx.db.part_override().insert(FlowerPartOverride {
            id: 0,
            session_id: child_session.id,
            part_path: "arrangement".to_string(),
            override_json: ai_arrangement_json,
            forked_from: format!("merge:{}+{}", session_a_id, session_b_id),
            created_at: ctx.timestamp,
        });
    }

    // Archive parents
    ctx.db.flower_session().id().update(FlowerSession {
        status: SessionStatus::Complete,
        ..session_a
    });
    ctx.db.flower_session().id().update(FlowerSession {
        status: SessionStatus::Complete,
        ..session_b
    });

    if let Some(user) = ctx.db.user().identity().find(ctx.sender()) {
        ctx.db.user().identity().update(User {
            current_session_id: Some(child_session.id),
            ..user
        });
    }

    log::info!(
        "Merged sessions {} + {} → {} (gen {}, {} flowers, level {})",
        session_a_id, session_b_id, child_session.id,
        new_generation, total_flowers, new_level
    );
    Ok(())
}

