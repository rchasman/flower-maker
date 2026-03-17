# Architecture

## System Overview

flower-maker is four processes that communicate through two channels:

```
┌─────────────────────────────────────────────────────────────┐
│ Browser (per user)                                           │
│                                                               │
│   React UI ◄──── useTable() ────► SpacetimeDB TS SDK         │
│      │                                  │                     │
│      │                                  │ onInsert/onUpdate   │
│      │                                  ▼                     │
│      │                            WASM Module                 │
│      │                          (rapier2d physics)            │
│      │                                  │                     │
│      │                                  │ SharedArrayBuffer   │
│      │                                  ▼                     │
│      └──────────────────────►  PixiJS Canvas                  │
│                                                               │
└──────────────────────┬────────────────────────────────────────┘
                       │ WebSocket
                       ▼
              SpacetimeDB Server ◄────── Hono API (AI calls)
```

**Channel 1: SpacetimeDB WebSocket** — all game state flows here. Table subscriptions push every flower session, part definition, and order to every connected client in real time. Reducers are the only way to mutate state.

**Channel 2: SharedArrayBuffer** — the WASM physics simulation writes sprite transforms (x, y, rotation, scale, sprite_id, color, alpha) into a double-buffered SharedArrayBuffer. PixiJS reads it every frame. No serialization, no copying — just typed array reads.

## Why This Split

The naive approach would be: SpacetimeDB pushes positions, PixiJS renders them. But that means:
- 60fps × N flowers × network round trips = unplayable latency
- SpacetimeDB would need to run physics server-side for every client's viewport

Instead, SpacetimeDB handles **logical state** (which flowers exist, what parts they have, who owns them) and the client handles **visual state** (where they are on screen, how they're moving, collision detection). SpacetimeDB is the source of truth for what exists. WASM is the source of truth for where it is right now.

When a merge happens (detected client-side by WASM), the client calls a SpacetimeDB reducer to make it official. All other clients then receive the merge as a table update.

## Process Responsibilities

### SpacetimeDB Server (Rust → WASM)

Runs inside SpacetimeDB's WASM sandbox. No filesystem, no network, no timers.

- **Tables**: PartDefinition, FlowerSession, FlowerInstance, FlowerOrder
- **Reducers**: CRUD operations, merge logic, catalog seeding
- **Validation**: only the owner can modify their session, only valid part IDs, etc.
- **Lifecycle**: track connected/disconnected clients

### WASM Module (Rust → wasm-bindgen)

Runs in the browser's WASM runtime. Has access to web APIs via web-sys.

- **rapier2d world**: one rigid body per flower session, collision groups
- **Collision detection**: when two flowers overlap for >500ms → emit merge event
- **Buffer writer**: every tick, writes sprite transforms to SharedArrayBuffer
- **Viewport culling**: sleeps physics bodies outside the visible area

### PixiJS Renderer

Pure rendering layer. No game logic.

- Reads SharedArrayBuffer positions every frame
- Groups sprites by texture atlas page for instanced drawing
- Manages sprite containers (flower → parts hierarchy)
- Handles viewport pan/zoom/scroll
- Plays merge particle effects

### React UI

Standard React over the canvas.

- SpacetimeDB `useTable()` hooks for reactive data
- AI chat panel (streams flower specs)
- Part catalog browser with fork/edit
- Flower designer (assemble from parts)
- Order flow and live order feed

### Hono API (Bun)

Stateless AI proxy. No database access.

- `POST /api/flower/generate` — streams a new flower spec from an LLM
- `POST /api/flower/combine` — generates what a merge should become
- Uses Vercel AI SDK with AI Gateway for model routing

## Data Flow: Creating a Flower

```
1. User describes flower in AI chat
2. React calls POST /api/flower/generate
3. Hono streams structured FlowerSpec via AI SDK streamText
4. React receives spec, calls SpacetimeDB reducer: create_session(spec)
5. SpacetimeDB creates FlowerSession + FlowerInstance rows
6. All clients receive onInsert callback
7. Each client's bridge.ts calls wasm.add_flower(id, x, y, sprite_id)
8. WASM creates rapier2d rigid body
9. Next physics tick: WASM writes position to SharedArrayBuffer
10. Next render frame: PixiJS reads buffer, creates sprite, draws it
```

Time from reducer commit to pixel on every client's screen: ~50ms (one SpacetimeDB subscription update + one physics tick + one render frame).

## Data Flow: Merging Flowers

```
1. WASM detects collision between flower A and flower B (overlap >500ms)
2. wasm.get_merge_events() returns [{a: 42, b: 17}]
3. JS game loop calls handleMerge(42, 17)
4. handleMerge fetches flower data from SpacetimeDB local cache
5. Calls POST /api/flower/combine with both flowers' part lists
6. AI generates arrangement description + adornments
7. JS calls SpacetimeDB reducer: merge_sessions(42, 17, arrangement_json)
8. Reducer creates new combined session, archives originals
9. All clients receive: onDelete(42), onDelete(17), onInsert(new_session)
10. WASM removes old bodies, adds new combined body
11. PixiJS plays merge particle effect at collision point
12. New arrangement sprite appears
```

Only the client that detected the collision initiates the merge. If two clients detect the same collision simultaneously, SpacetimeDB's transactional reducers ensure only one merge succeeds (the second will fail because the original sessions are already archived).

## Shared Rust Crate: flower-core

The `flower-core` crate is compiled to both targets:

```
flower-core (rlib)
├── parts.rs        ─── compiled into ──→ server/spacetimedb (cdylib, WASM for SpacetimeDB)
├── catalog.rs      ─── compiled into ──→ crates/client-wasm (cdylib, WASM for browser)
├── combination.rs
└── physics.rs

Feature flags:
  "spacetimedb" → adds SpacetimeDB derives (used by server)
  "wasm"        → adds wasm-bindgen derives (used by client-wasm)
```

Same types, same combination logic, different framework annotations. The server uses flower-core to validate merges. The client uses it to predict merges locally.
