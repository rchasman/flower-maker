# Development Guide

## Prerequisites

- Rust (stable) with the `wasm32-unknown-unknown` target
- Bun 1.x
- SpacetimeDB CLI 2.x
- wasm-pack, for the client WASM build
- wasm-opt from binaryen, for the SpacetimeDB module build

`bun run setup` (`scripts/setup.sh`) checks for `bun`, `spacetime` and
`cargo`, runs `bun install`, copies `.env.example` to `.env` when it is
missing, and runs `bun run db:deploy`.

## Ports and names

| What              | Value                      | Where                                              |
| ----------------- | -------------------------- | -------------------------------------------------- |
| API               | 9200                       | `api/index.ts`                                     |
| Client (Vite)     | 9100                       | `client/package.json` `dev` script                 |
| Local SpacetimeDB | 9300                       | `dev:spacetime` script                             |
| Database name     | `flower-picker`            | `scripts/module.ts`, `server/spacetime.local.json` |
| Vite proxy        | `/api` to `localhost:9200` | `client/vite.config.ts`                            |

## Environment variables

`.env.example` at the repo root lists them. Vite reads the same file
(`envDir: ".."`).

| Variable                  | Used by | Default               | Purpose                                                               |
| ------------------------- | ------- | --------------------- | --------------------------------------------------------------------- |
| `AI_GATEWAY_API_KEY`      | api     | none, required        | Vercel AI Gateway key; every model, including Jev, goes through it    |
| `VITE_SPACETIMEDB_URI`    | client  | `ws://localhost:9300` | SpacetimeDB WebSocket                                                 |
| `VITE_SPACETIMEDB_MODULE` | client  | `flower-picker`       | database name                                                         |
| `SPACETIMEDB_URI`         | agents  | `ws://localhost:9300` | same, for `agents/agent.ts`                                           |
| `SPACETIMEDB_MODULE`      | agents  | `flower-maker`        | `agents/agent.ts` defaults to the old name; set it to `flower-picker` |
| `AGENT_NAME`              | agents  | `flora-bot`           | display name of the placeholder agent                                 |

## Local development

```bash
bun install
bun run dev
```

`bun run dev` starts four processes and writes their logs to `.logs/`:

| Script              | Does                                                        |
| ------------------- | ----------------------------------------------------------- |
| `dev:spacetime`     | `spacetime start --listen-addr 0.0.0.0:9300`                |
| `dev:api`           | `bun --watch api/index.ts`                                  |
| `dev:publish-local` | waits for the local server, builds the module, publishes it |
| `dev:client`        | Vite on 9100 (in the foreground)                            |

Open http://localhost:9100.

## Database scripts

