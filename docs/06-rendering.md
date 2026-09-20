# Rendering

Every flower on screen is drawn from its spec by the modules in
`client/src/flower/`. There are no sprites; the only shaders are the filters
in `client/src/flower/shaders/`, which shade what the plan drew. The pipeline
has two steps:

1. `createFlowerPlan(spec, sid)` in `render.ts` parses the YAML spec and builds
   a `FlowerPlan`: scale independent geometry as `DrawCmd` lists plus resolved
   colors. Every random choice comes from `sidHash(sid, salt)`, so the same
   session always draws the same flower.
2. `drawFlowerFromPlan(g, plan, r, alpha)` in `pixi-draw.ts` replays the plan
   onto a PixiJS `Graphics` at radius `r` pixels.

A `DrawCmd` (`geometry.ts`) is `M`, `L`, `C` (cubic) or `Z`. Plans are cached
per session and rebuilt only when the spec changes.

## Modules

| Module             | Builds                                                                      |
| ------------------ | --------------------------------------------------------------------------- |
| `render.ts`        | spec parsing, `FlowerPlan`, `createFlowerPlan`, `createArrangementPlan`     |
| `petal.ts`         | petal frames, width profiles per `PetalShape`, edge modifiers, outlines     |
| `patterns.ts`      | `generatePetalMarks`: marks in the petal-local frame                        |
| `corolla.ts`       | `generateCorolla`: one fused cup with lobes and a throat                    |
| `inflorescence.ts` | `layoutInflorescence`: where the secondary heads sit and their pedicels     |
| `lifeStage.ts`     | stage profiles, `stageLayers`, `buildSeedHead`, `generateBuds`              |
| `effects.ts`       | particles, pollen, bracts, nectary, iridescence, bioluminescence            |
| `leaf.ts`          | leaf outlines, veins and variegation polygons                               |
| `stem.ts`          | stem outline, surface strokes, branches, `stemPointAt`                      |
| `color.ts`         | hex color math: darken, lighten, desaturate, hue rotate                     |
| `pixi-draw.ts`     | `drawFlowerFromPlan`, `drawArrangementFromPlan`, `drawAura`, `drawGlow`     |
| `lighting.ts`      | the shader's uniforms from a plan: head lights, depth layers, bloom sizes   |
| `scene.ts`         | `createFlowerScene`: one flower's layers and filters on a pixi stage        |
| `shaders/`         | `PlantLightFilter`, GLSL and WGSL programs for head volume and translucency |

## Parsing

`parseFlowerSpec` reads `petals.layers[]` (count, shape, arrangement, edge,
texture, width, length, curvature, curl, droop, opacity, `angular_offset` in
degrees, the color gradient, vein pattern, `pattern`, `fusion`), the flat
symmetry (`petals.symmetry`, `symmetry_order`, `divergence_angle`),
`petals.stage`, `taxonomy.family`, `inflorescence`, the receptacle size, the
pistil color, stamens, pollen and nectary, and the sepals. `parseEffects` reads
thorns, dewdrops, aura, particles, iridescence and bioluminescence.
`parseFoliage` reads `foliage.leaves[]` with the Rust field names (`shape`,
`size`, `color`, `serration`, `droop`, `curl`, `translucency`, `position`,
`side`, `angle_offset`, `variegation`, `vein_pattern`), at most 6 leaves.
`parseBracts` reads up to 12 bracts, `parseBuds` up to 6 buds.

Every enum value goes through `variantOr(list, value)`: an unknown string
becomes the Rust default. Missing numbers take the Rust defaults. A spec with no
layers gives `EMPTY_PLAN`, a plan with nothing to draw but a hit area.

## The petal frame

`createPetalFrame` (`petal.ts`) builds a frame for one petal: its angle, spine
samples along the length, and the width profile of its `PetalShape` with the
`EdgeStyle` modifier applied. Every petal, corolla lobe, sepal and showy bract
is a frame. `petalLocalToFlower(t, u, frame)` maps a petal-local point, `t`
along the length in [0, 1] and `u` across the width in [-1, 1], to flower
space through the width profile. Anything placed in `(t, u)` lands inside the
outline without a mask, whatever the shape or edge.

