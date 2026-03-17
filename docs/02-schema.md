# SpacetimeDB Schema

## Tables

### PartDefinition

The building blocks. Every flower is assembled from parts. Standard parts ship with the game. Users can fork any part to create a personal variant.

```rust
#[table(name = part_definition, public)]
pub struct PartDefinition {
    #[primary_key]
    #[auto_inc]
    id: u64,

    parent_id: Option<u64>,       // None = original, Some(id) = forked from
    author: Identity,              // who created or forked this
    kind: String,                  // "petal", "stem", "leaf", "wrap", "ribbon", "vase"
    flower_type: String,           // "rose", "sunflower", "hydrangea", etc.
    name: String,                  // human-readable name
    visual_json: String,           // { sprite_id, colors, scale, opacity }
    physics_json: String,          // { mass, friction, restitution, drag }
    is_standard: bool,             // true = shipped with the game
    fork_count: u32,               // how many times this has been forked
    created_at: Timestamp,
}
```

**Fork chain**: When a user modifies a standard rose petal, a new PartDefinition is created with `parent_id` pointing to the original. The original's `fork_count` increments. Users can browse forks of any part to discover community variants.

### FlowerSession

A user's active flower-building workspace. Each session is one "flower" on the shared canvas — which may be a single stem or a 50-flower installation depending on how many merges it has absorbed.

```rust
#[table(name = flower_session, public)]
pub struct FlowerSession {
    #[primary_key]
    #[auto_inc]
    id: u64,

    owner: Identity,
    name: String,
    seed_prompt: String,           // the AI prompt that generated this flower
    status: String,                // "designing" | "ordered" | "archived"
    canvas_x: f64,                 // position on the shared infinite canvas
    canvas_y: f64,
    arrangement_level: u32,        // 1=stem, 3=group, 10=bouquet, etc.
    arrangement_json: String,      // AI-generated description of the arrangement
    created_at: Timestamp,
}
```

**Status lifecycle**:
- `"designing"` — active on the canvas, can merge with other flowers
- `"ordered"` — frozen, visible on canvas as a completed order
- `"archived"` — consumed by a merge, no longer visible

### FlowerInstance

An individual flower within a session. A single-stem session has one instance. A bouquet session has 10+.

```rust
#[table(name = flower_instance, public)]
pub struct FlowerInstance {
    #[primary_key]
    #[auto_inc]
    id: u64,

    session_id: u64,               // which FlowerSession this belongs to
    part_def_id: u64,              // which PartDefinition (standard or forked)
    override_json: Option<String>, // per-instance tweaks (color shift, scale)
    local_x: f64,                  // position relative to session origin
    local_y: f64,
    rotation: f64,
}
```

### FlowerOrder

An order placed against a flower session. Can be placed by a human user or an AI agent.

```rust
#[table(name = flower_order, public)]
pub struct FlowerOrder {
    #[primary_key]
    #[auto_inc]
    id: u64,

    session_id: u64,
    orderer: Identity,
    status: String,                // "pending" | "confirmed" | "delivered"
    price_cents: u64,
    arrangement_snapshot: String,  // frozen copy of arrangement_json at order time
    created_at: Timestamp,
}
```

## Reducers

### Catalog Management

```
seed_catalog()
  → Populates 50+ standard PartDefinitions on first publish
  → Called from init() reducer

fork_part(part_id: u64, changes_json: String)
  → Creates new PartDefinition with parent_id = part_id
  → Increments original's fork_count
  → Author = ctx.sender
```

### Session Lifecycle

```
create_session(name, seed_prompt, canvas_x, canvas_y)
  → Creates FlowerSession with status = "designing"
  → Owner = ctx.sender

add_flower(session_id, part_def_id, local_x, local_y, rotation)
  → Inserts FlowerInstance
  → Validates: session owner == ctx.sender, part exists

remove_flower(session_id, flower_id)
  → Deletes FlowerInstance
  → Validates: session owner == ctx.sender
```

### The Merge Reducer

The most important reducer. Combines two sessions into one.

```
merge_sessions(session_a_id, session_b_id, arrangement_json)
  → Validates: both sessions exist, both are "designing"
  → Validates: caller owns at least one of them
  → Creates new FlowerSession with:
      - All FlowerInstances from both sessions (re-parented)
      - arrangement_level = total flower count mapped to level
      - arrangement_json = the AI-generated description
      - canvas position = midpoint of the two originals
  → Sets both original sessions to status = "archived"
  → Returns: new session ID (via the inserted row)
```

### Orders

```
place_order(session_id, price_cents)
  → Creates FlowerOrder with status = "pending"
  → Sets FlowerSession status = "ordered"
  → Snapshots arrangement_json into arrangement_snapshot

update_order_status(order_id, new_status)
  → Updates FlowerOrder status
  → Only callable by system/admin identity
```

## Relationships

```
PartDefinition ──parent_id──► PartDefinition (fork chain)
       │
       │ part_def_id
       ▼
FlowerInstance ──session_id──► FlowerSession
                                     │
                                     │ session_id
                                     ▼
                               FlowerOrder
```

## Indexes

SpacetimeDB auto-indexes primary keys. Additional indexes needed:

- `FlowerSession`: index on `owner` (find my sessions)
- `FlowerSession`: index on `status` (find active/designing sessions)
- `FlowerInstance`: index on `session_id` (get all flowers in a session)
- `PartDefinition`: index on `flower_type` (browse catalog by type)
- `PartDefinition`: index on `parent_id` (find all forks of a part)
- `FlowerOrder`: index on `session_id` (find orders for a session)
