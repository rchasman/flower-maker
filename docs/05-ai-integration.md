# AI Integration

The API has three routes (`api/index.ts`, port 9200, `/api` prefix stripped):

| Route                       | Model call                                       | Output                  |
| --------------------------- | ------------------------------------------------ | ----------------------- |
| `POST /api/flower/generate` | typed questions, answered by Jev or a text model | NDJSON stream of specs  |
| `POST /api/flower/combine`  | `streamText` with `Output.object`                | text stream of one JSON |
| `POST /api/flower/order`    | none                                             | one JSON payload        |

Every model call goes through the Vercel AI Gateway. `AI_GATEWAY_API_KEY` is
the only secret the API needs.

## Generate: the family-first pipeline

A model never writes a FlowerSpec. It answers typed questions about the
request, and code assembles the spec from the answers. The same questions go
to every model. The pipeline lives in `api/flower/`:

| File            | Role                                                                       |
| --------------- | -------------------------------------------------------------------------- |
| `families.ts`   | `FAMILIES`: one `FamilyProfile` per Rust `FlowerFamily` variant, data only |
| `questions.ts`  | `stageOneQuestions()` and `stageTwoQuestions()`                            |
| `answering.ts`  | the model seam: `jevSource` and `textModelSource`                          |
| `seed.ts`       | `seedFromPrompt` (FNV-1a) and `createRng` (the genetics LCG)               |
| `assemble.ts`   | `assembleSpec`: profile plus answers plus seed to a complete spec          |
| `specSchema.ts` | zod mirror of `catalog.rs`; every assembled spec is parsed by it           |
| `pipeline.ts`   | `generateFlower`: runs both stages, yields one `Snapshot` per answer set   |
| `generate.ts`   | the HTTP handler and the NDJSON stream                                     |
| `lists.ts`      | index helpers that throw instead of returning undefined                    |

### Request body

```json
{
  "prompt": "a bioluminescent orchid with frost aura",
  "template_name": "Orchid",
  "model": "typesafe-ai/jev"
}
```

`template_name` is optional. `model` defaults to `DEFAULT_MODEL`
(`typesafe-ai/jev`) and is a full gateway id.

### Stage one

Four choice questions (`stageOneQuestions`):

| Id            | Options                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `family`      | the 38 `FlowerFamily` variants; each criterion is the profile description plus examples             |
| `template`    | the 45 templates by name (criterion: the scientific name) plus `none`                               |
| `strangeness` | `faithful`, `stylized`, `invented`                                                                  |
| `mood`        | Midnight, Dawn, Frost, Ember, Velvet, Wild, Ghost, Solar, Coral, Storm, Silk, Nebula, Garden, Royal |

When the body names a template, `family` and `template` are not asked. The
template decides both.

`resolveLineage` in `pipeline.ts` turns the answers into a lineage. The family
comes from the requested template, else from the `family` answer, else
`Invented`. A template the model picked only counts when its family agrees with
the family answer. `strangeness` and `mood` fall back to the first option.

### Stage two

`stageTwoQuestions(profile, strangeness, template)` builds one question per id
in `STAGE_TWO_IDS` (`assemble.ts`), in this order:

