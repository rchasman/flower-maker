# AI Integration

## Two Touchpoints

AI is invoked at two moments:

1. **New flower** — user describes what they want, AI generates a structured flower spec
2. **Merge** — two flowers collide, AI generates what the combination becomes

Both use Vercel AI SDK's `streamText` via the Hono API layer. The schema is embedded in the prompt (not `Output.object()` — structured output is a future upgrade).

## POST /api/flower/generate

### Flow

```
User: "a dramatic arrangement of deep purple irises with silver accents"
       │
POST /api/flower/generate
       │
streamText({
  model: anthropic('claude-sonnet-4.6'),
  system: FLORIST_SYSTEM_PROMPT,
  prompt: userMessage,
})
       │
Streamed to client as plain text (FlowerSpec JSON)
       │
Client creates SpacetimeDB session from the spec
```

### FlowerSpec Schema

```typescript
const FlowerSpecSchema = z.object({
  name: z.string().describe("A poetic name for this arrangement"),
  flowers: z
    .array(
      z.object({
        type: z.string().describe("Flower type from the 45 catalog"),
        color: z.string().describe("Specific color variant"),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(12),
  mood: z
    .string()
    .describe(
      "The emotional quality: vibrant, serene, dramatic, romantic, fresh, elegant",
    ),
  style: z
    .string()
    .describe("Arrangement style: modern, classic, rustic, minimalist, wild"),
  description: z
    .string()
    .describe("2-3 sentence description of the arrangement's character"),
});
```

### System Prompt

The AI acts as an expert florist with knowledge of:

- All 45 flower types and their characteristics
- Color theory and harmony
- Seasonal availability
- Occasion appropriateness
- Arrangement composition rules

The system prompt constrains the AI to only reference flower types that exist in the catalog.

### Request/Response

**Request:**

```json
{
  "prompt": "a wild meadow arrangement with cornflowers and poppies",
  "context": {
    "existing_flowers": ["rose", "daisy"],
    "occasion": "everyday"
  }
}
```

**Response:** SSE stream of the FlowerSpec object, field by field.

## POST /api/flower/combine

### Flow

```
WASM: merge detected between session A and session B
       │
Client gathers flower data from SpacetimeDB local cache:
  Session A: 3x red roses, 2x baby's breath
  Session B: 2x yellow sunflowers
       │
POST /api/flower/combine
       │
streamText({
  model: anthropic('claude-sonnet-4.6'),
  system: COMBINATION_SYSTEM_PROMPT,
  prompt: combinationDetails,  // schema shape embedded in prompt
})
       │
Client calls merge_sessions reducer with the AI result
```

### Arrangement Schema

```typescript
const ArrangementSchema = z.object({
  name: z.string().describe("Name for the combined arrangement"),
  arrangement_level: z.enum([
    "stem",
    "group",
    "bunch",
    "arrangement",
    "bouquet",
    "centerpiece",
    "installation",
  ]),
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
```

### Combination System Prompt

The combination prompt focuses on:

- **What happens when these specific flowers meet** — not generic descriptions
- **The tension or harmony** between the types (roses + sunflowers = formal meets casual)
- **Level-appropriate adornments** — a group of 3 gets wrap, not a vase
- **Color story** — how the combined palette reads

The AI doesn't just describe — it **decides** what the arrangement becomes. Different combinations of the same flowers can produce different results because the AI considers the context, the existing arrangement level, and the overall mood.

### Request/Response

**Request:**

```json
{
  "flowers_a": [{ "type": "rose", "color": "red", "quantity": 3 }],
  "flowers_b": [{ "type": "sunflower", "color": "yellow", "quantity": 2 }],
  "total_count": 5,
  "current_level": "bunch"
}
```

**Response:** SSE stream of the ArrangementSchema object.

## POST /api/flower/order

Not an AI call. Assembles a structured JSON payload from the session data — the real product demonstrating what a programmatic flower order looks like.

## Streaming & Display

Both endpoints stream structured JSON to the client. The client renders progressively using json-render patterns:

- Flower names and types appear first (small tokens)
- Description fills in as the model generates
- The UI shows a "thinking" state while the initial tokens arrive
- Once the spec is complete, the SpacetimeDB reducer is called

The stream is displayed in the AI chat panel. The user sees what the AI is generating in real time, then watches it materialize on the canvas.

## Model Selection

Default: `anthropic/claude-sonnet-4.6` via AI Gateway. Sonnet is the sweet spot — fast enough for real-time merge responses (~1-2s), creative enough for interesting combination descriptions.

For background generation of arrangement descriptions (not user-facing, batch), Haiku could be used for cost savings.

## Cost

Each merge triggers one AI call:

- ~500 input tokens + ~200 output tokens per merge
- At Sonnet pricing: ~$0.003 per merge
- 1000 concurrent players × 10 merges = ~$30

New flower generation is larger (~1000 output tokens) but happens less frequently (once per session start).

## AI Agents

Autonomous AI agents connect as SpacetimeDB clients alongside humans. They create flowers, merge for fitness optimization, and place orders — demonstrating the API's agent-readiness. Implemented as separate Bun processes.