`computePetalAngles` places a layer's petals by `PetalArrangement`: an even
ring for Radial and Valvate, the golden angle divergence with a compressed
radial spread for Spiral, a mirrored top arc for Bilateral, banner, wings and
keel for Papilionaceous, 90 degree steps for Cruciform, a 240 degree arc for
Zygomorphic, a progressive twist for Imbricate and Contorted, grouped whorls
for Whorled. Each petal gets small length, width, curvature and curl jitter from
`sidHash`.

Per petal the plan stores the outline, the lit color (`lightTint` toward
`LIGHT_ANGLE`), highlight, outline, vein, light and shadow colors, the texture
and its two texture colors (`TEXTURE_COLORS`), the gradient stop sub-paths,
the veins (`generatePetalVein` by `VeinPattern`), the marks and the
iridescence sheen colors.

## Patterns

`generatePetalMarks(pattern, frame, seed)` lays marks out in `(t, u)` and maps
them through the frame. Every mark of one petal shares a color and alpha, so
they come back as one fill with many sub-paths.

| PatternKind  | Placement                                                                 |
| ------------ | ------------------------------------------------------------------------- |
| Spots        | `density * 12` round marks, radius from `scale`, over `t` in [0.15, 0.85] |
| Speckle      | `density * 48` tiny marks over `t` in [0.1, 0.9], `scale` ignored         |
| Stripes      | lines along `t` from the base, count from `density`, width from `scale`   |
| Flame        | tapering streaks from the base to `extent` of the length                  |
| ThroatBlotch | one filled region from the base to `extent`                               |
| Picotee      | a band along the edge, width from `scale`                                 |
| Band         | a band across the petal at `t = extent`, width from `scale`               |

Interior marks stop at `u = 0.85`; marks that reach the edge stop at
`u = 0.97`. A pattern with no color of its own takes the petal color darkened.

## Fused corolla

A layer whose `fusion.kind` is not `Free` is drawn as one cup seen from above
(`corolla.ts`). The body is one closed scalloped outline, the throat is the
dark opening at the center, and `count` lobes sit on the rim. Each lobe is a
petal frame, so texture, marks and veins draw on it like a free petal. The
fused fraction is `depth`, clamped to [0.1, 0.9]. The cup profiles:

| FusionKind | Profile from base to rim                        | Lobe scale |
| ---------- | ----------------------------------------------- | ---------- |
| Bell       | widens, widest at three quarters, curves in     | 1          |
| Trumpet    | narrow tube flaring outward, widest at the rim  | 1          |
| Urn        | bulges past the middle, narrows to a rim inside | 0.8        |
| Funnel     | widens linearly                                 | 1          |
| Tube       | stays narrow                                    | 0.6        |

The center disc is clamped to the narrowest throat radius so the center sits
inside the tube. `pixi-draw` fills the body with a radial `FillGradient` from
the throat to the rim (cached per plan in a `WeakMap`), then draws the lobes
and the throat.

## Inflorescence

`layoutInflorescence` (`inflorescence.ts`) returns the florets and their
pedicels. Floret 0 is the primary head at the origin with scale 1. Every other
floret is the same head plan drawn at an offset, scale (`head_scale`, at least
0.2) and tilt. Heads may occupy the upper 70 percent of the stem. Distance from
the axis follows the head size and `spread`.

| Kind     | Heads drawn | Layout                                              |
| -------- | ----------- | --------------------------------------------------- |
| Solitary | 1           |                                                     |
| Spike    | 1 to 12     | heads on the main stem, no stalks                   |
| Raceme   | 1 to 12     | short alternating stalks up the stem                |
| Umbel    | 1 to 12     | stalks from one point at the top, heads level       |
| Corymb   | 1 to 12     | stalks from different points, heads level           |
| Panicle  | 1 to 12     | branched stalks with twigs, pyramid                 |
| Spray    | 3 to 5      | arched branches from the upper stem, primary on top |

