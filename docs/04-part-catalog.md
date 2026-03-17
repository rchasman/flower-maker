# Part Catalog

## Overview

The catalog is the vocabulary of the game. Every flower on the canvas is assembled from parts defined in the catalog. There are ~50 standard flower types that ship with the game, and every user can fork any part to create their own variant.

## Standard Flower Types

Seeded from the hyper-flowers botanical taxonomy. Each type has:

- **Name**: human-readable (e.g., "Rose", "Sunflower")
- **Kind**: what role this part plays ("petal", "stem", "leaf")
- **Colors**: which color variants exist
- **Physics archetype**: how it behaves in the simulation
- **Occasions**: what it's traditionally used for
- **Season**: when it's in peak season

### The 50+ Types

**Common** (well-known, high sprite priority):
Rose, Tulip, Sunflower, Orchid, Lily, Daisy, Lavender, Peony, Carnation, Hydrangea, Iris, Chrysanthemum

**Garden** (popular, medium priority):
Dahlia, Ranunculus, Sweet Pea, Freesia, Anemone, Zinnia, Snapdragon, Stock, Lisianthus, Delphinium, Aster, Marigold

**Accent & Filler** (supporting roles in arrangements):
Baby's Breath, Eucalyptus, Queen Anne's Lace, Waxflower, Solidago, Hypericum, Statice, Limonium, Bupleurum, Heather, Yarrow

**Statement** (large, dramatic):
Gladiolus, Bird of Paradise, Protea, Amaranthus, Bells of Ireland, Liatris, Larkspur, Foxglove

**Pom & Spray** (small, clustered):
Spray Rose, Mini Carnation, Button Pom, Cushion Pom, Fuji Mum, Kermit Pom, Monte Casino Aster, Matsumoto Aster, Spray Mum

## Physics Archetypes

Every flower type maps to one of four physics presets. These determine how the flower's rigid body behaves in rapier2d.

| Archetype | Mass | Drag | Collider | Examples |
|-----------|------|------|----------|----------|
| **Upright** | Medium | Low | Tall oval | Rose, Tulip, Iris, Lily, Gladiolus |
| **Bushy** | Heavy | Medium | Wide circle | Hydrangea, Peony, Chrysanthemum, Dahlia |
| **Delicate** | Light | High | Small circle | Daisy, Freesia, Sweet Pea, Baby's Breath |
| **Sturdy** | Heavy | Low | Large oval | Sunflower, Bird of Paradise, Protea |

Archetype affects how flowers move on the canvas:
- **Delicate** flowers flutter and drift — easy to push into merges
- **Sturdy** flowers are anchors — they resist movement, other flowers collide into them
- **Bushy** flowers take up space — they trigger merges more often because of larger colliders

## Forking

Any user can fork any part. The flow:

```
User browses catalog
       │
       ▼
Selects a standard Rose petal
       │
       ▼
Opens PartEditor → adjusts color from red to deep burgundy, scales up 20%
       │
       ▼
Saves → calls fork_part reducer
       │
       ▼
New PartDefinition created:
  - parent_id = original rose petal ID
  - author = this user
  - is_standard = false
  - visual_json has modified colors/scale
  - physics_json inherited from parent (or tweaked)
       │
       ▼
Original's fork_count increments
       │
       ▼
User's flower now uses the forked part
Other users can discover and adopt it
```

### Fork Discovery

The catalog browser shows:
- **Standard parts** — the 50+ shipped types
- **Popular forks** — sorted by fork_count (forks of forks count)
- **My forks** — parts created by the current user
- **Fork tree** — given any part, see all descendants

### What's Forkable

The `visual_json` and `physics_json` fields are the forkable properties:

**Visual** (what it looks like):
```json
{
  "sprite_id": "rose_petal_01",
  "color_primary": "#dc2626",
  "color_secondary": "#991b1b",
  "scale": 1.0,
  "opacity": 1.0,
  "rotation_offset": 0
}
```

**Physics** (how it moves):
```json
{
  "mass": 1.0,
  "friction": 0.3,
  "restitution": 0.2,
  "linear_drag": 0.5,
  "angular_drag": 0.8
}
```

Users can tweak any of these values. The part kind and flower type remain immutable — a forked rose petal is still a rose petal.

## Adornment Parts

Beyond flower types, the catalog includes **adornment parts** that unlock at higher arrangement levels. These are not flowers — they're the dressing that wraps arrangements.

| Kind | Unlocks At | Examples |
|------|-----------|----------|
| `"wrap"` | Level 2 (group) | Plastic wrap, kraft paper, tissue paper |
| `"tie"` | Level 2 (group) | Rubber band, twine, ribbon |
| `"paper"` | Level 3 (bunch) | Decorative paper, cellophane |
| `"ribbon"` | Level 3 (bunch) | Satin ribbon, burlap ribbon |
| `"vase"` | Level 4 (arrangement) | Glass vase, ceramic pot, mason jar |
| `"card"` | Level 5 (bouquet) | Gift card, tag |
| `"box"` | Level 5 (bouquet) | Hat box, gift box |
| `"stand"` | Level 6 (centerpiece) | Pedestal, candelabra |
| `"greenery"` | Level 6 (centerpiece) | Eucalyptus, fern, ivy |
| `"structure"` | Level 7 (installation) | Arch, frame, trellis |

Adornments are also forkable. Want a neon-pink plastic wrap? Fork the standard one.

## Seeding

The `seed_catalog` reducer runs on `init()` — the first time the SpacetimeDB module is published. It inserts all standard PartDefinitions from data defined in the `flower-core` crate.

The seed data is compiled into the WASM module, not fetched from an external source. This means the catalog is available immediately, with no network dependency.
