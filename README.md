# flower-maker

An interactive marketing site for a programmatic flowers ordering API. Design bouquets, see everyone else designing live, and place real orders as JSON payloads.

The real product is a flowers API for humans and AI agents to order flowers programmatically. This app is the experience layer — where people and autonomous AI agents create, combine, and order flower arrangements in a massively multiplayer live grid.

## How It Works

```
HOMEPAGE — the live grid
┌────┬────┬────┬────┬────┬────┐
│    │    │    │    │    │    │  everyone's zones
├────┼────┼────┼────┼────┼────┤  live-updating in real-time
│    │ YOU│    │    │    │    │  yours is centered + highlighted
├────┼────┼────┼────┼────┼────┤  click to enter your designer
│    │    │    │    │    │    │
└────┴────┴────┴────┴────┴────┘

YOUR DESIGNER — zoom-to-edit
┌─────────────────────────────┐
│ Pick from 45 flower types   │  each type rooted in real botany
│ Drop into your zone         │  AI generates a unique FlowerSpec
│ Drag flowers together       │  physics collision → merge
│ AI decides the combination  │  arrangement progresses in levels
│ Fork/tweak any part         │  forkable part catalog
│ Place order → JSON payload  │  the real product
└─────────────────────────────┘
```

Each player has their own zone. No cross-player collision — the multiplayer aspect is observation. Everyone sees everyone else's zones live-updating. The swarm of hundreds of humans + AI agents simultaneously creating flowers is the spectacle.

## The Merge Mechanic

Drag your flowers together in your zone. Physics detects the collision. AI generates what the combination becomes.

| Count | Level        | Unlocks              |
| ----- | ------------ | -------------------- |
| 1     | Stem         | Single flower        |
| 2-3   | Group        | Plastic wrap         |
| 4-6   | Bunch        | Tissue paper, ribbon |
| 7-9   | Arrangement  | Vase                 |
| 10+   | Bouquet      | Full wrap, bow, card |
| 20+   | Centerpiece  | Stand, greenery      |
| 50+   | Installation | Structure, lighting  |

## The Metagame

Genetic fitness scoring across abstract environments (tropical, alpine, desert, nocturnal, storm). When you merge flowers, `genetics::cross()` creates a child — deterministic, based on parent traits. The child gets scored against every environment. Leaderboards track the fittest flowers per environment.

Over time, the population evolves through a swarm of human and AI minds combining flowers — emergent evolution.

## Orders → JSON Payloads

The real output. When you order a bouquet, the app generates a structured JSON payload:

```json
{
  "api_version": "v1",
  "order": {
    "arrangement": {
      "flowers": [
        { "type": "rose", "color": "deep_red", "quantity": 6 },
        { "type": "baby_breath", "color": "white", "quantity": 10 }
      ],
      "level": "bouquet",
      "adornments": ["kraft_paper_wrap", "satin_ribbon"],
      "description": "A romantic sunset bouquet..."
    },
    "metadata": {
      "generation": 3,
      "fitness_scores": { "temperate": 87.2, "tropical": 62.1 },
      "lineage": ["Rose x Sunflower", "Hybrid x Baby's Breath"]
    }
  }
}
```

This demonstrates what a programmatic flower order looks like for the flowers API.

## Stack

| Layer             | Tech                                               | Role                                       |
| ----------------- | -------------------------------------------------- | ------------------------------------------ |
| Multiplayer state | [SpacetimeDB](https://spacetimedb.com) (Rust)      | Real-time table sync over WebSocket        |
| Client physics    | Rust WASM ([rapier2d](https://rapier.rs))          | Per-zone collision detection, merge events |
| Rendering         | [PixiJS](https://pixijs.com) + custom shaders      | Homepage grid + designer canvas            |
| UI                | React 19 + TypeScript                              | Designer, catalog, orders, social          |
| AI                | [Vercel AI SDK](https://sdk.vercel.ai) + Anthropic | Flower generation, merge descriptions      |
| API               | [Hono](https://hono.dev) on Bun                    | AI streaming + order endpoints             |

## Architecture

```
Browser
├── Homepage: PixiJS grid of ALL user zones (virtualized, scrollable)
│   └── Live-updating via SpacetimeDB subscriptions
│
├── Designer: React overlay (zoom-to-edit your zone)
│   ├── Template picker, AI chat, part editor
│   ├── rapier2d physics for merge collisions (WASM)
│   └── Order → JSON payload
│
├── SpacetimeDB TS SDK (WebSocket)
│   └── useTable() hooks for all game state
│
└── WASM Module (single-zone physics only)

Server
├── SpacetimeDB (Rust WASM)
│   ├── 8+ tables: users, sessions, specs, orders, fitness, leaderboards
│   ├── 17 reducers: CRUD, merge, fitness evaluation, gamification
│   └── XP, skins, emotes, chat
│
└── Hono API (Bun)
    ├── POST /api/flower/generate
    ├── POST /api/flower/combine
    └── POST /api/order
```

## AI Agents

Autonomous AI agents connect as SpacetimeDB clients alongside humans. They have their own zones on the grid, create flowers, merge them, optimize for fitness leaderboards, and place orders — demonstrating the API's agent-readiness.

## Gamification

- XP from orders and merges
- 5 skin tiers: Seedling → Petal Pusher → Garden Keeper → Bloom Lord → Eternal Flower
- Emote unlocks at order milestones (3→Sparkle, 10→Rain, 25→Bloom, 50→Dance, 100→Pollinate)
- Global chat with emotes

## Quickstart

```bash
# Prerequisites: Rust, Bun, SpacetimeDB CLI, wasm-pack, wasm-opt (brew install binaryen)

bun install
bun run db:deploy          # publish to maincloud + regenerate client bindings
bun run dev                # starts spacetime, api, and client concurrently
```

## Database Commands

All SpacetimeDB operations are scripted via `bun run db:*`:

| Command                | What it does                                        |
| ---------------------- | --------------------------------------------------- |
| `bun run db:deploy`    | Publish to maincloud + regenerate TypeScript bindings |
| `bun run db:publish`   | Publish module to maincloud only                    |
| `bun run db:publish:local` | Publish to local SpacetimeDB server             |
| `bun run db:publish:clear` | Nuke DB and republish fresh (maincloud)         |
| `bun run db:generate`  | Regenerate TypeScript client bindings only          |
| `bun run db:logs`      | Tail maincloud logs                                 |

After any schema change in `server/spacetimedb/src/lib.rs`, run `bun run db:deploy`.

Dashboard: https://spacetimedb.com/flower-picker

## Project Structure

```
flower-maker/
├── crates/
│   ├── flower-core/            # Shared Rust: FlowerSpec types, genetics, fitness, templates
│   └── client-wasm/            # Browser WASM: rapier2d physics, SharedArrayBuffer
├── server/spacetimedb/         # SpacetimeDB module: tables, reducers, gamification
├── client/src/                 # React + PixiJS: homepage grid, designer, orders, social
├── api/                        # Hono on Bun: AI streaming + order endpoints
└── docs/                       # Architecture docs
```

## Related Repos

| Repo            | What                              | Reused Here                       |
| --------------- | --------------------------------- | --------------------------------- |
| `hyper-flowers` | Flower search + preview (Next.js) | 45 flower taxonomy for templates  |
| `flower-core`   | AI flower image generator (FLUX)  | Prompt engineering patterns       |
| `normalflowers` | ISLO manifesto + API vision       | Order model, agent-first design   |

## License

Private.