| Group    | Ids                                                                                                                                                                                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Petals   | `outer_shape`, `inner_shape`, `petal_count_class`, `layer_count`, `pose`, `width_class`, `droop`, `edge_style`, `texture`, `vein_pattern`, `opacity`, `outer_base_color`, `outer_tip_color`, `inner_base_color`, `inner_tip_color`, `gradient_direction`, `pattern_kind`, `pattern_color`, `fusion_kind` |
| Head     | `inflorescence_kind`, `head_count_class`, `life_stage`, `bud_count_class`                                                                                                                                                                                                                                |
| Center   | `stamen_prominence`, `filament_color`, `anther_color`, `stigma_shape`, `pistil_color`, `receptacle_color`, `pollen_drift`, `nectary_glow`                                                                                                                                                                |
| Sepals   | `sepal_color`, `sepal_reflex`, `bracts`, `bract_color`                                                                                                                                                                                                                                                   |
| Stem     | `stem_style`, `stem_height`, `stem_thickness`, `stem_color`, `stem_surface`, `has_thorns`, `thorn_shape`                                                                                                                                                                                                 |
| Leaves   | `leaf_shape`, `serration`, `leaf_color`, `leaf_variegation`, `variegation_color`, `leaf_count_class`, `leaf_droop`, `leaf_vein`, `leaf_translucency`                                                                                                                                                     |
| Ornament | `dewdrops`, `aura_kind`, `aura_color`, `particle_kind`, `particle_color`, `iridescence`, `bioluminescence`                                                                                                                                                                                               |
| Name     | `name_noun`                                                                                                                                                                                                                                                                                              |

Seven ids are yes/no questions: `pollen_drift`, `nectary_glow`, `bracts`,
`has_thorns`, `leaf_translucency`, `iridescence`, `bioluminescence`. Every
other id is a choice.

Class words stand in for numbers so a model never picks a float:

| Id                           | Options                                         | Assembled value                                             |
| ---------------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| `petal_count_class`          | few, some, many, dense                          | targets 4, 6, 13, 34; snapped to the profile's legal counts |
| `layer_count`                | single, double, triple                          | 1, 2, 3 rings, clamped to the profile's `layerRange`        |
| `pose`                       | recurved, open, cupped, tight                   | curvature and curl per ring                                 |
| `width_class`                | strap, normal, broad                            | width 0.5, 1, 1.5                                           |
| `droop`                      | upright, relaxed, hanging                       | 0.05, 0.25, 0.6                                             |
| `opacity`                    | solid, translucent, glassy                      | 1, 0.75, 0.5                                                |
| `gradient_direction`         | base_to_tip, tip_to_base, edge_band             | two or three gradient stops                                 |
| `head_count_class`           | single, few, several, many                      | 1, 2 to 4, 5 to 8, 9 to 15 heads                            |
| `bud_count_class`            | none, one, several                              | 0, 1, 3 side buds                                           |
| `stamen_prominence`          | hidden, visible, prominent, brush               | a fraction of the profile's `stamenRange`                   |
| `sepal_color`                | green, matching, contrasting, dark              | leaf color, petal base, petal tip, darkened leaf color      |
| `sepal_reflex`               | closed, spread, reflexed                        | 20, 90, 160 degrees                                         |
| `stem_height`                | short, medium, tall                             | 0.4, 0.6, 0.85                                              |
| `stem_thickness`             | thin, normal, thick                             | 0.2, 0.3, 0.45                                              |
| `stem_color`                 | green, red, purple, black, silver, brown        | one hex each                                                |
| `leaf_color`                 | light, dark, blue_green, bronze, purple, silver | one hex each                                                |
| `leaf_count_class`           | sparse, normal, lush                            | 2, 3, 5 leaves                                              |
| `leaf_droop`                 | level, relaxed, hanging                         | 0.05, 0.25, 0.6                                             |
| `dewdrops`                   | none, few, many                                 | 0, 4, 12 drops                                              |
| `aura_kind`, `particle_kind` | `none` plus the enum                            | an `Aura` or one `ParticleEffect`, or nothing               |

Every petal, pattern, bract, aura and particle color question uses the same
palette of 28 named colors (`PALETTE_NAMES` in `families.ts`). The assembler
converts the name to `{r, g, b, a}`.

Choice lists are filtered before the question is built. `PROFILE_LIST_FOR_ANSWER`
maps an id to the profile list that makes an answer legal (`outer_shape` to
`shapes`, `pattern_kind` to `patterns`, every color id to `colors`, and so on).
`legalList(profile, strangeness, listName)` returns the profile list or the
full enum:

| Strangeness | Lists that open to the full enum                   |
| ----------- | -------------------------------------------------- |
| `faithful`  | none                                               |
| `stylized`  | `textures`, `edges`, `veins`, `patterns`, `colors` |
| `invented`  | every list                                         |

