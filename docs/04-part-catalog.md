# Part Catalog

The schema is `crates/flower-core/src/catalog.rs`. Every struct carries
`#[serde(default)]` and every enum has a `Default`, so a stored spec that lacks
a field still parses. `client/src/data/flower-enums.ts` lists every enum's
variants as `as const` arrays in Rust declaration order. The zod mirror
(`api/flower/specSchema.ts`), the question builders, the renderer and the part
editor import from it. The fixtures in `crates/flower-core/tests/fixtures/`
(one per family plus `contract-smoke.yaml`, written by `bun run fixtures`) are
parsed by a Rust test and by the zod mirror, which keeps the two catalogs in
step.

Colors are `{ r, g, b, a }` in 0.0 to 1.0. A `ColorGradient` is a list of
`{ position, color }` stops. Specs are stored as YAML text in
`flower_spec.spec`.

## FlowerSpec

| Field           | Type                | Notes                                   |
| --------------- | ------------------- | --------------------------------------- |
| `name`          | String              | `${mood} ${template or noun}`           |
| `species`       | String              | `${genus} ${species_name}`              |
| `taxonomy`      | Taxonomy            |                                         |
| `petals`        | PetalSystem         |                                         |
| `reproductive`  | ReproductiveSystem  |                                         |
| `structure`     | StructureSystem     |                                         |
| `foliage`       | FoliageSystem       |                                         |
| `ornamentation` | OrnamentationSystem |                                         |
| `roots`         | RootSystem          | not written by the generator, not drawn |
| `aura`          | Option\<Aura\>      |                                         |
| `personality`   | FlowerPersonality   | not written by the generator, not drawn |
| `inflorescence` | Inflorescence       |                                         |

## Taxonomy

| Field             | Type           |
| ----------------- | -------------- |
| `family`          | FlowerFamily   |
| `genus`           | String         |
| `species_name`    | String         |
| `common_name`     | String         |
| `botanical_class` | BotanicalClass |

`BotanicalClass`: Dicot (default), Monocot, Magnoliid, Basal.

`FlowerFamily`, 38 variants. `Invented` is the default and has no real family:

| Group    | Variants                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| None     | Invented                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Dicots   | Rosaceae, Asteraceae, Fabaceae, Lamiaceae, Ranunculaceae, Solanaceae, Brassicaceae, Malvaceae, Caryophyllaceae, Ericaceae, Papaveraceae, Violaceae, Primulaceae, Geraniaceae, Boraginaceae, Convolvulaceae, Apiaceae, Caprifoliaceae, Hydrangeaceae, Magnoliaceae, Paeoniaceae, Plumbaginaceae, Hypericaceae, Myrtaceae, Plantaginaceae, Gentianaceae, Campanulaceae, Nymphaeaceae, Passifloraceae, Proteaceae, Cactaceae |
| Monocots | Orchidaceae, Liliaceae, Iridaceae, Amaryllidaceae, Asparagaceae, Alstroemeriaceae                                                                                                                                                                                                                                                                                                                                         |

## Inflorescence

| Field        | Type              | Default  | Notes                                   |
| ------------ | ----------------- | -------- | --------------------------------------- |
| `kind`       | InflorescenceKind | Solitary |                                         |
| `head_count` | u32               | 1        | grows the physics collider (see below)  |
| `head_scale` | f64               | 0.5      | 0 to 1, secondary heads vs the primary  |
| `spread`     | f64               | 0.5      | 0 to 1, how far heads sit from the axis |

| InflorescenceKind | Layout                                            |
| ----------------- | ------------------------------------------------- |
| Solitary          | one head                                          |
| Spike             | heads sit on the main stem, no stalks             |
| Raceme            | short stalks alternating up the stem              |
| Umbel             | stalks from one point at the top, heads level     |
| Corymb            | stalks from different points, heads level         |
| Panicle           | branched stalks, pyramid                          |
| Spray             | branches from the upper stem, primary head on top |

## PetalSystem

| Field              | Type              | Default | Notes                                     |
| ------------------ | ----------------- | ------- | ----------------------------------------- |
| `layers`           | Vec\<PetalLayer\> | empty   | outer ring first                          |
| `bloom_progress`   | f64               | 0.0     | animation input; the generator writes 1.0 |
| `wilt_progress`    | f64               | 0.0     | animation input; the generator writes 0.0 |
| `symmetry`         | Symmetry          | Radial  |                                           |
| `symmetry_order`   | u32               | 0       | Radial order, 0 means unspecified         |
| `divergence_angle` | f64               | 137.5   | degrees, Spiral only                      |
| `stage`            | LifeStage         | Bloom   | the flower's own state as authored        |

