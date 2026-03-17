# Development Guide

## Prerequisites

- **Rust** (latest stable) with `wasm32-unknown-unknown` target
- **Bun** (v1.3+)
- **SpacetimeDB CLI** (v2.0+)
- **wasm-pack** (v0.13+)

### Install Prerequisites

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Bun
curl -fsSL https://bun.sh/install | bash

# SpacetimeDB CLI
curl -sSf https://install.spacetimedb.com | bash

# wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

## Local Development

### 1. Start SpacetimeDB

```bash
spacetime start
```

Runs a local SpacetimeDB instance on `http://localhost:3000`.

### 2. Publish the Server Module

```bash
spacetime publish flower-maker --module-path server/spacetimedb
```

This compiles the Rust module to WASM and deploys it to the local SpacetimeDB instance. The `init` reducer runs automatically, seeding the part catalog.

To reset the database and republish:

```bash
spacetime publish flower-maker --clear-database -y --module-path server/spacetimedb
```

### 3. Generate TypeScript Bindings

```bash
spacetime generate --lang typescript \
  --out-dir client/src/spacetime/module_bindings \
  --module-path server/spacetimedb
```

This generates TypeScript types and connection helpers from the SpacetimeDB module schema. **Regenerate every time the schema changes.**

### 4. Build the WASM Client Module

```bash
cd crates/client-wasm
wasm-pack build --target web --out-dir ../../client/src/wasm/pkg
cd ../..
```

This compiles the Rust physics simulation to WASM with wasm-bindgen glue code. The output goes directly into the client source tree.

### 5. Install Dependencies

```bash
cd client && bun install
cd ../api && bun install
```

### 6. Start the API Server

```bash
cd api && bun run --hot index.ts
```

Runs the Hono API server with hot reloading. Default port: 3001.

### 7. Start the Client Dev Server

```bash
cd client && bun run dev
```

Runs Vite dev server with HMR. Default port: 5173.

## Development Workflow

### Changing the SpacetimeDB Schema

1. Edit `server/spacetimedb/src/lib.rs`
2. Republish: `spacetime publish flower-maker --clear-database -y --module-path server/spacetimedb`
3. Regenerate bindings: `spacetime generate --lang typescript --out-dir client/src/spacetime/module_bindings --module-path server/spacetimedb`
4. Update TypeScript code that references changed types

### Changing Physics / WASM Code

1. Edit files in `crates/client-wasm/src/` or `crates/flower-core/src/`
2. Rebuild: `cd crates/client-wasm && wasm-pack build --target web --out-dir ../../client/src/wasm/pkg`
3. Vite picks up the changed WASM files via HMR (may need manual reload)

### Changing React / PixiJS Code

1. Edit files in `client/src/`
2. Vite HMR handles it automatically

### Changing AI Prompts / API Routes

1. Edit files in `api/`
2. Bun hot reloading handles it automatically

## Project Structure

```
flower-maker/
├── Cargo.toml                  # Rust workspace (3 members)
│
├── crates/
│   ├── flower-core/            # Shared Rust crate (rlib)
│   │   ├── Cargo.toml          #   features: spacetimedb, wasm
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── parts.rs        # Part types, kinds, metadata
│   │       ├── catalog.rs      # 50+ flower definitions
│   │       ├── combination.rs  # Merge rules, level progression
│   │       └── physics.rs      # Physics preset per archetype
│   │
│   └── client-wasm/            # Browser WASM crate (cdylib)
│       ├── Cargo.toml          #   deps: flower-core, rapier2d, wasm-bindgen
│       └── src/
│           ├── lib.rs          # wasm-bindgen exports: init, tick, add/remove
│           ├── simulation.rs   # rapier2d world management
│           ├── buffer.rs       # SharedArrayBuffer write logic
│           ├── merge.rs        # Collision → merge event detection
│           └── bridge.rs       # JSON deserialization for SpacetimeDB updates
│
├── server/
│   ├── spacetime.json          # SpacetimeDB config
│   └── spacetimedb/            # SpacetimeDB module (cdylib)
│       ├── Cargo.toml          #   deps: flower-core, spacetimedb 2.0
│       └── src/
│           └── lib.rs          # Tables + reducers
│
├── client/                     # React + Vite + PixiJS
│   ├── package.json
│   └── src/
│       ├── main.tsx            # Entry: SpacetimeDB + WASM + PixiJS init
│       ├── App.tsx             # Layout: canvas background + UI overlay
│       ├── spacetime/          # SpacetimeDB connection, hooks, bridge
│       ├── canvas/             # PixiJS renderer, viewport, effects
│       ├── wasm/               # WASM loader, game loop
│       ├── ai/                 # Chat UI, merge prompts
│       ├── catalog/            # Part browser, editor
│       ├── designer/           # Flower assembly
│       ├── orders/             # Order flow, feed
│       └── session/            # Identity, presence
│
├── api/                        # Hono on Bun
│   └── index.ts                # AI streaming routes
│
└── docs/                       # You are here
```

## Debugging

### SpacetimeDB

```bash
# View server logs (reducer output, errors)
spacetime logs flower-maker

# Check if module is published
spacetime list
```

### WASM

Open browser DevTools console:

```javascript
// Check WASM module loaded
console.log(simulation); // should be a Simulation object

// Manual tick
simulation.tick(0.016); // 16ms = one frame at 60fps

// Check merge events
console.log(simulation.get_merge_events()); // JSON array

// Check buffer
const view = new Float32Array(sharedBuffer);
console.log(view.slice(0, 9)); // first flower's transform data
```

### PixiJS

```javascript
// Access PixiJS app from console
const app = window.__PIXI_APP__;

// Check sprite count
console.log(app.stage.children.length);

// Check FPS
console.log(app.ticker.FPS);
```

### SpacetimeDB Client (TypeScript)

```javascript
// Check connection state
console.log(conn.isConnected);

// Count cached rows
console.log(conn.db.flower_session.count());
console.log(conn.db.part_definition.count());

// Iterate sessions
for (const s of conn.db.flower_session.iter()) {
  console.log(s.id, s.name, s.status);
}
```

## Deployment

### SpacetimeDB → Maincloud

```bash
spacetime publish flower-maker --module-path server/spacetimedb
```

Deploys to SpacetimeDB's free hosted cloud. Dashboard at: `https://spacetimedb.com/@<username>/flower-maker`

### Client → Vercel

Standard Vite deployment. Build output goes to `dist/`.

### API → Vercel / Any Bun Host

The Hono API is stateless and can deploy anywhere that runs Bun.

## Environment Variables

### API Server

```
# AI Gateway (via Vercel)
VERCEL_OIDC_TOKEN=<auto-provisioned>

# Or direct provider key (development)
ANTHROPIC_API_KEY=<key>
```

### Client

```
# SpacetimeDB connection
VITE_SPACETIMEDB_URI=ws://localhost:3000
VITE_SPACETIMEDB_MODULE=flower-maker

# API server
VITE_API_URL=http://localhost:3001
```
