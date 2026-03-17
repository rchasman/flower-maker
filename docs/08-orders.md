# Orders

## The Real Product

Orders are the bridge between the game and the flowers API. When you order an arrangement, the app generates a structured JSON payload:

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

```
User builds or merges flowers into an arrangement
       │
Clicks "Order" in the right panel
       │
Order UI shows:
  - Arrangement preview
  - AI-generated description
  - Price (calculated from flower types + quantity + level)
  - Adornments included at this level
       │
User confirms → calls place_order reducer
       │
SpacetimeDB:
  - Creates FlowerOrder (status: "pending")
  - Sets FlowerSession status → "ordered"
  - Snapshots arrangement_json into order
  - Awards 100 XP, checks skin/emote unlocks
       │
All clients see:
  - The flower stops moving (physics body removed)
  - Visual indicator: "ORDERED" badge
  - JSON payload displayed with syntax highlighting
  - Appears in the live order feed
```

## Pricing

Base pricing follows the arrangement level, with adjustments for flower type rarity:

```
Base price = level_base + (flower_count × per_stem_price) + adornment_cost

Level bases:
  stem:         $0 (it's just a flower)
  group:        $15
  bunch:        $25
  arrangement:  $45
  bouquet:      $65
  centerpiece:  $120
  installation: $300

Per-stem prices (by flower type):
  Common (rose, daisy, carnation):     $5
  Garden (dahlia, peony, ranunculus):   $8
  Statement (protea, bird of paradise): $12
  Accent (baby's breath, eucalyptus):   $3

Adornment costs:
  wrap:     $5
  ribbon:   $3
  vase:     $15
  stand:    $25
  box:      $20
```

Example: A bouquet of 10 flowers (6 roses + 4 dahlias) with full wrap, ribbon, and bow:

```
$65 (bouquet base) + (6 × $5) + (4 × $8) + $5 (wrap) + $3 (ribbon) = $135
```

Currently display-only. Future integration with the normalflowers API for real fulfillment.

## Order Feed

The order feed is a live-updating ticker visible to all users:

```
[Sunset Harvest — 10 flowers — $135 — @user123]
[Morning Dew — 3 flowers — $30 — @agent_curator]
[Wild Meadow — 25 flowers — $220 — @user456]
```

Each entry shows:

- Arrangement name (AI-generated)
- Flower count and price
- Who ordered it (identity, anonymized)
- Clicking pans to the ordered arrangement on the grid

## Agent Orders

AI agents place orders via the same SpacetimeDB reducers. An agent order looks identical to a human order — demonstrating that the API doesn't care who's ordering.

Agents can automate ordering based on criteria ("order any bouquet with roses under $100"), integrate with external systems, or curate by merging flowers and ordering the best results.

## Gamification

Each order awards 100 XP. Milestones unlock:

- 3 orders → Sparkle emote
- 10 → Rain emote
- 25 → Bloom emote
- 50 → Dance emote
- 100 → Pollinate emote

XP thresholds unlock skins: Seedling (0), Petal Pusher (500), Garden Keeper (2000), Bloom Lord (10000), Eternal Flower (50000).

## Fulfillment (Future)

Currently orders are in-game only — they mark an arrangement as valued and freeze it in your zone. The data model is ready for real fulfillment — `FlowerOrder` has a `status` field that can track fulfillment states, and `arrangement_snapshot` captures exactly what was ordered. Future integration with the normalflowers platform could route orders to real florists.
