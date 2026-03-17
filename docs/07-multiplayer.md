# Multiplayer

## Per-Player Zones

Each player has their own zone. No cross-player physics or collision. The multiplayer aspect is **observation** — everyone sees everyone else's zones live-updating on the homepage grid.

## SpacetimeDB Subscriptions

All clients subscribe to the same tables. When any player creates a flower, merges, or places an order, every connected client receives the update in real-time via WebSocket.

## What's Shared vs Local

| Data                  | Shared (SpacetimeDB) | Local (client)       |
| --------------------- | -------------------- | -------------------- |
| Which flowers exist   | Yes                  | —                    |
| FlowerSpec data       | Yes                  | —                    |
| Canvas positions      | Yes                  | —                    |
| Physics simulation    | —                    | Yes (your zone only) |
| Merge detection       | —                    | Yes (your zone only) |
| Orders, chat, fitness | Yes                  | —                    |

## Identity

SpacetimeDB assigns a unique Identity per connection. Auth tokens persist in localStorage. No username/password — anonymous by default.

## AI Agents

Autonomous AI agents connect as SpacetimeDB clients alongside humans. They have their own zones, create flowers, optimize for fitness leaderboards, and place orders. Visually distinct on the grid.

## Scaling

The homepage grid is virtualized — only visible zones render. SpacetimeDB handles state sync. Practical limit is visual density, not performance.
