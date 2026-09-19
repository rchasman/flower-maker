# The Merge Mechanic

Merging happens inside your own zone in the designer. You drag one of your
flowers onto another. The two sessions become one child session that carries
both flowers.

## How a merge starts

`FlowerCanvas` tracks the dragged flower each frame. While it moves, the
nearest other flower within `MERGE_RANGE` (3 times `FLOWER_BASE_RADIUS`, 210
px) is the merge target and the cursor changes. Releasing the flower over a
target calls `onMergeDrop(dragSid, targetSid)`, which `DesignerView` hands to
`handleMerge` in `client/src/spacetime/bridge.ts`. A pending pair is not
submitted twice.

Drop is the only trigger. The WASM physics does not detect merges.

## What happens

```
Drop flower A on flower B
       │
handleMerge reads both specs and sessions from the local cache
       │
POST /api/flower/combine  (spec_a, spec_b, total_count, level, parent_adornments?)
       │
AI returns one JSON: name, description, adornments, sprite_hints, adornment_spec, harmony_note
       │
merge_sessions(session_a_id, session_b_id, ai_arrangement_json)
       │
Server: parses both YAML specs, genetics::cross(a, b, seed) with seed from ctx.rng()
Server: inserts the child session at the midpoint, prompt "A × B"
Server: stores the AI JSON as part_override "arrangement"
Server: stores every constituent spec as part_override "constituent:N"
Server: sets both parents to Complete
       │
Every client: parents wilt out (WASM wilt animation), the child blooms in
```

`total_count` is the sum of both `flower_count` values. The child's
`arrangement_level` comes from `arrangement_level_for_count` and its
`generation` is the larger parent generation plus one.

No cross-player merging: `merge_sessions` requires the caller to own both
sessions and both must be in `Designing` status.

## Arrangement levels

`arrangement_level_for_count` in `server/spacetimedb/src/lib.rs`, with the
names the client uses:

| Flowers   | Level | Name         | Renderer adornment (without an `adornment_spec`) |
| --------- | ----- | ------------ | ------------------------------------------------ |
| 0 to 1    | 1     | stem         | none                                             |
| 2 to 3    | 2     | group        | tie                                              |
| 4 to 6    | 3     | bunch        | wrap                                             |
| 7 to 9    | 4     | arrangement  | vase                                             |
| 10 to 19  | 5     | bouquet      | vase                                             |
| 20 to 49  | 6     | centerpiece  | vase on a pedestal                               |
| 50 and up | 7     | installation | vase on a pedestal                               |

When the combine response carries an `adornment_spec`, the renderer draws its
container, accent and base instead. See `docs/05-ai-integration.md` for the
schema and `docs/06-rendering.md` for the drawing.

## Genetics: `cross`

`crates/flower-core/src/genetics.rs`. `cross(parent_a, parent_b, seed)` is
deterministic for a seed. The RNG is the LCG that `api/flower/seed.ts` mirrors.
Every draw is either a coin flip between the parents (`next() > 0.5`) or a
lerp between two numbers or two colors with a random `t`.

| Field                                                   | Rule                                                                                                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                                  | `"{a.name} × {b.name}"`                                                                                                                   |
| `species`                                               | one parent                                                                                                                                |
| `taxonomy`                                              | the same parent as `petals.layers`, so the family agrees with the petals                                                                  |
| `petals.layers`                                         | one parent's layers, with their `pattern` and `fusion`                                                                                    |
| `petals.symmetry`, `symmetry_order`, `divergence_angle` | one parent, drawn separately from the petal parent                                                                                        |
| `petals.stage`                                          | always `Bloom`                                                                                                                            |
| `petals.bloom_progress`, `wilt_progress`                | 0.0                                                                                                                                       |
| `reproductive`                                          | one parent                                                                                                                                |
| `structure.stem`                                        | `height`, `thickness`, `curvature`, `internode_length` and `color` lerped; `thorns`, `surface`, `branching`, `style` from one parent each |
| `structure.sepals`, `receptacle`                        | one parent each                                                                                                                           |
| `structure.peduncle`                                    | every field lerped                                                                                                                        |
| `structure.buds`                                        | one parent                                                                                                                                |
| `foliage`                                               | one parent, with its `variegation`                                                                                                        |
| `ornamentation`                                         | one parent                                                                                                                                |
| `roots`                                                 | `pattern` and `luminescence` from one parent, numbers and color lerped, `mycorrhizal` is the OR                                           |
| `aura`                                                  | both present: kind from one, numbers and color lerped; one present: kept with probability 0.7; none: none                                 |
| `personality`                                           | numbers lerped, enums from one parent each                                                                                                |
| `inflorescence.kind`                                    | one parent                                                                                                                                |
| `inflorescence.head_count`                              | lerped and rounded, at least 1                                                                                                            |
| `inflorescence.head_scale`, `spread`                    | lerped                                                                                                                                    |

The tests check that a child's family follows the parent that gave its petals,
that the stage is `Bloom`, and that the head count stays at least 1.

## Physics after a merge

The WASM `wireToWasm` bridge sees the parents move to `Complete` and starts
their wilt animation; when it ends their bodies are removed. The child session
arrives as a new `Designing` row and gets a new body at its position.
`body_params(spec)` sizes it from the child's stem and `inflorescence.head_count`
(`docs/04-part-catalog.md`, Physics). A child made of several flowers renders
as an arrangement from its `constituent:N` overrides.

## Splitting

`split_constituent(session_id, index)` moves one constituent out into a new
standalone session and re-indexes the rest. `remove_constituent` deletes one
constituent. Both refuse to act on the last flower of a session.
