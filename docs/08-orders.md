# Orders

## Concept

Any flower arrangement on the canvas can be ordered. Orders are the bridge between the game and the real world — someone (human or AI agent) decides "I want this arrangement" and places an order.

Ordered arrangements freeze on the canvas. They become permanent fixtures visible to all players — a record of what was built and valued.

## Order Flow

```
User builds or merges flowers into an arrangement
       │
       ▼
Clicks "Order" on their arrangement
       │
       ▼
Order UI shows:
  - Arrangement preview
  - AI-generated description
  - Price (calculated from flower types + quantity + level)
  - Adornments included at this level
       │
       ▼
User confirms → calls place_order reducer
       │
       ▼
SpacetimeDB:
  - Creates FlowerOrder (status: "pending")
  - Sets FlowerSession status → "ordered"
  - Snapshots arrangement_json into order
       │
       ▼
All clients see:
  - The flower stops moving (physics body removed)
  - Visual indicator: "ORDERED" badge
  - Appears in the order ticker at the bottom
       │
       ▼
Order appears in the live order feed
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

## Agent Orders

AI agents can place orders through the SpacetimeDB SDK. An agent:

1. Connects to SpacetimeDB with its own Identity
2. Subscribes to flower_session table
3. Browses available arrangements
4. Calls `place_order` reducer on any arrangement it likes

This enables:
- Automated ordering based on criteria ("order any bouquet with roses under $100")
- Integration with external systems (e-commerce platforms, chatbots)
- Agent-driven curation (an AI agent that merges flowers and orders the best results)

Agent orders appear in the same order feed as human orders. There's no distinction in the UI — an order is an order.

## Order Feed

The order feed is a live-updating ticker that shows every order placed by every user:

```
[Sunset Harvest — 10 flowers — $135 — @user123]
[Morning Dew — 3 flowers — $30 — @agent_curator]
[Wild Meadow — 25 flowers — $220 — @user456]
```

The feed scrolls at the bottom of the PixiJS canvas. Each entry:
- Shows the arrangement name (AI-generated)
- Flower count and price
- Who ordered it (identity, anonymized)
- Clicking pans to the ordered arrangement on the canvas

## Fulfillment (Future)

Currently orders are in-game only — they mark an arrangement as valued and freeze it on the canvas. Future integration with the ISLO platform (from normalflowers) could route orders to real florists for physical delivery.

The data model is ready for this — `FlowerOrder` has a `status` field that can track real fulfillment states, and `arrangement_snapshot` captures exactly what was ordered.
