# The Merge Mechanic

The core game loop. Everything in flower-maker exists to serve this interaction.

## The Loop

```
Place flower on canvas
       │
       ▼
Physics simulation moves it
       │
       ▼
It collides with another flower ◄──── other players' flowers exist here too
       │
       ▼
Overlap persists for 500ms+ (not a glancing hit)
       │
       ▼
WASM emits merge event
       │
       ▼
Client calls AI: "what do 3 roses + 2 sunflowers become?"
       │
       ▼
AI responds: arrangement description, adornments, visual hints
       │
       ▼
Client calls SpacetimeDB reducer: merge_sessions()
       │
       ▼
All clients see: old flowers vanish, new arrangement materializes
       │
       ▼
Arrangement is now a single physics body that can merge with more flowers
       │
       ▼
Repeat → arrangements grow → bouquets → centerpieces → installations
```

## Arrangement Progression

Every arrangement has a **level** determined by how many individual flowers it contains:

| Flower Count | Level | What It Looks Like | AI Generates |
|-------------|-------|-------------------|-------------|
| 1 | **Stem** | Single flower, bare stem | Flower description |
| 2-3 | **Group** | Small cluster, plastic wrap | How flowers complement each other |
| 4-6 | **Bunch** | Tissue paper, ribbon tied | Color harmony, shape |
| 7-9 | **Arrangement** | In a vase, decorative paper | Composition, focal points |
| 10-19 | **Bouquet** | Full wrap, bow, card, box | Complete bouquet narrative |
| 20-49 | **Centerpiece** | Stand, candelabra, greenery | Event-scale description |
| 50+ | **Installation** | Structure, lighting, space | Installation art description |

Each level transition triggers a fresh AI call. The AI sees the full list of flower types and generates:

1. **Arrangement description** — what it looks like, the mood, the color story
2. **Adornments** — what physical additions unlock (wrap, ribbon, vase, stand)
3. **Sprite hints** — colors, textures, style keywords for the renderer

## Collision Detection

Handled by rapier2d in the WASM module. Each flower session is a rigid body with a circular collider sized to its arrangement level (bigger arrangements have bigger colliders).

**Merge threshold**: Two flowers must overlap for **500ms continuously**. This prevents:
- Glancing collisions from triggering unwanted merges
- Fast-moving flowers from merging on flyby
- Physics settling from causing accidental merges

The threshold is enforced in WASM, not SpacetimeDB, because it requires frame-by-frame timing.

## Conflict Resolution

What happens when two clients detect the same merge simultaneously?

1. Client A detects collision between flowers 42 and 17
2. Client B also detects the same collision
3. Both call `merge_sessions(42, 17, ...)` at nearly the same time
4. SpacetimeDB processes them sequentially (reducers are transactional)
5. First reducer succeeds: creates new session, archives 42 and 17
6. Second reducer fails: flowers 42 and 17 are already archived
7. Client B receives the error, but also receives the onInsert for the new session
8. Both clients end up in the same state

No race condition. No duplicate merges. SpacetimeDB's transactional model handles this.

## Cross-Player Merges

You can merge your flower with someone else's flower. The `merge_sessions` reducer validates that the caller owns **at least one** of the two sessions. The resulting combined session is owned by the caller.

This means:
- You can "absorb" flowers from other players by dragging yours into theirs
- The other player loses their flower (it's archived)
- Potential for griefing → future work: opt-in merge consent

## AI Combination Prompt

When a merge is detected, the client calls `POST /api/flower/combine`:

```json
{
  "flowers_a": [
    { "type": "rose", "color": "red", "quantity": 3 },
    { "type": "baby_breath", "color": "white", "quantity": 5 }
  ],
  "flowers_b": [
    { "type": "sunflower", "color": "yellow", "quantity": 2 }
  ],
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

An installation (50+ flowers) is a massive, slow-moving object on the canvas. It takes real effort (many smaller flowers) to merge with it.
