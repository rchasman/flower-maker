# The Merge Mechanic

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

| Count | Level | Unlocks |
|-------|-------|---------|
| 1 | Stem | Single flower |
| 2-3 | Group | Plastic wrap |
| 4-6 | Bunch | Tissue paper, ribbon |
| 7-9 | Arrangement | Vase |
| 10-19 | Bouquet | Full wrap, bow, card |
| 20-49 | Centerpiece | Stand, greenery |
| 50+ | Installation | Structure, lighting |

## Collision Detection

rapier2d in the WASM module tracks overlap duration per collision pair. When two bodies overlap for 500ms continuously, a merge event fires. The threshold prevents glancing hits.

## Genetics vs AI

- **genetics::cross()** creates the child FlowerSpec — deterministic given a seed. Blends continuous traits (colors, heights) via lerp, picks discrete traits (shapes, patterns) randomly.
- **AI** generates the narrative — arrangement name, description, adornments, color story. This is the "magic" layer.
- **fitness::evaluate()** scores the child against environments — this drives leaderboards.

The genetics system ensures consistent, reproducible offspring. The AI layer makes each merge feel creative and unique.
