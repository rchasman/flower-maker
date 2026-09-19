# Architecture

## What This Is

flower-maker is an interactive marketing site for a programmatic flowers
ordering API. The real product is a flowers API for humans and AI agents. This
app is the experience layer.

## System Overview

```
Browser (client/, Vite on port 9100)
├── Homepage grid (React)
│   ├── One card per user zone, from SpacetimeDB subscriptions
│   └── PixiMiniCanvas: one shared offscreen renderer, one <img> per card
│
├── Designer (React)
│   ├── Template picker, AI chat, model picker, part editor, orders, chat
│   ├── FlowerCanvas: PixiJS, plans from client/src/flower/
│   └── WASM loop: rapier2d bodies, positions into a Float32Array each frame
│
├── SpacetimeDB TS SDK (WebSocket)
│   ├── useTable hooks for every table
│   └── bridge.ts: table callbacks to the WASM simulation
│
└── WASM module (crates/client-wasm)
    ├── Single-zone physics: your Designing sessions only
    ├── Bloom-in / wilt-out animation
    └── body_params from the spec: stem archetype and head count

Server
├── SpacetimeDB module (server/spacetimedb, database flower-picker)
│   ├── 6 tables: user, flower_session, flower_spec, part_override, flower_order, chat_message
│   ├── 18 reducers: sessions, specs, overrides, orders, chat, identity, merge, split
│   └── genetics::cross for the merged child spec
│
└── Bun API (api/index.ts, port 9200)
    ├── POST /api/flower/generate  (typed questions, NDJSON spec snapshots)
    ├── POST /api/flower/combine   (AI arrangement description)
    └── POST /api/flower/order     (JSON payload)
```

In production Vercel hosts both services from `vercel.json`: `/api/*` goes to
the `api` service, everything else to the `client` build. SpacetimeDB runs on
maincloud.

## Key Design Choices

**Per-player zones, not shared physics.** Each player has a zone. The WASM
simulation loads only your own `Designing` sessions. Everyone else's zones are
read-only cards on the homepage.

**The model answers questions, code writes the spec.** A flower request goes
through two stages of typed questions. Jev answers them through the AI SDK
`evaluate` API; any gateway text model answers them as a streamed structured
object. `assembleSpec` turns the answers plus a family profile plus a
prompt-seeded RNG into a complete FlowerSpec, and a zod mirror of the Rust
schema checks it. See `docs/05-ai-integration.md`.

**One schema, two languages.** `crates/flower-core/src/catalog.rs` is the
schema. `client/src/data/flower-enums.ts` lists every enum's variants, and the
fixtures in `crates/flower-core/tests/fixtures/` are parsed on both sides.

**Genetics breeds the child, AI describes the arrangement.** On a merge the
server runs `genetics::cross` on both YAML specs. The client asks the combine
endpoint for a name, description and adornment spec, and stores the answer as
a part override on the child.

**JSON order payloads are the product.** `POST /api/flower/order` returns the
payload that a programmatic flower order would carry.

## Data Flow: Creating a Flower

1. The user types a description in the AI chat, or picks a template.
2. `DesignerView` calls `create_session(prompt)` and starts
   `POST /api/flower/generate`.
3. The API answers stage one, then streams one NDJSON line per stage two
   answer set. Each line carries the full YAML of the spec so far.
4. `DesignerView` matches the new session row to the generation by prompt and
   calls `update_flower_spec(session_id, spec)` on every snapshot.
5. Every client receives the rows through its subscription. The homepage card
   re-renders; in your designer `bridge.ts` calls `upsert_flower` on the WASM
   simulation, and `FlowerCanvas` rebuilds the plan.

## Data Flow: Merging

1. You drag flower A onto flower B in your designer (within 210 px on release).
2. `handleMerge` posts both specs to `POST /api/flower/combine`.
3. `merge_sessions(a, b, ai_json)` runs `genetics::cross`, creates the child
   session at the midpoint, stores the AI JSON and every constituent spec as
   `part_override` rows, and sets both parents to `Complete`.
4. `bridge.ts` sees the parents complete and wilts them out; the child arrives
   as a new session and blooms in. See `docs/03-merge-mechanic.md`.

## Rust Crates

`Cargo.toml` is a workspace with three members.

`crates/flower-core` (rlib, no features):

| Module         | Holds                                                                      |
| -------------- | -------------------------------------------------------------------------- |
| `catalog.rs`   | the FlowerSpec type system: every struct and enum, all with serde defaults |
| `genetics.rs`  | `cross(a, b, seed)`                                                        |
| `physics.rs`   | `GardenPhysics` (wind and light), `PhysicsArchetype`, `body_params(spec)`  |
| `animation.rs` | `FlowerAnimation`: bloom-in, alive, wilt-out, particle state               |

`crates/client-wasm` (cdylib, wasm-bindgen, rapier2d):

| Module          | Holds                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `lib.rs`        | `GardenSimulation`: `upsert_flower`, `wilt_flower`, `remove_flower`, `tick`, `render_data`, `write_to_buffer`, `set_body_position` |
| `simulation.rs` | the rapier2d world                                                                                                                 |
| `buffer.rs`     | the 14 float per flower layout for the render buffer                                                                               |

`server/spacetimedb` (cdylib, spacetimedb 2.10): tables and reducers in
`src/lib.rs`, `flower-core` for `genetics::cross`, `serde_yaml` to read and
write `flower_spec.spec`.
