import { Hono } from 'hono'
import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

export const flowerRoutes = new Hono()

const FLORIST_SYSTEM_PROMPT = `You are an expert botanical florist and flower designer with deep knowledge of 50+ flower species. When asked to design a flower, you generate a complete FlowerSpec JSON object.

Your FlowerSpec must include ALL of these top-level fields:
- name: A poetic name for this flower
- species: Scientific name
- petals: { layers: [...], bloom_progress: 1.0, wilt_progress: 0.0, symmetry: {...} }
- reproductive: { pistil, stamens, pollen, nectary }
- structure: { stem, sepals, receptacle, peduncle }
- foliage: { leaves, bracts, leaf_density }
- ornamentation: { dewdrops, glow, particles, iridescence, bioluminescence }
- roots: { pattern, depth, spread, thickness, color, luminescence, mycorrhizal }
- aura: null or { kind, color, opacity, radius, animation_speed }
- personality: { growth_speed, hardiness, sociability, light_preference, water_need, wind_response, pollinator_attraction, fragrance }

For colors use { r, g, b, a } with 0.0-1.0 values.
For color gradients use { stops: [{ position, color }] }.

Be botanically accurate but creatively expressive. Every flower should feel unique and alive.`

const COMBINE_SYSTEM_PROMPT = `You are an expert florist describing what happens when flowers are combined into arrangements. Given two flower specs and their counts, describe what the combination becomes.

Focus on:
- How the flowers complement or contrast each other
- What adornments are appropriate for this arrangement level
- The color story and mood
- A poetic name for the arrangement

Respond with structured JSON matching the schema provided.`

// POST /api/flower/generate — AI generates a full FlowerSpec
flowerRoutes.post('/generate', async (c) => {
  const body = await c.req.json<{ prompt: string; template_name?: string }>()

  const result = streamText({
    model: anthropic('claude-sonnet-4.6'),
    system: FLORIST_SYSTEM_PROMPT,
    prompt: body.template_name
      ? `Create a ${body.template_name} flower based on this description: ${body.prompt}. Use the real botanical properties of ${body.template_name} as a starting point but make it unique.`
      : `Create a unique flower based on this description: ${body.prompt}`,
  })

  return result.toTextStreamResponse()
})

// POST /api/flower/combine — AI describes what a merge becomes
flowerRoutes.post('/combine', async (c) => {
  const body = await c.req.json<{
    spec_a: unknown
    spec_b: unknown
    total_count: number
    level: string
  }>()

  const ArrangementSchema = z.object({
    name: z.string().describe('A poetic name for the combined arrangement'),
    arrangement_level: z.string().describe('stem, group, bunch, arrangement, bouquet, centerpiece, or installation'),
    description: z.string().describe('What this combination has become — the visual story, color relationships, how the flowers interact'),
    adornments: z.array(z.string()).describe('Physical additions: wrap type, ribbon, vase, stand, etc.'),
    sprite_hints: z.object({
      dominant_color: z.string(),
      secondary_color: z.string().optional(),
      accent_style: z.string().optional(),
    }),
    harmony_note: z.string().describe('One sentence on why these flowers work together'),
  })

  const result = streamText({
    model: anthropic('claude-sonnet-4.6'),
    system: COMBINE_SYSTEM_PROMPT,
    prompt: `Combine these flowers into a ${body.level} arrangement (${body.total_count} total flowers):

Flower A: ${JSON.stringify(body.spec_a)}
Flower B: ${JSON.stringify(body.spec_b)}

Respond with a JSON object matching this structure: ${JSON.stringify(ArrangementSchema.shape)}`,
  })

  return result.toTextStreamResponse()
})

// POST /api/flower/order — generate the JSON order payload
flowerRoutes.post('/order', async (c) => {
  const body = await c.req.json<{
    session_id: number
    spec: unknown
    arrangement_level: string
    flower_count: number
    generation: number
    fitness_scores: Record<string, number>
    prompt: string
  }>()

  const orderPayload = {
    api_version: 'v1',
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
        fitness_scores: body.fitness_scores,
        created_at: new Date().toISOString(),
      },
    },
  }

  return c.json(orderPayload)
})
