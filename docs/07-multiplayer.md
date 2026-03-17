# Multiplayer

## How It Works

Every connected browser sees the same flowers on the same canvas. This is achieved through SpacetimeDB's subscription model — every client subscribes to the same tables and receives the same updates.

```
Client A creates a flower
       │
       ▼
SpacetimeDB reducer inserts FlowerSession row
       │
       ▼
SpacetimeDB pushes TransactionUpdate to ALL subscribed clients
       │
       ▼
Client B receives onInsert(new_session)
       │
       ▼
Client B's bridge.ts calls wasm.add_flower(...)
       │
       ▼
Client B's physics simulation adds a rigid body
       │
       ▼
Client B's PixiJS renders the flower on their canvas
```

Latency from creation to rendering on other clients: ~50-100ms (one WebSocket message + one physics tick + one render frame).

## What's Shared vs. Local

| Data | Shared (SpacetimeDB) | Local (per client) |
|------|---------------------|-------------------|
| Which flowers exist | Yes | — |
| Flower parts and properties | Yes | — |
| Canvas position (logical) | Yes | — |
| Physics positions (per-frame) | — | Yes |
| Viewport position | — | Yes |
| Merge detection | — | Yes (initiating client) |
| Arrangement descriptions | Yes | — |
| Orders | Yes | — |

### Why Physics Is Local

Each client runs its own rapier2d simulation. Physics positions are **not** synced through SpacetimeDB because:

1. 60fps × N flowers × all clients = too much network traffic
2. Physics is deterministic — given the same inputs, all clients converge
3. Minor drift between clients is invisible (flowers are decorative, not competitive)

The logical position (`canvas_x`, `canvas_y` on FlowerSession) is synced through SpacetimeDB and acts as the "spawn point." Each client's physics simulation takes over from there. Flowers drift slightly differently on each client's screen, but they're always in approximately the same area.

### Why Merge Detection Is Local

The first client to detect a collision and call `merge_sessions` wins. SpacetimeDB's transactional reducers prevent double-merges. Since physics is local, the exact moment of collision varies by a few frames between clients — this is fine because the result is the same.

## Subscriptions

The client subscribes to all public tables on connect:

```typescript
conn.subscriptionBuilder()
  .onApplied((ctx) => {
    // Initial snapshot loaded — render all existing flowers
    for (const session of ctx.db.flower_session.iter()) {
      wasm.add_flower(session.id, session.canvas_x, session.canvas_y, ...);
    }
  })
  .subscribe([
    "SELECT * FROM part_definition",
    "SELECT * FROM flower_session WHERE status != 'archived'",
    "SELECT * FROM flower_instance",
    "SELECT * FROM flower_order",
  ]);
```

**Filtered subscription**: Archived sessions are excluded from the subscription query. They're consumed by merges and no longer need to render. This keeps the subscription payload bounded.

## Scaling

### How Many Players?

SpacetimeDB handles the state sync. The bottleneck is the client:

- **500 visible flowers**: comfortable on mid-range hardware
- **2000 total flowers** (with viewport culling): fine, most are sleeping
- **10,000 total flowers**: physics simulation starts to strain, but with aggressive sleeping it works

The practical limit isn't performance but visual density. Beyond ~200 flowers in view, the canvas becomes a sea of sprites. LOD rendering (colored circles instead of full sprites at high zoom) keeps it readable.

### Partitioning (Future)

If the game grows beyond what a single SpacetimeDB instance can handle:

- **Spatial partitioning**: divide the infinite canvas into regions, each served by a different SpacetimeDB module
- **Interest management**: subscribe only to flowers near the player's viewport
- Not needed until thousands of concurrent players

## Identity

SpacetimeDB assigns a unique `Identity` to each connection. The client persists the auth token in localStorage so reconnecting preserves identity.

```typescript
const savedToken = localStorage.getItem('spacetimedb_token');

DbConnection.builder()
  .withToken(savedToken)
  .onConnect((ctx, identity, token) => {
    localStorage.setItem('spacetimedb_token', token);
  })
  .build();
```

No username/password auth. Identity is anonymous by default. The game doesn't need accounts — you're just a flower-maker.

## Presence

The SpacetimeDB lifecycle reducers track who's online:

```rust
#[reducer(client_connected)]
fn client_connected(ctx: &ReducerContext) {
    // Could insert into a "connected_users" table
    // Used to show "12 people making flowers right now"
}

#[reducer(client_disconnected)]
fn client_disconnected(ctx: &ReducerContext) {
    // Remove from connected_users
    // Their flowers stay on the canvas
}
```

Flowers persist after disconnect. When you reconnect, your flowers are still there, right where you left them. Other players may have merged with them while you were gone.
