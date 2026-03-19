import { streamText, gateway } from "ai";
import { DEFAULT_MODEL } from "../config/models";
import { z } from "zod";

const COMBINE_SYSTEM_PROMPT = `You are an expert florist describing what happens when flowers are combined into arrangements. Given two flower specs and their counts, describe what the combination becomes.

Focus on:
- How the flowers complement or contrast each other
- What adornments are appropriate for this arrangement level
- The color story and mood
- A poetic name for the arrangement

Available container types for adornment_spec:
- tie: band around stems (for small groups)
- wrap: paper cone wrapping (for bunches)
- basket: woven container, wider than wrap (for arrangements)
- vase: ceramic/glass with neck (for bouquets)
- urn: wide mouth, heavy body (for grand arrangements)

Materials affect the visual feel:
- kraft: warm paper, opaque, slightly desaturated
- tissue: translucent, soft, light
- silk: rich, saturated, true color
- ceramic: cool tones, solid, slightly desaturated
- glass: transparent, tinted, light
- wicker: warm, textured, earthy
- metal: dark, sleek, desaturated

Pick colors that harmonize with the flowers — complement, analogous, or accent. The container should feel like it belongs with these specific flowers. Colors are RGB 0-1.

Respond with structured JSON matching the schema provided.`;

const AdornmentSpecSchema = z.object({
  container: z.object({
    type: z.enum(["tie", "wrap", "basket", "vase", "urn"]),
    material: z.enum(["kraft", "tissue", "silk", "ceramic", "glass", "wicker", "metal"]),
    color: z.object({ r: z.number(), g: z.number(), b: z.number() })
      .describe("RGB 0-1, derived from the flowers' palette"),
  }),
  accent: z.object({
    type: z.enum(["ribbon", "bow", "twine", "trim", "band", "none"]),
    color: z.object({ r: z.number(), g: z.number(), b: z.number() }),
  }),
  base: z.object({
    type: z.enum(["none", "saucer", "pedestal", "plinth"]),
    color: z.object({ r: z.number(), g: z.number(), b: z.number() }),
  }).optional(),
  mood: z.string().describe("rustic, elegant, wild, minimal, lush, or dramatic"),
  evolved_from: z.string().optional().describe("Description of what this adornment evolved from, if merging existing arrangements"),
});

const ArrangementSchema = z.object({
  name: z.string().describe("A poetic name for the combined arrangement"),
  arrangement_level: z.string().describe("stem, group, bunch, arrangement, bouquet, centerpiece, or installation"),
  description: z.string().describe("What this combination has become — the visual story, color relationships, how the flowers interact"),
  adornments: z.array(z.string()).describe("Physical additions: wrap type, ribbon, vase, stand, etc."),
  sprite_hints: z.object({
    dominant_color: z.string(),
    secondary_color: z.string().optional(),
    accent_style: z.string().optional(),
  }),
  adornment_spec: AdornmentSpecSchema.describe("Structured adornment specification for rendering"),
  harmony_note: z.string().describe("One sentence on why these flowers work together"),
});

export async function handleCombine(request: Request) {
  const body = await request.json() as {
    spec_a: unknown;
    spec_b: unknown;
    total_count: number;
    level: string;
    parent_adornments?: unknown[];
    model?: string;
  };

  const inheritanceContext = body.parent_adornments && body.parent_adornments.length > 0
    ? `\n\nPrevious arrangement adornments (evolve, don't reset):\n${JSON.stringify(body.parent_adornments, null, 2)}\n\nRules for evolution:\n- A tie at a higher level might become a wrap or ribbon\n- Similar materials reinforce (two kraft parents → stay kraft but more elaborate)\n- Contrasting materials blend (kraft + silk → wicker or linen)\n- Container type should upgrade with level but the material lineage should persist\n- Accents can carry forward or evolve (twine → ribbon → bow)\n- Set evolved_from to describe what you evolved from`
    : "";

  const result = streamText({
    model: gateway(body.model ?? DEFAULT_MODEL),
    system: COMBINE_SYSTEM_PROMPT,
    prompt: `Combine these flowers into a ${body.level} arrangement (${body.total_count} total flowers):

Flower A: ${JSON.stringify(body.spec_a)}
Flower B: ${JSON.stringify(body.spec_b)}${inheritanceContext}

Respond with a JSON object matching this structure: ${JSON.stringify(ArrangementSchema.shape)}`,
  });

  return result.toTextStreamResponse();
}