`drawFlowerFromPlan` sorts the florets by `offsetY` so the highest head is
drawn first and lower heads overlap it. The stem's `branching` (set by the
generator from the inflorescence kind) adds side branch outlines through
`generateBranches`.

## Life stages

`STAGE_PROFILES` (`lifeStage.ts`) says what a head does at each
`petals.stage`, and `stageLayers` rewrites the petal layers:

| Stage    | Petal layers                                                                                | Center                                                                                                             | Sepals               |
| -------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------- |
| Bud      | one closed shell of 3 to 5 ovate petals, short and strongly cupped                          | hidden                                                                                                             | cupped, wide, longer |
| Opening  | the outer layer only, shorter and more cupped                                               | drawn                                                                                                              | half cupped          |
| Bloom    | as authored                                                                                 | drawn                                                                                                              | as authored          |
| Fading   | every layer with a fifth fewer petals, more droop, 0.85 opacity, colors desaturated by 0.35 | drawn                                                                                                              | reflexed             |
| SeedHead | none                                                                                        | `buildSeedHead`: an enlarged stippled receptacle with seeds, or a pappus of pale hairs for Asteraceae and Apiaceae | reflexed             |

Stamens, pollen and the nectary are drawn only while the throat is open
(Opening, Bloom, Fading). `bloom_progress` and `wilt_progress` are not read by
the renderer; the WASM `FlowerAnimation` scales and fades the whole flower on
entry and exit.

`generateBuds` draws `structure.buds[]` as side buds: a pedicel from the stem
at `position`, an ovate sepal shell on the given `side` with two seams, and
the petal color showing between the sepals once `openness` passes 0.6.

## Effects

| Effect            | Source                                                    | Drawn as                                                                                                                                                                                                                   |
| ----------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Showy bracts      | `foliage.bracts[]` with `showy: true`                     | a petal-like ring behind the sepals, twice as many blades as bracts listed, at least 3, each `LeafShape` mapped to a `PetalShape`                                                                                          |
| Scale bracts      | `foliage.bracts[]` with `showy: false`                    | small green leaves on the stem, alternating sides                                                                                                                                                                          |
| Pollen            | `reproductive.pollen`                                     | particle seeds emitted from the anther positions; `luminosity` adds a glow halo per particle                                                                                                                               |
| Nectary           | `reproductive.nectary`                                    | static fills or rings under the pistil by `NectaryPosition` (a disc for Basal, throat blotches on the petals for Petaline, on the sepals for Sepaline, a ring for Annular, a spur ellipse for Spurred); `glow` adds a halo |
| Iridescence       | `ornamentation.iridescence` naming `petals` (or no parts) | two offset sheen fills per petal: the lit color hue rotated by how squarely the petal faces the light, and its complement                                                                                                  |
| Bioluminescence   | `ornamentation.bioluminescence`                           | glow geometry by `BioPattern`: the veins (Veins, Fractal), the outlines (Edges, Whole, Pulse), or pattern marks (Spots, Rings, Stripes, Constellation)                                                                     |
| Variegation       | `foliage.leaves[].variegation`                            | a second color polygon set on the leaf: margin band, center blaze, splash blobs or cross stripes                                                                                                                           |
| Leaf translucency | `foliage.leaves[].translucency`                           | leaf alpha `1 - translucency * 0.45`, veins lightened instead of darkened                                                                                                                                                  |
| Stem surface      | `structure.stem.surface` and `style`                      | bark lines for Woody and Leathery, a highlight line for Waxy, dots for Rough and Frosted, ticks for Hairy and Fuzzy, chevrons for Scaled; nothing for the other textures                                                   |
| Thorns            | `structure.stem.thorns`                                   | up to 8 triangles along the stem, count from `density`                                                                                                                                                                     |
| Dewdrops          | `ornamentation.dewdrops[]`                                | up to 8 highlights per entry on the head, distance by `DewdropPlacement`                                                                                                                                                   |
| Particles         | `ornamentation.particles[]`                               | seeds per entry; drawn per frame                                                                                                                                                                                           |
| Aura              | `aura`                                                    | pulsing circles or triangles by `AuraKind`; drawn per frame                                                                                                                                                                |