`Symmetry`: Radial, Bilateral, Asymmetric, Spiral. It is a unit enum; the
order and the angle live on `PetalSystem`.

`LifeStage`: Bud, Opening, Bloom (default), Fading, SeedHead.

### PetalLayer

| Field            | Type             | Default | Range or notes                  |
| ---------------- | ---------------- | ------- | ------------------------------- |
| `index`          | u32              | 0       |                                 |
| `count`          | u32              | 0       | petals in this ring             |
| `shape`          | PetalShape       | Ovate   |                                 |
| `arrangement`    | PetalArrangement | Radial  |                                 |
| `curvature`      | f64              | 0.0     | -1 recurved to 1 cupped         |
| `curl`           | f64              | 0.0     | 0 flat to 1 fully curled        |
| `texture`        | SurfaceTexture   | Smooth  |                                 |
| `color`          | ColorGradient    |         |                                 |
| `opacity`        | f64              | 0.5     | 0 to 1                          |
| `vein_pattern`   | VeinPattern      | None    |                                 |
| `edge_style`     | EdgeStyle        | Smooth  |                                 |
| `width`          | f64              | 0.5     | 0.1 to 3.0                      |
| `length`         | f64              | 0.5     | 0.1 to 5.0                      |
| `angular_offset` | f64              | 0.0     | degrees from the previous layer |
| `droop`          | f64              | 0.0     | 0 upright to 1 hanging          |
| `thickness`      | f64              | 0.5     | 0.1 to 1.0                      |
| `pattern`        | PetalPattern     |         | marks on each petal             |
| `fusion`         | Fusion           |         | how the petals join             |

| Enum             | Variants                                                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PetalShape       | Ovate, Lanceolate, Spatulate, Oblong, Orbicular, Cordate, Deltoid, Falcate, Ligulate, Tubular, Fimbriate, Laciniate, Runcinate, Cuneate, Acuminate, Panduriform, Unguiculate, Flabellate, Obovate, Rhomboid, Filiform, Reniform, Sagittate |
| PetalArrangement | Radial, Spiral, Bilateral, Imbricate, Valvate, Contorted, Whorled, Papilionaceous, Cruciform, Zygomorphic                                                                                                                                  |
| SurfaceTexture   | Smooth, Velvet, Silk, Papery, Waxy, Rough, Hairy, Glassy, Crystalline, Scaled, Metallic, Pearlescent, Fuzzy, Frosted, Leathery, Powdery                                                                                                    |
| VeinPattern      | None, Parallel, Branching, Palmate, Reticulate, Dichotomous, Arcuate, Pinnate, Anastomosing                                                                                                                                                |
| EdgeStyle        | Smooth, Ruffled, Fringed, Serrated, Rolled, Undulate, Crisped, Lacerate, Lobed, Plicate, Revolute, Dentate, Erose                                                                                                                          |

### PetalPattern

| Field     | Type        | Default | Notes                                             |
| --------- | ----------- | ------- | ------------------------------------------------- |
| `kind`    | PatternKind | None    |                                                   |
| `color`   | Color       |         |                                                   |
| `scale`   | f64         | 0.5     | 0 to 1, mark size relative to the petal width     |
| `density` | f64         | 0.5     | 0 to 1, how many marks                            |
| `extent`  | f64         | 0.5     | 0 to 1, how far the marks reach from their anchor |

| PatternKind  | Marks                                |
| ------------ | ------------------------------------ |
| None         |                                      |
| Spots        | round marks spread along the petal   |
| Speckle      | many tiny marks                      |
| Stripes      | lines along the length from the base |
| Flame        | tapering streaks from the base       |
| ThroatBlotch | one filled region from the base      |
| Picotee      | band along the edge                  |
| Band         | band across the petal                |

### Fusion

| Field   | Type       | Default | Notes                                      |
| ------- | ---------- | ------- | ------------------------------------------ |
| `kind`  | FusionKind | Free    |                                            |
| `depth` | f64        | 0.5     | 0 to 1, fraction of the petal length fused |

