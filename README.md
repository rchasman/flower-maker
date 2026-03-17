# flower-maker

A massively multiplayer flower combination game. Everyone connected sees everyone else's flowers on a shared infinite canvas. Drag flowers into each other to combine them — an AI decides what the combination becomes.

**1 flower** is a stem. **3 flowers** get wrapped. **10 flowers** become a bouquet. **50+** becomes an installation. Every merge is unique because an LLM generates the arrangement description, adornments, and visual identity based on what you combined.

Orders — placed by humans or AI agents — appear as completed arrangements on the background canvas for everyone to see.

## How It Works

```
You pick flowers from a catalog of 50+ real types
      |
You drag them onto the shared canvas
      |
Other people's flowers are there too, physics-simulated
      |
When flowers collide and overlap → they merge
      |
AI generates what the combination becomes
      |
New arrangement appears — everyone sees it
      |
At any point, you can order what you've built
```

## Stack

| Layer | Tech | Role |
|-------|------|------|
| Multiplayer state | [SpacetimeDB](https://spacetimedb.com) (Rust) | Real-time table sync over WebSocket |
| Client physics | Rust → WASM ([rapier2d](https://rapier.rs)) | Collision detection, merge events |
| Rendering | [PixiJS](https://pixijs.com) + custom shaders | Background canvas with all flowers |
| UI | React 19 + TypeScript | Designer, catalog, orders, AI chat |
| AI | [Vercel AI SDK](https://sdk.vercel.ai) + Anthropic | Flower generation, merge descriptions |
| API | [Hono](https://hono.dev) on Bun | AI streaming endpoints |

## Architecture

```
Browser
├── React UI (DOM overlay)
│   ├── AI Chat ─── streams flower specs via json-render
│   ├── Part Catalog ─── browse 50+ types, fork & customize
│   ├── Designer ─── assemble flowers from parts
│   └── Orders ─── submit, live feed of all orders
│
├── SpacetimeDB TS SDK (WebSocket)
│   ├── useTable() hooks → React state
│   └── onUpdate callbacks → WASM bridge
│
├── WASM Module (Rust, rapier2d)
│   ├── Physics simulation (collision, merge detection)
│   └── Writes sprite transforms → SharedArrayBuffer
│
└── PixiJS Canvas (fullscreen background)
    ├── Reads SharedArrayBuffer each frame
    ├── Instanced sprite rendering
    └── Scrollable/zoomable infinite canvas

Server
├── SpacetimeDB Module (Rust → WASM)
│   ├── Authoritative game state
│   ├── Part catalog, sessions, orders
│   └── Merge reducer (combine two sessions)
│
└── Hono API (Bun)
    ├── POST /api/flower/generate (AI stream)
    └── POST /api/flower/combine (merge description)
```

## The Merge Mechanic

The core game loop:

1. **Collision** — rapier2d detects two flowers overlapping for a threshold duration
2. **AI combination** — the API sends the flower types to an LLM which generates what the combination should become (arrangement style, adornments, narrative)
3. **SpacetimeDB merge** — a reducer creates the new combined session and archives the originals
4. **Broadcast** — all connected clients see old flowers disappear and the new arrangement materialize
5. **Progression** — arrangements level up as they absorb more flowers

| Count | Level | Unlocks |
|-------|-------|---------|
| 1 | Stem | Single flower |
| 2-3 | Group | Plastic wrap, rubber band |
| 4-6 | Bunch | Tissue paper, ribbon |
| 7-9 | Arrangement | Vase, decorative paper |
| 10+ | Bouquet | Full wrap, bow, card |
| 20+ | Centerpiece | Stand, candelabra, greenery |
| 50+ | Installation | Structure, lighting, space design |

Each level transition triggers an AI call. The AI knows what flowers are in the arrangement and generates a description of what it's become — the adornments, the color harmony, the mood.

## Part Catalog

50+ real flower types seeded from botanical taxonomy. Every standard part can be **forked** by any user — modify the colors, physics, visuals — creating a personal variant that others can discover and adopt.

Fork chains track lineage. Popular forks surface naturally.

## Quickstart

```bash
# Prerequisites: Rust, Bun, SpacetimeDB CLI

# Start SpacetimeDB locally
spacetime start

# Publish the server module
spacetime publish flower-maker --module-path server/spacetimedb

# Generate TypeScript bindings
spacetime generate --lang typescript \
  --out-dir client/src/spacetime/module_bindings \
  --module-path server/spacetimedb

# Build the WASM client module
cd crates/client-wasm && wasm-pack build --target web --out-dir ../../client/src/wasm/pkg

# Install client dependencies
cd client && bun install

# Install API dependencies
cd api && bun install

# Start the API server
cd api && bun run --hot index.ts

# Start the client dev server
cd client && bun run dev
```

## Project Structure

```
flower-maker/
├── Cargo.toml                  # Rust workspace
├── crates/
│   ├── flower-core/            # Shared: part types, combination rules, physics presets
│   └── client-wasm/            # Browser WASM: rapier2d simulation, SharedArrayBuffer
├── server/
│   └── spacetimedb/            # SpacetimeDB module: tables, reducers, catalog
├── client/                     # React + PixiJS + SpacetimeDB TS SDK
│   └── src/
│       ├── spacetime/          # Connection, hooks, WASM bridge
│       ├── canvas/             # PixiJS renderer, viewport, merge effects
│       ├── wasm/               # WASM loader, game loop
│       ├── ai/                 # Flower chat, merge prompts
│       ├── catalog/            # Part browser, editor, fork UI
│       ├── designer/           # Flower assembly UI
│       ├── orders/             # Order flow, live feed
│       └── session/            # Identity, connected users
├── api/                        # Hono on Bun: AI streaming endpoints
└── docs/                       # Architecture, schemas, guides
```

## Related Repos

| Repo | What | Reused Here |
|------|------|-------------|
| `hyper-flowers` | Flower search & preview (Next.js, FloristOne API) | 50+ flower taxonomy, color/occasion/style metadata |
| `flower-core` | AI flower image generator (FLUX models) | Prompt engineering system, flower data model |
| `normalflowers` | ISLO manifesto & developer API vision | Order model, agent-first API design, pricing logic |

## License

Private.
