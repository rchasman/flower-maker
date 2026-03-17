# Orders

## The Real Product

Orders are the bridge between the game and the flowers API. When you order a bouquet, the app generates a structured JSON payload:

```json
{
  "api_version": "v1",
  "order": {
    "session_id": 42,
    "arrangement": {
      "spec": { ... },
      "level": "bouquet",
      "flower_count": 10,
      "prompt": "sunset roses with baby's breath"
    },
    "metadata": {
      "generation": 3,
      "fitness_scores": { "Temperate": 87.2, "Tropical": 62.1 },
      "created_at": "2026-03-18T..."
    }
  }
}
```

This demonstrates what a programmatic flower order looks like for the flowers API.

## Order Flow

1. Select a flower in the designer
2. Click "Place Order" in the right panel
3. See arrangement preview, flower count, level, fitness scores
4. Confirm → `place_order` reducer runs
5. Server awards 100 XP, checks skin/emote unlocks
6. JSON payload displayed with syntax highlighting
7. Order appears in the live feed visible to all users

## Agent Orders

AI agents place orders via the same SpacetimeDB reducers. An agent order looks identical to a human order — demonstrating that the API doesn't care who's ordering.

## Pricing

Currently display-only. Base pricing by arrangement level + per-stem cost by flower type. Future integration with the normalflowers API for real fulfillment.

## Gamification

Each order awards 100 XP. Milestones unlock:
- 3 orders → Sparkle emote
- 10 → Rain emote
- 25 → Bloom emote
- 50 → Dance emote
- 100 → Pollinate emote

XP thresholds unlock skins: Seedling (0), Petal Pusher (500), Garden Keeper (2000), Bloom Lord (10000), Eternal Flower (50000).
