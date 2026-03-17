# The Merge Mechanic

The core game loop. Everything in flower-maker exists to serve this interaction.

## How It Works

Merging happens within YOUR zone in the designer. Drag your flowers together. When they overlap for 500ms, they merge.

```
You pick flowers from templates / AI chat
       │
You drag them around in your zone (rapier2d physics)
       │
Two of YOUR flowers collide for 500ms+
       │
Client calls AI: "what do these become?"
       │
AI generates arrangement description
       │
Client calls merge_sessions reducer
       │
Server: genetics::cross() creates child spec
Server: archives both parents
Server: evaluates fitness in all environments
Server: awards 50 XP
       │
All clients see: old flowers wilt out, new arrangement blooms in
```

**No cross-player merging.** Each player merges their own flowers. The multiplayer aspect is observation — you watch everyone else's flowers on the homepage grid.

## Arrangement Progression

Every arrangement has a **level** determined by how many individual flowers it contains:

| Count | Level            | What It Looks Like          | AI Generates                      |
| ----- | ---------------- | --------------------------- | --------------------------------- |
| 1     | **Stem**         | Single flower, bare stem    | Flower description                |
| 2-3   | **Group**        | Small cluster, plastic wrap | How flowers complement each other |
| 4-6   | **Bunch**        | Tissue paper, ribbon tied   | Color harmony, shape              |
| 7-9   | **Arrangement**  | In a vase, decorative paper | Composition, focal points         |
| 10-19 | **Bouquet**      | Full wrap, bow, card, box   | Complete bouquet narrative        |
| 20-49 | **Centerpiece**  | Stand, candelabra, greenery | Event-scale description           |
| 50+   | **Installation** | Structure, lighting, space  | Installation art description      |

Each level transition triggers a fresh AI call. The AI sees the full list of flower types and generates:

1. **Arrangement description** — what it looks like, the mood, the color story
2. **Adornments** — what physical additions unlock (wrap, ribbon, vase, stand)
3. **Sprite hints** — colors, textures, style keywords for the renderer

## Collision Detection

rapier2d in the WASM module tracks overlap duration per collision pair. Each flower session is a rigid body with a circular collider sized to its arrangement level (bigger arrangements have bigger colliders).

**Merge threshold**: Two flowers must overlap for **500ms continuously**. This prevents:

- Glancing collisions from triggering unwanted merges
- Fast-moving flowers from merging on flyby
- Physics settling from causing accidental merges

The threshold is enforced in WASM, not SpacetimeDB, because it requires frame-by-frame timing.

## Genetics vs AI

- **genetics::cross()** creates the child FlowerSpec — deterministic given a seed. Blends continuous traits (colors, heights) via lerp, picks discrete traits (shapes, patterns) randomly.
- **AI** generates the narrative — arrangement name, description, adornments, color story. This is the "magic" layer.
- **fitness::evaluate()** scores the child against environments — this drives leaderboards.

The genetics system ensures consistent, reproducible offspring. The AI layer makes each merge feel creative and unique.

## AI Combination Prompt

When a merge is detected, the client calls `POST /api/flower/combine`:

```json
{
  "flowers_a": [
    { "type": "rose", "color": "red", "quantity": 3 },
    { "type": "baby_breath", "color": "white", "quantity": 5 }
  ],
  "flowers_b": [{ "type": "sunflower", "color": "yellow", "quantity": 2 }],
  "total_count": 10,
  "current_level": "bouquet"
}
```

The AI returns:

```json
{
  "arrangement_level": "bouquet",
  "description": "A bold contrast bouquet anchored by golden sunflowers...",
  "adornments": ["kraft paper wrap", "twine bow", "eucalyptus accent"],
  "sprite_hints": {
    "wrap_color": "#8B6914",
    "accent_style": "rustic",
    "dominant_color": "#FFD700"
  },
  "name": "Sunset Harvest"
}
```

The description is stored in the FlowerSession's `arrangement_json`. The sprite hints guide the PixiJS renderer on how to display the new arrangement.

## Physics After Merge

When two flowers merge:

1. WASM removes both old rigid bodies
2. Creates one new rigid body at the midpoint
3. New body has larger collider radius (bigger arrangement = bigger footprint)
4. New body has more mass (harder to push around)
5. Velocity is the average of the two originals (preserves momentum feel)

An installation (50+ flowers) is a massive, slow-moving object in your zone. It takes real effort (many smaller flowers) to merge with it.