| FusionKind | Cup profile                   |
| ---------- | ----------------------------- |
| Free       | separate petals               |
| Bell       | widens then curves in         |
| Trumpet    | widens outward                |
| Urn        | bulges then narrows           |
| Funnel     | widens linearly               |
| Tube       | stays narrow with small lobes |

## ReproductiveSystem

| Field     | Type                   |
| --------- | ---------------------- |
| `pistil`  | Option\<Pistil\>       |
| `stamens` | Vec\<Stamen\>          |
| `pollen`  | Option\<PollenSystem\> |
| `nectary` | Option\<Nectary\>      |

**Pistil**: `style` (PistilStyle), `stigma_shape` (StigmaShape), `color`,
`height` (default 0.5), `glow` (Option\<GlowEffect\>).

**Stamen**: `filament_curve` (0 to 1), `filament_color`, `anther_shape`
(AntherShape), `anther_color`, `pollen_load` (0 to 1), `height`, `sway` (0 to
1). All numeric defaults are 0.5.

**PollenSystem**: `particle_count` (default 0), `drift_speed` (0.5), `color`,
`luminosity` (0.5, glowing pollen), `dispersal` (DispersalPattern), `trail`
(false).

**Nectary**: `position` (NectaryPosition), `color`, `glow`
(Option\<GlowEffect\>), `drip_rate` (0.5).

**GlowEffect**: `intensity` (0.5), `color`, `radius` (0.5), `pulse`
(Option\<PulsePattern\>). **PulsePattern**: `speed` (0.5 Hz), `pattern`
(PulseType), `min_intensity` (0.0).

| Enum             | Variants                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------- |
| PistilStyle      | Simple, Compound, Split, Gynobasic, Capitate, Branched, Plumose                             |
| StigmaShape      | Capitate, Plumose, Fimbriate, Clavate, Discoid, Lobed, Stellate, Bifid, Trifid              |
| AntherShape      | Versatile, Basifixed, Sagittate, Didynamous, Syngenesious, Dorsifixed, Poricidal, Apiculate |
| DispersalPattern | Gravity, Wind, Burst, Spiral, Chaotic, Fountain, Vortex, Radiate                            |
| NectaryPosition  | Basal, Petaline, Sepaline, Receptacular, Spurred, Annular, Discoid                          |
| PulseType        | Sine, Heartbeat, Flicker, Breathe, Morse, Wave, Cascade, Stochastic                         |

## StructureSystem

| Field        | Type         |
| ------------ | ------------ |
| `stem`       | Stem         |
| `sepals`     | Vec\<Sepal\> |
| `receptacle` | Receptacle   |
| `peduncle`   | Peduncle     |
| `buds`       | Vec\<Bud\>   |

**Stem**: `height` (0.5), `thickness` (0.3), `curvature` (0 straight to 1
arched), `color`, `thorns` (Option\<ThornSystem\>), `internode_length` (0.5),
`surface` (SurfaceTexture), `branching` (BranchPattern), `style` (StemStyle).

**ThornSystem**: `density` (0.5), `size` (0.5), `color`, `shape` (ThornShape),
`curve` (0.0).

**Sepal**: `shape` (SepalShape), `color`, `reflex_angle` (0 closed to 180
reflexed), `texture` (SurfaceTexture), `length` (0.5), `persistent` (false).

**Receptacle**: `shape` (ReceptacleShape), `size` (0.5), `color`.

**Peduncle**: `length` (0.5), `angle` (degrees from vertical), `flexibility`
(0.5), `color`. The generator does not write it.

**Bud**: `position` (0 to 1 along the stem, default 0.5), `side` (Side),
`size` (0.3, relative to the primary head), `openness` (0 closed to 1 nearly
open).

| Enum            | Variants                                                                        |
| --------------- | ------------------------------------------------------------------------------- |
| ThornShape      | Straight, Hooked, Recurved, Bulbous, Barbed, Acicular, Stellate                 |
| BranchPattern   | None, Alternate, Opposite, Whorled, Dichotomous, Sympodial, Monopodial          |
| StemStyle       | Straight, Arching, Sinuous, Zigzag, Twining, Succulent, Woody, Trailing         |
| SepalShape      | Lanceolate, Ovate, Triangular, Leaflike, Petaloid, Aristate, Spatulate, Tubular |
| ReceptacleShape | Flat, Convex, Concave, Conical, Urceolate, Elongated, Hemispheric               |
| Side            | Left, Right                                                                     |

