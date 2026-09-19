# flower-maker

An interactive marketing site for a programmatic flowers ordering API. Design
flowers, watch everyone else design theirs live, and get the order as a JSON
payload.

The real product is a flowers API for humans and AI agents to order flowers
programmatically. This app is the experience layer: people describe a flower,
a model answers typed questions about it, code builds the botanical spec, and
the renderer draws it.

## How It Works

```
HOMEPAGE: the live grid
┌────┬────┬────┬────┬────┬────┐
│    │    │    │    │    │    │  one card per player zone
├────┼────┼────┼────┼────┼────┤  every card updates from SpacetimeDB
│    │ YOU│    │    │    │    │  yours is highlighted
├────┼────┼────┼────┼────┼────┤  click to enter your designer
│    │    │    │    │    │    │
└────┴────┴────┴────┴────┴────┘

YOUR DESIGNER
┌──────────────────────────────────┐
│ Describe a flower, or pick one   │  45 templates, each with its real family
│ of 45 templates                  │
│ The model answers typed          │  family, strangeness, mood, then the
│ questions in two stages          │  degrees of freedom the family leaves open
│ Code assembles the FlowerSpec    │  seeded by the prompt, checked by a zod mirror
│ The canvas updates per answer    │  NDJSON snapshots, one per answer set
│ Drag flowers together to merge   │  genetics::cross breeds the child
│ Edit any part                    │  part editor, stored as overrides
│ Place order → JSON payload       │  the real product
└──────────────────────────────────┘
```

Each player has a zone. There is no cross-player merging. The multiplayer part
is observation: everyone sees every zone change live.

## Generation

One pipeline serves every model. Stage one asks the botanical family, the
closest template, a strangeness level (`faithful`, `stylized`, `invented`) and
a mood word. Stage two asks only what the family leaves open, with each option
list filtered to the values legal for that family. Jev answers through the AI
SDK `evaluate` API in one round trip. Any other gateway text model answers the
same questions as a streamed structured object. The assembler turns the
answers into a complete FlowerSpec, and a zod mirror of the Rust schema rejects
anything the schema would not accept. Details in `docs/05-ai-integration.md`.

## The Merge Mechanic

Drop one of your flowers onto another. The server crosses both specs with
`genetics::cross` and creates a child session that carries both flowers. A
model names and describes the arrangement and picks its container.

| Count | Level        |
| ----- | ------------ |
| 1     | Stem         |
| 2-3   | Group        |
| 4-6   | Bunch        |
| 7-9   | Arrangement  |
| 10-19 | Bouquet      |
| 20-49 | Centerpiece  |
| 50+   | Installation |

## Orders → JSON Payloads

`POST /api/flower/order` returns the payload a programmatic flower order would
carry (`api/flower/order.ts`):

```json
{
  "api_version": "v1",
  "order": {
    "session_id": 42,
    "arrangement": {
      "spec": {},
      "level": "bouquet",
      "flower_count": 10,
      "prompt": "sunset roses with baby's breath"
    },
    "metadata": {
      "generation": 3,
      "created_at": "2026-09-20T10:00:00.000Z"
    }
  }
}
```

## Stack