### GPU effects

`createFlowerScene(plan)` in `scene.ts` builds every layer a flower needs and
the filters over them, once per plan; `FlowerCanvas`, `PixiMiniCanvas` and the
render harness all go through it, so a flower looks the same on every surface.
Filters are created with the scene and destroyed with it; nothing is allocated
per frame. Every custom shader ships a GLSL program and a WGSL program, so it
runs on WebGL and WebGPU alike.

| Effect             | Where                                              | How                                                                                                                                                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bloom              | the aura and glow layers                           | two `Graphics` share one `GraphicsContext`: the crisp core and, under it, a copy with a `BlurFilter` (quality 3, strength from `glowBloomStrength` and `auraBloomStrength`, which scale with the radius) at lower alpha. The glow pair is additive and rendered once into a picture. The blur never touches the plant.     |
| Head volume        | `PlantLightFilter` on the flower `Graphics`        | each head is a uniform (`headLights`: centre and radius in local pixels, strength by stage from `volumeStrength`, 0.35 for a bloom, less for a bud). The fragment finds its nearest head and shades it as a shallow cup: brighter toward `LIGHT_DIRECTION` and the rim, darker toward the shadow side and the centre well. |
| Petal translucency | the same filter                                    | `translucencyOf(head)`: the outer layer's texture (Papery, Silk, Glassy high; Waxy, Leathery, Metallic low) opened up by the thinnest layer's opacity class. The fragment lifts thin fills (low alpha), luminance edges and pale fills toward a warm white.                                                                |
| Depth              | a second picture behind the plant                  | florets with `depth > 0.5` (`isBackFloret`) draw there with their pedicels, under their own `PlantLightFilter`. The plan tints them slightly darker (`BACK_SHADE`); they are never blurred, a blur read as a smear rather than depth.                                                                                      |
| Stem cylinders     | `StalkShading` on `StemPlan` and every `StalkPlan` | `stemShading` and `stalkPlan` add a highlight line offset toward the light and a shade line away from it, each stroked half the mid half width, in a lighter and a darker tint of the stalk color.                                                                                                                         |

The filter texture's origin follows the flower's bounds, so `PlantLightFilter`
maps texture space back to the flower's local pixels through a hidden one
pixel `Sprite` at the origin and `filterManager.calculateSpriteMatrix`, the way
pixi's `DisplacementFilter` does. The head uniforms are set once per `draw`,
and the filter runs once per `refresh`, into the picture.

## Drawing order and per frame work

`drawFlowerFromPlan` draws the stem, the pedicels, the leaves and scale bracts,
the buds, then every head back to front (`drawHead`: bracts, sepals, petal
layers, dewdrops, stamens, center disc), then the particles. Its `layer`
option draws only the front florets with the plant, or only the back florets
with their pedicels, for the two pictures a scene keeps. Petals are drawn
with several passes each: the depth shadow of inner layers, the fill, the
gradient stop sub-paths, the light, shadow and highlight offsets, the texture
pass, the iridescence sheen, the marks, the veins and the outline.

`petalPassesFor(r)` picks the optional passes by the drawn radius, the plan
unchanged: below `DETAIL_RADIUS` (40 px, the zone snapshots) the texture pass,
the vein strokes and the marks are skipped, and below `SHADING_RADIUS` (24 px)
the gradient partials and the depth shadows go too. Tessellation is the cost of
a draw (earcut on every fill, `buildLine` on every stroke; 0.5 to 13 ms per
flower at r 70), so a small flower draws a fraction of the passes.

