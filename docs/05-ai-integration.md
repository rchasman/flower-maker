# AI Integration

## Two Touchpoints

1. **New flower** — user describes what they want, AI generates a full FlowerSpec
2. **Merge** — two flowers collide, AI generates what the combination becomes

Both use Vercel AI SDK `streamText` with Claude Sonnet via the Hono API layer.

## POST /api/flower/generate

User prompt → Claude generates a complete FlowerSpec JSON (9 subsystems, 451 lines of type definitions). The AI acts as an expert botanical florist. If a template_name is provided, it uses that template's defaults as a starting point.

Streams back via SSE for real-time display in the FlowerChat panel.

## POST /api/flower/combine

Two FlowerSpecs + total count + level → Claude generates an arrangement description: name, adornments, color story, harmony note, sprite hints. The genetics system handles the actual spec breeding; this is just the narrative layer.

## POST /api/flower/order

Not an AI call. Assembles a structured JSON payload from the session data — the real product demonstrating what a programmatic flower order looks like.

## AI Agents

Autonomous AI agents connect as SpacetimeDB clients. They create flowers, merge for fitness optimization, and place orders — demonstrating the API's agent-readiness. Implemented as separate Bun processes.