| Layer             | Tech                                                                    | Role                                                          |
| ----------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| Multiplayer state | [SpacetimeDB](https://spacetimedb.com) (Rust module)                    | tables and reducers, live sync over WebSocket                 |
| Client physics    | Rust WASM ([rapier2d](https://rapier.rs))                               | bodies for your zone, bloom-in / wilt-out                     |
| Rendering         | [PixiJS](https://pixijs.com) `Graphics`                                 | spec to plan to draw commands; designer canvas and grid cards |
| UI                | React 19 + TypeScript                                                   | designer, templates, part editor, orders, chat                |
| AI (text models)  | [Vercel AI SDK](https://sdk.vercel.ai) `streamText` + `Output.object`   | typed answers streamed as partial objects; merge descriptions |
| AI (evaluation)   | [TypeSafe Jev](https://vercel.com/ai-gateway/models/jev) via `evaluate` | the same typed questions, answered in one round trip          |
| Spec assembly     | TypeScript (`api/flower/assemble.ts`) + zod mirror of `catalog.rs`      | family profiles, prompt-seeded jitter, schema check           |
| API               | Bun `fetch` server                                                      | generate (NDJSON), combine, order                             |

## Architecture

```
Browser
├── Homepage: one card per zone, rendered by a shared offscreen PixiJS app
├── Designer: PixiJS canvas + React panels
│   ├── Template picker, AI chat, model picker, part editor
│   ├── rapier2d physics in WASM for your flowers
│   └── Order → JSON payload
├── SpacetimeDB TS SDK (WebSocket), useTable hooks
└── WASM module (crates/client-wasm)

Server
├── SpacetimeDB module (server/spacetimedb, database flower-picker)
│   ├── 6 tables: user, flower_session, flower_spec, part_override, flower_order, chat_message
│   └── 18 reducers, genetics::cross on merge
└── Bun API (api/, port 9200)
    ├── POST /api/flower/generate
    ├── POST /api/flower/combine
    └── POST /api/flower/order
```

## Quickstart

```bash
# Prerequisites: Rust with the wasm32-unknown-unknown target, Bun, SpacetimeDB CLI,
# wasm-pack, wasm-opt (brew install binaryen)

bun install
cp .env.example .env       # set AI_GATEWAY_API_KEY
bun run db:deploy          # publish to maincloud + regenerate client bindings
bun run dev                # local spacetime (9300), api (9200), client (9100)
```

## Database Commands

| Command                    | What it does                                          |
| -------------------------- | ----------------------------------------------------- |
| `bun run db:deploy`        | Publish to maincloud + regenerate TypeScript bindings |
| `bun run db:publish`       | Publish module to maincloud only                      |
| `bun run db:publish:local` | Publish to the local SpacetimeDB server               |
| `bun run db:publish:clear` | Publish to maincloud and delete the data              |
| `bun run db:generate`      | Regenerate TypeScript client bindings only            |
| `bun run db:logs`          | Tail maincloud logs                                   |
| `bun run fixtures`         | Rewrite the cross-language spec fixtures              |

After any schema change in `server/spacetimedb/src/lib.rs`, run
`bun run db:deploy`. After any Rust change under `crates/`, rebuild the client
WASM with wasm-pack (`docs/09-development.md`).

Dashboard: https://spacetimedb.com/flower-picker

## Project Structure

```
flower-maker/
├── crates/
│   ├── flower-core/            # FlowerSpec schema, genetics, physics, animation, fixtures
│   └── client-wasm/            # rapier2d simulation for the browser
├── server/spacetimedb/         # SpacetimeDB module: tables and reducers
├── client/src/                 # React + PixiJS: grid, designer, renderer, enum catalog
├── api/                        # Bun: generation pipeline, combine, order
├── scripts/                    # db:*, fixtures, setup
├── agents/                     # placeholder agent
└── docs/                       # architecture docs
```

## Docs

| Doc                         | Covers                                             |
| --------------------------- | -------------------------------------------------- |
| `docs/01-architecture.md`   | system overview, data flows, crates                |
| `docs/02-schema.md`         | SpacetimeDB tables and reducers                    |
| `docs/03-merge-mechanic.md` | merging, levels, `genetics::cross`                 |
| `docs/04-part-catalog.md`   | every FlowerSpec field and enum, families, physics |
| `docs/05-ai-integration.md` | the generation pipeline, combine, models           |
| `docs/06-rendering.md`      | spec to plan to draw commands                      |
| `docs/07-multiplayer.md`    | zones, subscriptions, identity                     |
| `docs/08-orders.md`         | the order payload                                  |
| `docs/09-development.md`    | setup, ports, scripts, environment                 |

## Related Repos

| Repo            | What                              | Reused Here                     |
| --------------- | --------------------------------- | ------------------------------- |
| `hyper-flowers` | Flower search + preview (Next.js) | the 45 cut flower templates     |
| `flower-core`   | AI flower image generator (FLUX)  | Prompt engineering patterns     |
| `normalflowers` | ISLO manifesto + API vision       | Order model, agent-first design |

## License

Private.