Most of a flower is static, and the static layers are **pictures**: each is
drawn into a detached `Graphics`, filtered, rendered once into its own
`RenderTexture` by `scene.refresh(renderer)`, and shown as a `Sprite`. Per
frame the stage composites sprites; no filter pass and no tessellation runs
for anything static. `scene.draw(r)` records the geometry and marks the
pictures dirty; `refresh` renders the dirty ones, sized to their bounds at the
renderer's resolution, so a picture is as sharp as the canvas. Pixi's own
`cacheAsTexture` is not used: in 8.21 a filter inside a cached container
renders nothing when an ancestor (the canvas dither) is filtered too.

| Layer                                 | Where                                                            | Per frame                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| The plant and the back florets        | two lit pictures inside `scene.flower`, the pointer target       | one sprite each                                                                                                                                    |
| Bioluminescence and a pulsing nectary | `drawBioGlow` and `drawNectaryPulse`, additive pictures in front | drawn once at full level; `bioWaveAt` and `nectaryPulseLevel` set the sprite alpha, since every alpha in the geometry is proportional to the level |
| Aura                                  | `drawAura`, its bloom pair behind the plant                      | redrawn: it pulses, shifts and flickers in shape, and its circles would give the plant a rectangular box                                           |
| Particles                             | `drawParticles`, its own `Graphics` in front                     | redrawn: they wobble, drift and fall                                                                                                               |

The effect layers have `eventMode` none, so a glow or a particle over the
plant never swallows a pointer hit.

`FlowerCanvas` draws each scene once, at the base radius, when its plan
object changes (a new plan is a new scene, so a spec edit or a streaming
partial replaces the picture). The simulation's bloom-in and wilt-out are
transforms on the scene's root: `scale` and `alpha` from the WASM loop, times
the merge bloom pulse. Nothing is re-tessellated during an animation. The hit
area is set once from the plan bounds at the base radius and follows the root
transform; the selection ring is its own `Graphics` on the stage, drawn at the
visible radius. The merge glow filter goes on the scene root, since the lit
plant inside is a finished picture.

## Arrangements

A merged session has `constituent:N` overrides. `createArrangementPlan`
builds one `FlowerPlan` per constituent, lays them out by level
(`layoutForLevel`: a straight stem for 1, a fan for group and bunch, a golden
angle spiral for arrangement and above), gives each a stem from a shared base
and one leaf, and picks an adornment. With an `adornment_spec` from the combine
endpoint the container, accent and base come from it; otherwise the level
picks one (tie for group, wrap for bunch, vase for arrangement and bouquet, a
vase on a pedestal above that), colored from `sprite_hints`.
`drawArrangementFromPlan` draws all stems, the adornment, then each member.

## The two canvases

**Designer** (`client/src/designer/FlowerCanvas.tsx`). One PixiJS
`Application`. The WASM loop (`client/src/wasm/loop.ts`) ticks rapier2d each
frame and writes position, rotation, scale and alpha per flower into a
`Float32Array` (a `SharedArrayBuffer` when the page has COOP/COEP headers, a
plain buffer otherwise). `FlowerCanvas.updateFlowers` reads the pool, gets or
builds the plan for each session id, places its scene, and moves it as
described above. Dragging a
flower calls `set_body_position` on the simulation.

**Homepage** (`client/src/homepage/PixiMiniCanvas.tsx`). Zone cards do not each
own a WebGL context. One shared offscreen `Application` renders each zone's
flowers into a `RenderTexture`, the texture is extracted to a data URL, and the
card shows an `<img>`. The snapshot builds the same scene as the designer,
draws it once, refreshes its pictures and ticks it once, so one frame of the
aura, glow and particles is in the snapshot.

## Determinism

`createFlowerPlan` and `createArrangementPlan` use no `Math.random`. Petal
jitter, mark scatter, pedicel sides, bract seeds and the arrangement layout all
come from `sidHash`, so a spec at a given session id draws the same on every
client and in every frame.
