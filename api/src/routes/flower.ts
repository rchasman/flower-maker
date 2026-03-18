import { Hono } from "hono";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

export const flowerRoutes = new Hono();

const FLORIST_SYSTEM_PROMPT = `You are an expert botanical florist. Generate a FlowerSpec as YAML (no markdown fences, no explanation — ONLY the YAML).

EXACT SCHEMA (use these field names and enum string values):

name: poetic name
species: Scientific name
petals:
  layers:
    - index: 0
      count: 5
      shape: Ovate
      arrangement: Radial
      curvature: 0.3
      curl: 0.1
      texture: Velvet
      color:
        stops:
          - position: 0.0
            color: { r: 0.8, g: 0.2, b: 0.2, a: 1.0 }
      opacity: 1.0
      vein_pattern: Branching
      edge_style: Smooth
      width: 1.0
      length: 1.5
      angular_offset: 0.0
      droop: 0.1
      thickness: 0.4
  bloom_progress: 1.0
  wilt_progress: 0.0
reproductive:
  pistil:
    style: Simple
    stigma_shape: Capitate
    color: { r: 0.9, g: 0.8, b: 0.1, a: 1.0 }
    height: 0.3
  stamens:
    - filament_curve: 0.2
      filament_color: { r: 0.9, g: 0.9, b: 0.5, a: 1.0 }
      anther_shape: Versatile
      anther_color: { r: 0.9, g: 0.6, b: 0.0, a: 1.0 }
      pollen_load: 0.5
      height: 0.4
      sway: 0.3
structure:
  stem:
    height: 0.5
    thickness: 0.3
    curvature: 0.1
    color: { r: 0.1, g: 0.5, b: 0.2, a: 1.0 }
  sepals:
    - shape: Lanceolate
      color: { r: 0.1, g: 0.4, b: 0.2, a: 1.0 }
      reflex_angle: 90.0
      length: 0.3
      persistent: true
  receptacle:
    shape: Flat
    size: 0.3
    color: { r: 0.1, g: 0.4, b: 0.1, a: 1.0 }

ENUM VALUES (use exact strings):
- shape (petal): Ovate, Lanceolate, Spatulate, Oblong, Orbicular, Cordate, Deltoid, Falcate, Ligulate, Tubular, Fimbriate, Laciniate, Runcinate
- arrangement: Radial, Spiral, Bilateral, Imbricate, Valvate, Contorted, Whorled
- edge_style: Smooth, Ruffled, Fringed, Serrated, Rolled, Undulate, Crisped, Lacerate
- texture: Smooth, Velvet, Silk, Papery, Waxy, Rough, Hairy, Glassy, Crystalline, Scaled
- vein_pattern: None, Parallel, Branching, Palmate, Reticulate, Dichotomous, Arcuate
- sepal shape: Lanceolate, Ovate, Triangular, Leaflike, Petaloid
- receptacle shape: Flat, Convex, Concave, Conical, Urceolate

RULES:
- Colors use flow syntax: { r: 0.0-1.0, g: 0.0-1.0, b: 0.0-1.0, a: 1.0 }
- Roses: 3 layers (5 outer, 8 middle, 13 inner) with Spiral arrangement, increasing curvature inward
- Daisies: 1 layer of 13-21 Ligulate or Spatulate petals, large receptacle (size: 0.7+)
- Sunflowers: 1 layer of 21-34 Ligulate petals, very large receptacle (size: 0.8+)
- Orchids: 2 layers — 3 Falcate + 3 Orbicular with angular_offset: 60
- Lilies: 1 layer of 6 Lanceolate petals with negative curvature (recurved), prominent stamens
- Use multiple layers with angular_offset for complex flowers (roses, peonies, dahlias)
- Be botanically accurate but creatively expressive`;

const COMBINE_SYSTEM_PROMPT = `You are an expert florist describing what happens when flowers are combined into arrangements. Given two flower specs and their counts, describe what the combination becomes.

Focus on:
- How the flowers complement or contrast each other
- What adornments are appropriate for this arrangement level
- The color story and mood
- A poetic name for the arrangement

Respond with structured JSON matching the schema provided.`;

// POST /api/flower/generate — AI generates a full FlowerSpec
flowerRoutes.post("/generate", async c => {
  const body = await c.req.json<{ prompt: string; template_name?: string }>();

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: FLORIST_SYSTEM_PROMPT,
    prompt: body.template_name
      ? `Create a ${body.template_name} flower based on this description: ${body.prompt}. Use the real botanical properties of ${body.template_name} as a starting point but make it unique.`
      : `Create a unique flower based on this description: ${body.prompt}`,
  });

  return result.toTextStreamResponse();
});

// POST /api/flower/combine — AI describes what a merge becomes
flowerRoutes.post("/combine", async c => {
  const body = await c.req.json<{
    spec_a: unknown;
    spec_b: unknown;
    total_count: number;
    level: string;
  }>();

  const ArrangementSchema = z.object({
    name: z.string().describe("A poetic name for the combined arrangement"),
    arrangement_level: z
      .string()
      .describe(
        "stem, group, bunch, arrangement, bouquet, centerpiece, or installation",
      ),
    description: z
      .string()
      .describe(
        "What this combination has become — the visual story, color relationships, how the flowers interact",
      ),
    adornments: z
      .array(z.string())
      .describe("Physical additions: wrap type, ribbon, vase, stand, etc."),
    sprite_hints: z.object({
      dominant_color: z.string(),
      secondary_color: z.string().optional(),
      accent_style: z.string().optional(),
    }),
    harmony_note: z
      .string()
      .describe("One sentence on why these flowers work together"),
  });

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: COMBINE_SYSTEM_PROMPT,
    prompt: `Combine these flowers into a ${body.level} arrangement (${body.total_count} total flowers):

Flower A: ${JSON.stringify(body.spec_a)}
Flower B: ${JSON.stringify(body.spec_b)}

Respond with a JSON object matching this structure: ${JSON.stringify(ArrangementSchema.shape)}`,
  });

  return result.toTextStreamResponse();
});

// POST /api/flower/order — generate the JSON order payload
flowerRoutes.post("/order", async c => {
  const body = await c.req.json<{
    session_id: number;
    spec: unknown;
    arrangement_level: string;
    flower_count: number;
    generation: number;
    prompt: string;
  }>();

  const orderPayload = {
    api_version: "v1",
    order: {
      session_id: body.session_id,
      arrangement: {
        spec: body.spec,
        level: body.arrangement_level,
        flower_count: body.flower_count,
        prompt: body.prompt,
      },
      metadata: {
        generation: body.generation,
        created_at: new Date().toISOString(),
      },
    },
  };

  return c.json(orderPayload);
});