## FoliageSystem

| Field          | Type         | Notes                                   |
| -------------- | ------------ | --------------------------------------- |
| `leaves`       | Vec\<Leaf\>  |                                         |
| `bracts`       | Vec\<Bract\> |                                         |
| `leaf_density` | f64          | 0 to 1; the generator writes leaves / 6 |

**Leaf**: `shape` (LeafShape), `size` (0.5), `color` (ColorGradient),
`vein_pattern` (VeinPattern), `serration` (Serration), `arrangement`
(LeafArrangement), `phyllotaxis_angle` (137.5), `droop` (0.0), `curl` (0.0),
`translucency` (0.5), `position` (0 to 1 along the stem, 0.5), `side` (Side),
`angle_offset` (radians, 0.0), `variegation` (Variegation).

**Variegation**: `kind` (VariegationKind), `color`.

**Bract**: `color` (ColorGradient), `size` (0.5), `shape` (LeafShape), `showy`
(false: a small green scale on the stem; true: a petal-like ring under the
head), `position` (0 base to 1 head).

| Enum            | Variants                                                                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LeafShape       | Ovate, Lanceolate, Cordate, Palmate, Pinnate, Linear, Reniform, Hastate, Sagittate, Peltate, Acicular, Obovate, Elliptic, Oblanceolate, Deltoid, Spatulate, Orbicular, Lyrate, Cuneate, Falcate, Bipinnate |
| LeafArrangement | Alternate, Opposite, Whorled, Rosette, Basal, Distichous, Decussate                                                                                                                                        |
| Serration       | None, Fine, Coarse, Lobed, Crenate, Dentate, Doubly, Spinose, Ciliate                                                                                                                                      |
| VariegationKind | None, Edge (pale margin), Center (pale midrib), Splash (blotches), Stripe (lengthwise)                                                                                                                     |

## OrnamentationSystem

| Field             | Type                      |
| ----------------- | ------------------------- |
| `dewdrops`        | Vec\<Dewdrop\>            |
| `glow`            | Option\<GlowEffect\>      |
| `particles`       | Vec\<ParticleEffect\>     |
| `iridescence`     | Option\<Iridescence\>     |
| `bioluminescence` | Option\<Bioluminescence\> |

**Dewdrop**: `size` (0.5), `count` (0), `refraction` (0.5), `placement`
(DewdropPlacement), `surface_tension` (0.5).

**ParticleEffect**: `kind` (ParticleKind), `density` (0), `color`,
`drift_speed` (0.5), `lifetime` (seconds, 0.5), `emission_zone`
(EmissionZone), `gravity` (-1 rises to 1 falls).

**Iridescence**: `intensity` (0.5), `hue_shift_range` (degrees), `affected_parts`
(strings such as `"petals"`; empty means every part).

**Bioluminescence**: `pattern` (BioPattern), `color`, `intensity` (0.5),
`trigger` (BioTrigger). The renderer does not model the trigger.

| Enum             | Variants                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| DewdropPlacement | Random, PetalTip, VeinJunction, Edge, Center, Leaf, Stem                                                                                |
| ParticleKind     | Pollen, Firefly, Stardust, FallingPetals, Spores, Motes, Embers, Butterflies, Snowflakes, Sparkle, Seeds, Bubbles, Lightning, Raindrops |
| EmissionZone     | Center, PetalEdge, Whole, Above, Roots, Stem, Leaves, Spiral                                                                            |
| BioPattern       | Veins, Spots, Edges, Whole, Pulse, Fractal, Rings, Stripes, Constellation                                                               |
| BioTrigger       | Always, Night, Touch, Proximity, Wind, Rain, Music, Moonlight                                                                           |

## Aura

`aura` is optional. `kind` (AuraKind), `color`, `opacity` (0.5), `radius`
(0.5), `animation_speed` (0.5).

`AuraKind`: Mist, Sparkle, Ethereal, Prismatic, Shadow, Flame, Frost,
Electric, Aurora, Nebula, Crystal, Moonlight, Solar, Void, Rainbow, Storm.

## RootSystem and FlowerPersonality

Both exist in the schema, are crossed by `genetics::cross`, and are not written
by the generator or drawn by the renderer.

**RootSystem**: `pattern` (RootPattern: Taproot, Fibrous, Aerial, Rhizome,
Tuberous, Adventitious, Pneumatophore, Haustorial, Prop), `depth`, `spread`,
`thickness`, `color`, `luminescence` (Option\<GlowEffect\>), `mycorrhizal`.