All SpacetimeDB operations run through `bun run db:*`. Each one calls
`scripts/module.ts`, which runs `spacetime build`, then `wasm-opt -g -O2`
(the CLI's own `wasm-opt -all` pass emits a binary SpacetimeDB cannot parse),
and hands the file to the CLI with `--bin-path`.

| Command                    | What it does                                       |
| -------------------------- | -------------------------------------------------- |
| `bun run db:publish`       | publish to maincloud                               |
| `bun run db:publish:local` | publish to the local server on 9300                |
| `bun run db:publish:clear` | publish to maincloud with `--delete-data`          |
| `bun run db:generate`      | regenerate `client/src/spacetime/module_bindings/` |
| `bun run db:deploy`        | `db:publish` then `db:generate`                    |
| `bun run db:logs`          | tail maincloud logs                                |

After any change to `server/spacetimedb/src/lib.rs`, run `bun run db:deploy`
and commit the regenerated bindings.

## Rebuilding the client WASM

Vercel has no Rust toolchain, so the wasm-pack output in
`client/src/wasm/pkg/` is committed. After any change to
`crates/flower-core` or `crates/client-wasm`:

```bash
cd crates/client-wasm
wasm-pack build --target web --out-dir ../../client/src/wasm/pkg
```

`client/src/wasm/loader.ts` imports `./pkg/client_wasm.js`. When the import
fails it falls back to a stub simulation with no physics.

## Fixtures

```bash
bun run fixtures
```

`scripts/fixtures.ts` assembles one spec per family with a fixed seed under
`invented` strangeness, rotating the answers so every enum variant appears at
least once, and writes them as YAML into `crates/flower-core/tests/fixtures/`.
It fails when a variant is never reached. `cargo test -p flower-core` parses
every fixture and round trips it through `serde_yaml`;
`api/flower/specSchema.test.ts` parses the same files with the zod mirror.
Regenerate the fixtures whenever `catalog.rs`, `flower-enums.ts`, the family
profiles or the assembler change.

## Checks and tests

| Command                 | Does                                           |
| ----------------------- | ---------------------------------------------- |
| `bun run check`         | typecheck every workspace, oxlint, oxfmt check |
| `bun run check:type`    | `tsc --noEmit` in `client` and `api`           |
| `bun run lint`          | `oxlint --type-aware`                          |
| `bun run fmt`           | `oxfmt .`                                      |
| `bun test` in `api/`    | generator tests                                |
| `bun test` in `client/` | renderer and client tests                      |
| `cargo test`            | Rust unit tests and the fixture test           |

## Project structure

```
flower-maker/
├── Cargo.toml                  # Rust workspace: flower-core, client-wasm, server/spacetimedb
├── package.json                # Bun workspaces: client, api, agents; the scripts above
├── vercel.json                 # two services: client (static) and api (Bun)
├── .env.example
│
├── crates/
│   ├── flower-core/            # rlib
│   │   ├── src/
│   │   │   ├── catalog.rs      # FlowerSpec types and enums
│   │   │   ├── genetics.rs     # cross()
│   │   │   ├── physics.rs      # GardenPhysics, PhysicsArchetype, body_params
│   │   │   └── animation.rs    # bloom-in / wilt-out
│   │   └── tests/
│   │       ├── fixtures.rs     # parses every fixture
│   │       └── fixtures/       # one YAML per family plus contract-smoke.yaml
│   └── client-wasm/            # cdylib
│       └── src/
│           ├── lib.rs          # GardenSimulation (wasm-bindgen)
│           ├── simulation.rs   # rapier2d world
│           └── buffer.rs       # render buffer layout
│
├── server/
│   ├── spacetime.json          # maincloud config
│   ├── spacetime.local.json    # database name
│   └── spacetimedb/src/lib.rs  # tables and reducers
│
├── scripts/
│   ├── setup.sh                # bun run setup
│   ├── module.ts               # build + wasm-opt the module
│   ├── publish.ts              # spacetime publish
│   ├── generate.ts             # spacetime generate
│   └── fixtures.ts             # bun run fixtures
│
├── api/                        # Bun HTTP server
│   ├── index.ts                # routes, CORS, port 9200
│   ├── config/models.ts        # gateway model list, DEFAULT_MODEL, JEV_MODEL
│   └── flower/
│       ├── families.ts         # FamilyProfile per FlowerFamily
│       ├── questions.ts        # stage one and stage two questions
│       ├── answering.ts        # jevSource, textModelSource
│       ├── seed.ts             # FNV-1a seed, LCG rng
│       ├── assemble.ts         # assembleSpec
│       ├── specSchema.ts       # zod mirror of catalog.rs
│       ├── pipeline.ts         # generateFlower snapshots
│       ├── generate.ts         # POST /flower/generate
│       ├── combine.ts          # POST /flower/combine
│       └── order.ts            # POST /flower/order
│
├── client/src/
│   ├── data/
│   │   ├── flower-enums.ts     # every Rust enum as an as-const array
│   │   └── templates.ts        # 45 templates with family and inflorescence
│   ├── flower/                 # render.ts, pixi-draw.ts, patterns, corolla, inflorescence, lifeStage, effects, leaf, stem, petal
│   ├── ai/                     # generateFlower.ts (NDJSON client), FlowerChat.tsx
│   ├── designer/               # DesignerView, FlowerCanvas, TemplatePicker, PartEditor
│   ├── homepage/               # FlowerGrid, PixiMiniCanvas
│   ├── spacetime/              # connection, hooks, bridge, module_bindings/
│   ├── wasm/                   # loader.ts, loop.ts, pkg/ (committed wasm-pack output)
│   ├── orders/                 # OrderFlow, OrderFeed, ActivityFeed
│   ├── settings/               # ModelPicker
│   ├── session/, social/, auth/, ui/, styles/, lib/
│   └── App.tsx, main.tsx
│
├── agents/agent.ts             # placeholder agent, prints its plan
└── docs/
```

## Deployment

**SpacetimeDB.** `bun run db:deploy` publishes `flower-picker` to maincloud
and regenerates the bindings. Dashboard: https://spacetimedb.com/flower-picker.

**Vercel.** `vercel.json` declares two services. `client/` builds with Vite;
`api/` runs `index.ts` on Bun. Rewrites send `/api/(.*)` to the API service and
everything else to the client. Set `AI_GATEWAY_API_KEY` on the project.

## Debugging

```bash
spacetime logs flower-picker --server maincloud   # or: bun run db:logs
spacetime list
```

The API logs `[generate] failed:` and `[generate] failed mid-stream:` with the
error message. The client logs `[wasm]`, `[bridge]`, `[merge]` and
`[spacetimedb]` prefixed messages to the browser console.
