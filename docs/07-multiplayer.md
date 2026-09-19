# Multiplayer

## Per-Player Zones

Each player has a zone. There is no cross-player physics or merging. The
multiplayer aspect is observation: everyone sees everyone else's zones on the
homepage grid as they change.

## SpacetimeDB Subscriptions

Every client calls `subscribeToAllTables()` on connect
(`client/src/spacetime/connection.ts`). When any player creates a flower,
merges, orders or chats, every connected client receives the row over the
WebSocket. The homepage grid (`FlowerGrid`) groups `flower_session` rows by
owner and renders one card per user through `PixiMiniCanvas`.

## Shared vs Local

| Data                        | Shared (SpacetimeDB) | Local (client)                |
| --------------------------- | -------------------- | ----------------------------- |
| Sessions and their status   | yes                  |                               |
| FlowerSpec YAML             | yes                  |                               |
| Part overrides              | yes                  |                               |
| Canvas positions (0 to 100) | yes                  | pixel mapping to the viewport |
| Physics bodies              |                      | yes, your Designing sessions  |
| Merge target detection      |                      | yes, drag distance in pixels  |
| Orders, chat                | yes                  |                               |
| Generation stream           |                      | yes, then written as specs    |

## Identity

SpacetimeDB assigns an identity per connection token. An anonymous token and
its identity hex are kept in `localStorage`. The client can also sign in with
OIDC (`client/src/auth/`); after sign-in it calls `claim_anonymous_identity`
with the saved hex so the anonymous sessions, orders and messages move to the
signed-in identity. `set_name` gives a display name.

## Agents

`agents/agent.ts` is a placeholder that prints the loop it would run. No agent
connects today.