**FlowerPersonality**: `growth_speed` (1.0), `hardiness`, `sociability`,
`light_preference` (LightPreference: FullSun, PartialShade, FullShade,
Nocturnal, Dappled, Dawn, Twilight), `water_need`, `wind_response`
(WindResponse: Rigid, Gentle, Dramatic, Dancing, Swirling, Trembling),
`pollinator_attraction`, `fragrance` (Option\<Fragrance\>: `intensity`,
`profile` (FragranceProfile: Sweet, Spicy, Earthy, Citrus, Floral, Musky,
Ethereal, Woody, Aquatic, Green, Powdery, Medicinal), `radius`).

## Family profiles

`api/flower/families.ts` holds one `FamilyProfile` per `FlowerFamily`. A
profile is data: what the family allows and what it looks like by default.
Index 0 of every list is the family default.

| Field                                                                                        | Meaning                                                  |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `key`, `description`, `examples`                                                             | the Rust variant and what a model reads to recognise it  |
| `typicalGenus`, `botanicalClass`                                                             | taxonomy defaults                                        |
| `petalCounts`, `layerRange`, `symmetry`, `symmetryOrder`                                     | the skeleton of the head                                 |
| `arrangements`, `shapes`, `innerShapes`, `edges`, `textures`, `veins`, `patterns`, `fusions` | legal petal values                                       |
| `inflorescences`                                                                             | legal head layouts, always includes Solitary             |
| `disc`, `receptacleSize`                                                                     | composite head with a disc; size range                   |
| `stamenRange`, `stamenProminence`, `pistilStyles`, `stigmaShapes`                            | legal center values                                      |
| `sepalCount`, `sepalShapes`                                                                  | sepals                                                   |
| `leafShapes`, `serrations`, `leafArrangements`, `leafColor`                                  | foliage                                                  |
| `stemStyles`, `thorns`, `bracts`                                                             | stem and defaults for the yes/no questions               |
| `colors`                                                                                     | the family's palette names; index 0 is the default color |
| `special`                                                                                    | None, Labellum, Corona, Spur, Umbel, Composite, Bell     |

Under `faithful` a list is the whole legal set. Under `stylized` the surface
lists (`textures`, `edges`, `veins`, `patterns`, `colors`) open to the full
enums. Under `invented` every list opens. `petalCounts`, `symmetry`,
`symmetryOrder`, `disc`, `sepalCount` and `special` never open: they are the
skeleton, and they hold at every strangeness.

`Invented` has every full list, petal counts 3, 4, 5, 6, 8, 13, 21, 34, up to 4
layers, and Radial symmetry of unspecified order.

Skeleton flags in the profiles as written:

| Flag                  | Families                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `special: Composite`  | Asteraceae (also the only `disc: true`)                                                                                                          |
| `special: Bell`       | Ericaceae, Campanulaceae                                                                                                                         |
| `special: Spur`       | Violaceae                                                                                                                                        |
| `special: Umbel`      | Apiaceae                                                                                                                                         |
| `special: Labellum`   | Orchidaceae                                                                                                                                      |
| `special: Corona`     | Amaryllidaceae                                                                                                                                   |
| `symmetry: Bilateral` | Fabaceae, Lamiaceae, Violaceae, Caprifoliaceae, Plantaginaceae, Orchidaceae                                                                      |
| `symmetry: Spiral`    | Magnoliaceae, Nymphaeaceae, Cactaceae                                                                                                            |
| `thorns: true`        | Rosaceae, Cactaceae                                                                                                                              |
| `bracts: true`        | Asteraceae, Lamiaceae, Malvaceae, Caryophyllaceae, Apiaceae, Magnoliaceae, Plumbaginaceae, Passifloraceae, Proteaceae, Iridaceae, Amaryllidaceae |
| Monocot               | Orchidaceae, Liliaceae, Iridaceae, Amaryllidaceae, Asparagaceae, Alstroemeriaceae                                                                |
| Magnoliid, Basal      | Magnoliaceae; Nymphaeaceae                                                                                                                       |

`families.test.ts` checks that there is one profile per family, that every
list is a non-empty subset of its enum, that the structural lists keep `Free`,
`None` and `Solitary`, that `petalCounts` agree with the radial symmetry order,
and that each special structure matches its family's skeleton. The
`TemplateInfo.family` field is typed as `FlowerFamily`, so an unknown family
on a template fails to compile.