A question whose filtered list has fewer than two options is not asked. The
assembler takes the value. A template's `inflorescence` hint is listed first in
`inflorescence_kind`, and is the default when that question goes unanswered.

### The answering seam

`AnswerSource = (questions, state) => AsyncIterable<PartialAnswers>`. Both
sources take the same `Questions` map and yield answer sets keyed by id.

**Jev** (`jevSource`). One `experimental_evaluate({ model, state, questions })`
call. A choice answer yields its `choice`, a boolean answer yields
`probability > 0.5`. The source yields once.

**Text models** (`textModelSource`). `buildAnswerSchema` turns the question map
into a zod object: a choice becomes `z.enum` of the criteria keys, a boolean
becomes `z.boolean`. The source calls `streamText` with `floristInstructions`
(one line per question, `id: instructions (option: description, ...)`), the
request as the prompt, and `output: Output.object({ schema })`. It yields
`filterPartial` of every value in `partialOutputStream`, then of the awaited
`output`. `filterPartial` drops a choice value that is not a criteria key,
because a streamed partial can hold a prefix of an option name, and drops a
boolean that has not closed yet. `NoObjectGeneratedError` becomes a plain
error that says the model did not return a complete answer set.

### Assembly and seeding

`seedFromPrompt(prompt)` is FNV-1a 32 bit over the UTF-8 bytes.
`createRng(seed)` is the LCG from `crates/flower-core/src/genetics.rs`
(multiplier 6364136223846793005, increment 1442695040888963407, output bits
33 and up over 2^31), run on BigInt so the same seed gives the same sequence in
both languages.

`assembleSpec({ profile, strangeness, answers, stageOne, seed, template })`:

1. `drawJitter` takes every random value once, in one fixed order: a layer
   factor, six values for each of up to 5 layers, three for each of up to 6
   leaves, one for each of up to 40 stamens, three for each of up to 4 buds,
   then head count, head scale, spread, receptacle, stem height, sepal length,
   pollen count, noun and epithet. An answer changes only the part it names.
2. `resolveAnswers` fills every stage two id. A value is kept when it parses
   and is in the legal list for the profile and strangeness. Otherwise the
   profile default is used: index 0 of each profile list, the family's first
   palette color, `Bloom`, no buds, no aura, the template's inflorescence hint.
   Stage one alone therefore renders the family archetype.
3. Jitter amplitude follows strangeness: faithful 0.5, stylized 1.0,
   invented 1.5. Only `invented` may exceed the profile's `layerRange` by one
   ring.
4. Petals: the outer count is the legal count nearest the class target. Inner
   rings shrink by a factor in [0.6, 0.8]; a radial family with a fixed
   `symmetryOrder` keeps each ring a multiple of that order. Angular offsets
   are `180 / count` plus jitter. Special structures then act:
   `Labellum` gives the inner ring a different shape and a pattern, `Corona`
   forces the inner ring to `Trumpet` fusion, `Spur` appends a `Tube` fused ring
   of count 1, `Composite` forces `Ligulate` outer petals and a large flat disc,
   `Bell` forces the outer ring's fusion to the first fused kind the profile
   allows.
5. The name is `${mood} ${template name}` with a template, else
   `${mood} ${name_noun}`. `taxonomy.genus` and `species_name` come from the
   template's scientific name, else the profile's `typicalGenus` and an
   invented epithet (the noun in lower case plus a Latin suffix).
   `common_name` is the name, `botanical_class` the profile's.
6. The result is parsed by `FlowerSpecSchema`. The zod objects are strict, so a
   misspelled or out of range field throws instead of falling back to a Rust
   default. The assembler does not write `roots` or `personality`; Rust fills
   them from `#[serde(default)]`.

### Stream format

`pipeline.generateFlower` yields `Snapshot` values:

```json
{
  "stage": 1,
  "answers": [{ "id": "family", "value": "Iridaceae" }],
  "spec": "<yaml>",
  "done": false
}
```

`answers` is cumulative in answer order, stage one first. `spec` is the full
YAML of the spec assembled from the answers so far. The first line is stage 1
with no stage two answers. Each later line is stage 2 with one more answer set;
later partials win per id and an id keeps the position of its first arrival.
The last line carries `done: true`. Jev answers in one call, so it produces one
stage 2 line.

`generate.ts` writes the lines through a hand built `ReadableStream` with
`Content-Type: application/x-ndjson`. The first snapshot is awaited before the
response is created, so a failure before it is an HTTP 502 JSON body
`{ "error": "..." }`. A failure after the first line writes one line
`{ "error": "..." }` and closes the stream.

The client (`client/src/ai/generateFlower.ts`) reads the lines with `readNdjson`
and calls `onSnapshot` for each one. `FlowerChat` prints the answers as
`id: value` lines while they stream, then collapses to `[ok] created: <name>`.
`DesignerView` writes every snapshot's spec to the session through
`update_flower_spec`, so the canvas redraws on each answer.

## Model selection

`api/config/models.ts` lists the gateway models the UI offers: Anthropic,
OpenAI, Google, DeepSeek, Mistral, MiniMax, Moonshot, Zhipu, Alibaba and
TypeSafe Jev. `gatewaySource` in `generate.ts` picks the answer source from the
id in the body:

| Model id          | Source                                                  |
| ----------------- | ------------------------------------------------------- |
| `typesafe-ai/jev` | `jevSource(gateway.evaluationModel("typesafe-ai/jev"))` |
| any other id      | `textModelSource(gateway(id))`                          |

`client/src/settings/ModelPicker.tsx` holds its own copy of the list and sends
the `fullName`.

## Combine

`POST /api/flower/combine` (`api/flower/combine.ts`) describes what two flowers
become when merged. The client (`client/src/spacetime/bridge.ts`, `handleMerge`)
sends:

```json
{
  "spec_a": { "...parsed FlowerSpec of session A": true },
  "spec_b": { "...parsed FlowerSpec of session B": true },
  "total_count": 5,
  "level": "bunch",
  "parent_adornments": [{ "...arrangement override of a parent": true }],
  "model": "typesafe-ai/jev"
}
```

`parent_adornments` and `model` are optional. `level` is one of stem, group,
bunch, arrangement, bouquet, centerpiece, installation, from `total_count`.

The handler calls `streamText` with `COMBINE_SYSTEM_PROMPT`, a prompt that
embeds both specs as JSON and the parent adornments with evolution rules, and
`Output.object({ schema: ArrangementSchema })`:

| Field               | Type                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `name`              | string                                                                                          |
| `arrangement_level` | string                                                                                          |
| `description`       | string                                                                                          |
| `adornments`        | string[]                                                                                        |
| `sprite_hints`      | `{ dominant_color, secondary_color?, accent_style? }`                                           |
| `adornment_spec`    | `{ container: { type, material, color }, accent: { type, color }, base?, mood, evolved_from? }` |
| `harmony_note`      | string                                                                                          |

Container types: tie, wrap, basket, vase, urn. Materials: kraft, tissue, silk,
ceramic, glass, wicker, metal. Accent types: ribbon, bow, twine, trim, band,
none. Base types: none, saucer, pedestal, plinth. Colors are RGB in 0 to 1.

The response is `result.toTextStreamResponse()`. The client reads the whole
stream to a string and passes it unchanged as `ai_arrangement_json` to the
`merge_sessions` reducer, which stores it as a `part_override` row with
`part_path = "arrangement"`. The renderer's `parseArrangementMeta` reads
`adornment_spec` from that row to draw the container.

## Order

`POST /api/flower/order` makes no model call. See `docs/08-orders.md`.

## Agents

`agents/agent.ts` is a placeholder. It loads the SpacetimeDB SDK, prints the
loop it would run, and exits. It does not connect or act.
