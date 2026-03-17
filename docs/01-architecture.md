# Architecture

## What This Is

flower-maker is an interactive marketing site for a programmatic flowers ordering API. The real product is a flowers API for humans and AI agents to order flowers programmatically. This app is the experience layer.

## System Overview

```
Browser
├── Homepage Grid (PixiJS)
│   ├── Virtualized grid of ALL user zones
│   ├── Live-updating via SpacetimeDB subscriptions
│   ├── Your zone centered + highlighted
│   └── Click to enter designer
│
├── Designer (React overlay)
│   ├── Left: Template picker + AI chat
│   ├── Center: PixiJS canvas with WASM physics
│   ├── Right: Orders, parts editor, fitness, leaderboard, chat
│   └── Bottom: Session selector bar
│
├── SpacetimeDB TS SDK (WebSocket)
│   ├── useTable() hooks for reactive state
│   └── onInsert/onUpdate → WASM bridge
│
└── WASM Module (Rust, rapier2d)
    ├── Single-zone physics (your designer only)
    ├── Collision detection → merge events
    └── Bloom-in / wilt-out animations

Server
├── SpacetimeDB Module (Rust → WASM)
│   ├── 12 tables: users, sessions, specs, orders, environments,
│   │   fitness scores, leaderboards, chat, skins, emotes
│   ├── 20+ reducers: CRUD, merge, fitness, gamification
│   └── genetics::cross() for deterministic breeding
│
└── Hono API (Bun)
    ├── POST /api/flower/generate (AI streams FlowerSpec)
    ├── POST /api/flower/combine (AI describes merge result)
    └── POST /api/flower/order (JSON payload — the real product)
```

## Key Design Choices

**Per-player zones, not shared physics.** Each player has their own zone. No cross-player collision. The multiplayer aspect is observation — everyone sees everyone else's zones on the homepage grid.

**rapier2d runs only in your designer.** The homepage grid is pure rendering from SpacetimeDB data. Physics only matters when you're dragging flowers together to merge.

**AI decides merges, genetics scores fitness.** When two flowers collide, the AI generates what the combination becomes (narrative, adornments). The genetics system (`cross()`) breeds the child FlowerSpec deterministically. The fitness system scores the child against abstract environments for leaderboards.

**JSON order payloads are the product.** When you place an order, the output is a structured JSON payload demonstrating what a programmatic flower order looks like. This is the bridge to the flowers API.

## Data Flow: Creating a Flower

1. User types description in AI chat
2. POST /api/flower/generate streams a FlowerSpec from Claude
3. Client calls `create_session` reducer with the spec
4. SpacetimeDB creates FlowerSession + FlowerSpec rows
5. All clients receive the update via subscription
6. Homepage grid shows a new zone thumbnail
7. In the designer, WASM adds a physics body

## Data Flow: Merging

1. User drags flower A into flower B in their designer
2. rapier2d detects collision (500ms threshold)
3. Client calls POST /api/flower/combine with both specs
4. AI generates arrangement description
5. Client calls `merge_sessions` reducer
6. Server: genetics::cross() creates child spec, archives parents
7. Server: evaluates fitness in all environments, updates leaderboard
8. All clients see: old flowers wilt out, new arrangement blooms in

## Shared Rust Crate

`flower-core` compiles into both the SpacetimeDB module and the browser WASM:

- `catalog.rs` — FlowerSpec type system (451 lines, 30+ enums)
- `genetics.rs` — deterministic crossbreeding
- `fitness.rs` — score FlowerSpec against Environment
- `environment.rs` — 6 abstract environments (tropical, alpine, etc.)
- `animation.rs` — bloom-in / wilt-out state machine
- `templates.rs` — 50+ real flower types with default FlowerSpec values
- `physics.rs` — world-level wind and light