## Templates

`client/src/data/templates.ts` lists 45 cut flowers. Each `TemplateInfo` has
`name`, `scientific`, `family`, an optional `inflorescence` hint, `colors`,
`occasions`, `season` and a `category` (focal, standard, accent, spray). The
template picker lists them. When a template is chosen the generator skips the
family and template questions, takes `family` from the template, lists the
`inflorescence` hint first in `inflorescence_kind`, and uses the scientific name
for `taxonomy.genus` and `species_name`.

| Family           | Templates                                                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rosaceae         | Rose, Spray Rose (Spray)                                                                                                                                                                                                                                     |
| Asteraceae       | Sunflower, Daisy, Gerbera Daisy, Aster, Chrysanthemum, Dahlia, Liatris (Spike), Solidago (Panicle), Yarrow (Corymb), Button Pom (Spray), Fuji Mum, Cushion Pom (Spray), Kermit Pom (Spray), Spray Mum (Spray), Matsumoto Aster (Spray), Solidaster (Panicle) |
| Orchidaceae      | Orchid                                                                                                                                                                                                                                                       |
| Liliaceae        | Tulip, Lily                                                                                                                                                                                                                                                  |
| Caryophyllaceae  | Carnation, Mini Carnation (Spray), Sweet William                                                                                                                                                                                                             |
| Alstroemeriaceae | Alstroemeria (Umbel)                                                                                                                                                                                                                                         |
| Hydrangeaceae    | Hydrangea (Corymb)                                                                                                                                                                                                                                           |
| Iridaceae        | Iris, Freesia (Raceme), Gladiolus (Spike)                                                                                                                                                                                                                    |
| Plantaginaceae   | Snapdragon (Spike)                                                                                                                                                                                                                                           |
| Brassicaceae     | Stock (Raceme)                                                                                                                                                                                                                                               |
| Gentianaceae     | Lisianthus (Spray)                                                                                                                                                                                                                                           |
| Ranunculaceae    | Delphinium (Spike), Ranunculus, Larkspur (Spike)                                                                                                                                                                                                             |
| Paeoniaceae      | Peony                                                                                                                                                                                                                                                        |
| Fabaceae         | Sweet Pea (Raceme)                                                                                                                                                                                                                                           |
| Lamiaceae        | Bells of Ireland (Spike)                                                                                                                                                                                                                                     |
| Hypericaceae     | Hypericum (Spray)                                                                                                                                                                                                                                            |
| Plumbaginaceae   | Statice (Panicle), Limonium (Panicle)                                                                                                                                                                                                                        |
| Myrtaceae        | Waxflower (Spray)                                                                                                                                                                                                                                            |
| Apiaceae         | Queen Anne's Lace (Umbel), Bupleurum (Umbel)                                                                                                                                                                                                                 |
| Ericaceae        | Heather (Raceme)                                                                                                                                                                                                                                             |

## Forking

`PartEditor` edits fields by JSON path (for example `petals.layers.0.count` or
`aura.kind`) and writes them through the `fork_part` reducer as
`part_override` rows with `part_path`, `override_json` and `forked_from`. It
also calls `split_constituent`, `remove_constituent` and `delete_session`.

## Physics

`crates/flower-core/src/physics.rs` sizes the rapier2d body for a spec.
`PhysicsArchetype::from_stem` reads the stem: heavy is `thickness > 0.4`, tall
is `height > 0.8`.

| Heavy | Tall | Archetype | Mass | Collider radius (px) |
| ----- | ---- | --------- | ---- | -------------------- |
| no    | no   | Delicate  | 0.5  | 20                   |
| no    | yes  | Upright   | 1.0  | 27                   |
| yes   | no   | Bushy     | 1.5  | 43                   |
| yes   | yes  | Sturdy    | 2.0  | 39                   |

Radii are smaller than the drawn head (`FLOWER_BASE_RADIUS` is 70 px) so
flowers overlap on screen before the bodies touch.

`body_params(spec)` then scales both by the inflorescence: with `n` extra
heads (`head_count - 1`) the radius is multiplied by `min(1 + 0.15 n, 2.5)` and
the mass by `min(1 + 0.1 n, 3.0)`. A seven head spray has 1.9 times the
radius and 1.6 times the mass of a single stem.
