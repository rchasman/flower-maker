/**
 * Autonomous AI agent that connects to SpacetimeDB as a player.
 * Creates flowers, merges for fitness optimization, and places orders.
 *
 * Run: cd agents && bun run agent.ts
 *
 * Requires: SpacetimeDB running locally + module published.
 * The agent uses the same TS SDK as the browser client.
 */

const SPACETIMEDB_URI =
  process.env.SPACETIMEDB_URI ?? "ws://db.flower-maker.localhost:1355";
const MODULE_NAME = process.env.SPACETIMEDB_MODULE ?? "flower-maker";
const AGENT_NAME = process.env.AGENT_NAME ?? "flora-bot";
const TICK_INTERVAL_MS = 10_000; // act every 10 seconds

async function main() {
  console.log(`[agent] ${AGENT_NAME} starting...`);
  console.log(`[agent] Connecting to ${SPACETIMEDB_URI} / ${MODULE_NAME}`);

  // Dynamic import — the module_bindings would be shared with the client
  // For now, use the SpacetimeDB SDK directly
  try {
    const _sdk = await import("spacetimedb");

    // Connection would use the generated bindings:
    // const conn = sdk.DbConnection.builder()
    //   .withUri(SPACETIMEDB_URI)
    //   .withModuleName(MODULE_NAME)
    //   .onConnect((ctx, identity, token) => {
    //     console.log(`[agent] Connected as ${identity}`)
    //     startAgentLoop(conn)
    //   })
    //   .build()

    console.log(`[agent] SDK loaded. Waiting for generated bindings...`);
    console.log(
      `[agent] Run 'spacetime generate' first, then update this script.`,
    );
    console.log(`[agent] Agent behavior:`);
    console.log(`  1. Set name to "${AGENT_NAME}"`);
    console.log(
      `  2. Every ${TICK_INTERVAL_MS / 1000}s: create a flower from random prompt`,
    );
    console.log(`  3. When 2+ designing sessions: merge the oldest two`);
    console.log(`  4. When a merge reaches bouquet level: place order`);
    console.log(`  5. Optimize for highest fitness in target environment`);
  } catch (err) {
    console.error("[agent] Failed to load SDK:", err);
    console.log("[agent] Install: cd agents && bun install");
  }
}

// Agent behavior loop (runs after connection is established)
function describeAgentLoop() {
  console.log(`
Agent Loop (every ${TICK_INTERVAL_MS / 1000}s):

1. Check my designing sessions
2. If 0 sessions → create flower from random prompt
   call: create_session(randomPrompt())
   call: update_flower_spec(sessionId, generateSpec())

3. If 1 session → create another flower (need 2 to merge)
   call: create_session(randomPrompt())

4. If 2+ sessions → merge the oldest two
   call: merge_sessions(oldest.id, secondOldest.id, aiDescription)

5. After merge → check arrangement_level
   If level >= 5 (bouquet) → place order
   call: place_order(sessionId, 'Agent', 'Auto-order by ${AGENT_NAME}')

6. After order → start fresh
`);
}

void main();
describeAgentLoop();
