# Part Catalog

## Generative, Not Taxonomic

Each flower is a unique AI-generated FlowerSpec with 451 lines of type definitions covering 9 subsystems: petals, reproductive, structure, foliage, ornamentation, roots, aura, personality, and color gradients.

The 50+ real flower types (rose, sunflower, daisy, etc.) serve as **templates** — pre-filled FlowerSpec defaults rooted in real botany. The AI uses these as starting points and varies from them.

## Templates

Each FlowerTemplate has:
- Botanically accurate FlowerSpec defaults
- Color variants, occasions, seasons
- Physics archetype (Upright, Bushy, Delicate, Sturdy)

Initial 5: Rose, Sunflower, Daisy, Orchid, Tulip. Expanding to 50+.

## Forking

Any user can fork any part of a FlowerSpec. The PartEditor shows editable fields (personality traits, stem properties, root depth, etc.). Modified values are saved as FlowerPartOverride rows via the `fork_part` reducer.

Forks are per-session, identified by JSON path (e.g., `personality.hardiness`).

## Physics Archetypes

| Archetype | Mass | Drag | Collider | Examples |
|-----------|------|------|----------|----------|
| Upright | 1.0 | 0.3 | 0.4 | Rose, Tulip, Iris |
| Bushy | 1.5 | 0.5 | 0.7 | Hydrangea, Peony |
| Delicate | 0.5 | 0.8 | 0.3 | Daisy, Freesia |
| Sturdy | 2.0 | 0.2 | 0.6 | Sunflower, Protea |
