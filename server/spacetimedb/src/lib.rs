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
pub fn update_position(ctx: &ReducerContext, session_id: u64, x: f64, y: f64) -> Result<(), String> {
    let session = require_session_owner(ctx, session_id)?;
    ctx.db.flower_session().id().update(FlowerSession {
        canvas_x: x,
        canvas_y: y,
        ..session
    });
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

#[spacetimedb::reducer]
pub fn remove_constituent(ctx: &ReducerContext, session_id: u64, constituent_index: u32) -> Result<(), String> {
    let session = require_session_owner(ctx, session_id)?;

    // Gather all constituent overrides for this session, sorted by index
    let mut constituents: Vec<(u64, u32)> = ctx.db.part_override().iter()
        .filter(|o| o.session_id == session_id && o.part_path.starts_with("constituent:"))
        .filter_map(|o| {
            let idx: u32 = o.part_path.strip_prefix("constituent:")?.parse().ok()?;
            Some((o.id, idx))
        })
        .collect();
    constituents.sort_by_key(|&(_, idx)| idx);

    if constituents.len() <= 1 {
        return Err("Cannot remove the last flower from a session".to_string());
    }

    // Find the override to delete
    let target = constituents.iter()
        .find(|&&(_, idx)| idx == constituent_index)
        .ok_or_else(|| format!("Constituent {} not found", constituent_index))?;
    let target_id = target.0;

    ctx.db.part_override().id().delete(target_id);

    // Re-index remaining constituents to be contiguous (0, 1, 2, ...)
    let remaining: Vec<(u64, String)> = ctx.db.part_override().iter()
        .filter(|o| o.session_id == session_id && o.part_path.starts_with("constituent:"))
        .map(|o| (o.id, o.part_path.clone()))
        .collect();

    // Sort by original index to preserve order
    let mut remaining_sorted: Vec<(u64, u32)> = remaining.iter()
        .filter_map(|(id, path)| {
            let idx: u32 = path.strip_prefix("constituent:")?.parse().ok()?;
            Some((*id, idx))
        })
        .collect();
    remaining_sorted.sort_by_key(|&(_, idx)| idx);

    for (new_idx, &(oid, _)) in remaining_sorted.iter().enumerate() {
        let existing = ctx.db.part_override().id().find(oid)
            .ok_or_else(|| "Override disappeared".to_string())?;
        let new_path = format!("constituent:{new_idx}");
        if existing.part_path != new_path {
            ctx.db.part_override().id().update(FlowerPartOverride {
                part_path: new_path,
                ..existing
            });
        }
    }

    // Update session flower count and arrangement level
    let new_count = remaining_sorted.len() as u32;
    let new_level = arrangement_level_for_count(new_count);
    ctx.db.flower_session().id().update(FlowerSession {
        flower_count: new_count,
        arrangement_level: new_level,
        ..session
    });

    log::info!("Removed constituent {} from session {} ({} remaining)", constituent_index, session_id, new_count);
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
// Identity Linking (anonymous → authenticated)
// ═══════════════════════════════════════════════════════════════════════════

/// Transfer all data from an anonymous identity to the caller's authenticated identity.
/// The caller must provide the anonymous token as proof of ownership.
#[spacetimedb::reducer]
pub fn claim_anonymous_identity(ctx: &ReducerContext, anon_token: String) -> Result<(), String> {
    // Decode the anonymous identity from the token
    // SpacetimeDB tokens are opaque, but the anonymous identity hex is passed by the client
    let anon_identity = Identity::from_hex(&anon_token)
        .map_err(|_| "Invalid identity hex".to_string())?;

    let caller = ctx.sender();
    if anon_identity == caller {
        return Err("Already using this identity".to_string());
    }

    // The anonymous user must exist
    let anon_user = ctx.db.user().identity().find(anon_identity)
        .ok_or_else(|| "Anonymous identity not found".to_string())?;

    // Transfer flower sessions
    let sessions_to_transfer: Vec<FlowerSession> = ctx.db.flower_session().iter()
        .filter(|s| s.owner == anon_identity)
        .collect();
    for session in sessions_to_transfer {
        ctx.db.flower_session().id().update(FlowerSession {
            owner: caller,
            ..session
        });
    }

    // Transfer flower orders
    let orders_to_transfer: Vec<FlowerOrder> = ctx.db.flower_order().iter()
        .filter(|o| o.orderer == anon_identity)
        .collect();
    for order in orders_to_transfer {
        ctx.db.flower_order().id().update(FlowerOrder {
            orderer: caller,
            ..order
        });
    }

    // Transfer chat messages
    let messages_to_transfer: Vec<ChatMessage> = ctx.db.chat_message().iter()
        .filter(|m| m.sender == anon_identity)
        .collect();
    for msg in messages_to_transfer {
        ctx.db.chat_message().id().update(ChatMessage {
            sender: caller,
            ..msg
        });
    }

    // Merge user record: carry over name, stats, and current session
    let auth_user = ctx.db.user().identity().find(caller);
    match auth_user {
        Some(existing) => {
            ctx.db.user().identity().update(User {
                name: existing.name.or(anon_user.name),
                total_orders: existing.total_orders + anon_user.total_orders,
                current_session_id: anon_user.current_session_id.or(existing.current_session_id),
                ..existing
            });
        }
        None => {
            ctx.db.user().insert(User {
                identity: caller,
                name: anon_user.name,
                online: true,
                current_session_id: anon_user.current_session_id,
                total_orders: anon_user.total_orders,
                joined_at: anon_user.joined_at,
            });
        }
    }

    // Delete the anonymous user row
    ctx.db.user().identity().delete(anon_identity);

    log::info!("Claimed anonymous identity {:?} → {:?}", anon_identity, caller);
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
// Delete & Split
// ═══════════════════════════════════════════════════════════════════════════

/// Cascade-delete all data referencing a session_id.
/// Every table with a session_id column must be handled here.
/// When adding a new table that references session_id, add its cleanup below.
fn cascade_delete_session_data(ctx: &ReducerContext, session_id: u64) {
    // part_override → session_id
    let override_ids: Vec<u64> = ctx.db.part_override().iter()
        .filter(|o| o.session_id == session_id)
        .map(|o| o.id)
        .collect();
    for oid in override_ids {
        ctx.db.part_override().id().delete(oid);
    }

    // flower_spec → session_id (primary key)
    ctx.db.flower_spec().session_id().delete(session_id);

    // flower_order → session_id
    let order_ids: Vec<u64> = ctx.db.flower_order().iter()
        .filter(|o| o.session_id == session_id)
        .map(|o| o.id)
        .collect();
    for oid in order_ids {
        ctx.db.flower_order().id().delete(oid);
    }
}

#[spacetimedb::reducer]
pub fn delete_session(ctx: &ReducerContext, session_id: u64) -> Result<(), String> {
    let session = require_session_owner(ctx, session_id)?;

    if session.status == SessionStatus::Ordered {
        return Err("Cannot delete an ordered session".to_string());
    }

    cascade_delete_session_data(ctx, session_id);

    // Clear user's current_session_id if it points here
    if let Some(user) = ctx.db.user().identity().find(ctx.sender()) {
        if user.current_session_id == Some(session_id) {
            ctx.db.user().identity().update(User {
                current_session_id: None,
                ..user
            });
        }
    }

    // Delete the session itself
    ctx.db.flower_session().id().delete(session_id);

    log::info!("Deleted session {}", session_id);
    Ok(())
}

#[spacetimedb::reducer]
pub fn split_constituent(ctx: &ReducerContext, session_id: u64, constituent_index: u32) -> Result<(), String> {
    let session = require_session_owner(ctx, session_id)?;

    if session.status != SessionStatus::Designing {
        return Err("Session is not in designing state".to_string());
    }

    // Gather all constituent overrides
    let mut constituents: Vec<(u64, u32, String, String)> = ctx.db.part_override().iter()
        .filter(|o| o.session_id == session_id && o.part_path.starts_with("constituent:"))
        .filter_map(|o| {
            let idx: u32 = o.part_path.strip_prefix("constituent:")?.parse().ok()?;
            Some((o.id, idx, o.override_json.clone(), o.forked_from.clone()))
        })
        .collect();
    constituents.sort_by_key(|&(_, idx, _, _)| idx);

    if constituents.len() <= 1 {
        return Err("Cannot split a single flower".to_string());
    }

    // Find the constituent to extract
    let (target_id, _, ref spec_json, _) = *constituents.iter()
        .find(|&&(_, idx, _, _)| idx == constituent_index)
        .ok_or_else(|| format!("Constituent {} not found", constituent_index))?;

    let extracted_spec = spec_json.clone();

    // Random canvas position for the new session
    let x = (ctx.rng().r#gen::<u32>() % 10000) as f64 / 100.0;
    let y = (ctx.rng().r#gen::<u32>() % 10000) as f64 / 100.0;

    // Create new standalone session with the extracted spec
    let new_session = ctx.db.flower_session().insert(FlowerSession {
        id: 0,
        owner: ctx.sender(),
        created_at: ctx.timestamp,
        status: SessionStatus::Designing,
        prompt: format!("split from #{}", session_id),
        canvas_x: x,
        canvas_y: y,
        arrangement_level: 1,
        flower_count: 1,
        generation: 0,
    });

    ctx.db.flower_spec().insert(FlowerSpec {
        session_id: new_session.id,
        spec_json: extracted_spec,
        version: 0,
        updated_at: ctx.timestamp,
    });

    // Remove the constituent from the original session
    ctx.db.part_override().id().delete(target_id);

    // Re-index remaining constituents
    let mut remaining: Vec<(u64, u32)> = ctx.db.part_override().iter()
        .filter(|o| o.session_id == session_id && o.part_path.starts_with("constituent:"))
        .filter_map(|o| {
            let idx: u32 = o.part_path.strip_prefix("constituent:")?.parse().ok()?;
            Some((o.id, idx))
        })
        .collect();
    remaining.sort_by_key(|&(_, idx)| idx);

    for (new_idx, &(oid, _)) in remaining.iter().enumerate() {
        let existing = ctx.db.part_override().id().find(oid)
            .ok_or_else(|| "Override disappeared".to_string())?;
        let new_path = format!("constituent:{new_idx}");
        if existing.part_path != new_path {
            ctx.db.part_override().id().update(FlowerPartOverride {
                part_path: new_path,
                ..existing
            });
        }
    }

    // Update original session's flower count and arrangement level
    let new_count = remaining.len() as u32;
    let new_level = arrangement_level_for_count(new_count);
    ctx.db.flower_session().id().update(FlowerSession {
        flower_count: new_count,
        arrangement_level: new_level,
        ..session
    });

    log::info!(
        "Split constituent {} from session {} → new session {} ({} remaining)",
        constituent_index, session_id, new_session.id, new_count
    );
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

    // Clone child_json before moving into FlowerSpec — needed for constituent override below
    let child_json_for_constituent = child_json.clone();

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

    // Preserve constituent flower specs so arrangements render all flowers.
    // constituent:0 = hero (crossed genetics child), then parent constituents follow.
    let mut constituent_idx: u32 = 0;

    // Hero flower is constituent:0
    ctx.db.part_override().insert(FlowerPartOverride {
        id: 0,
        session_id: child_session.id,
        part_path: format!("constituent:{constituent_idx}"),
        override_json: child_json_for_constituent,
        forked_from: format!("cross:{}+{}", session_a_id, session_b_id),
        created_at: ctx.timestamp,
    });
    constituent_idx += 1;

    // Collect constituents from each parent (propagate if parent is already an arrangement)
    for parent_id in [session_a_id, session_b_id] {
        let parent_constituents: Vec<String> = ctx.db.part_override().iter()
            .filter(|o| o.session_id == parent_id && o.part_path.starts_with("constituent:"))
            .map(|o| o.override_json.clone())
            .collect();

        if parent_constituents.is_empty() {
            // Parent is a single flower — use its spec directly
            let parent_spec = ctx.db.flower_spec().session_id().find(parent_id);
            if let Some(ps) = parent_spec {
                ctx.db.part_override().insert(FlowerPartOverride {
                    id: 0,
                    session_id: child_session.id,
                    part_path: format!("constituent:{constituent_idx}"),
                    override_json: ps.spec_json.clone(),
                    forked_from: format!("parent:{parent_id}"),
                    created_at: ctx.timestamp,
                });
                constituent_idx += 1;
            }
        } else {
            // Parent is an arrangement — propagate all its constituents
            for spec_json in parent_constituents {
                ctx.db.part_override().insert(FlowerPartOverride {
                    id: 0,
                    session_id: child_session.id,
                    part_path: format!("constituent:{constituent_idx}"),
                    override_json: spec_json,
                    forked_from: format!("parent:{parent_id}"),
                    created_at: ctx.timestamp,
                });
                constituent_idx += 1;
            }
        }
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

