# SpacetimeDB Schema

`server/spacetimedb/src/lib.rs`. Database name `flower-picker`. Every table
is public and every client subscribes to all of them.

## Tables (6)

**user**: player profile

- `identity` (PK), `name` (Option), `online`, `current_session_id` (Option),
  `total_orders`, `joined_at`

**flower_session**: one flower or arrangement in a zone

- `id` (PK, auto_inc), `owner`, `created_at`, `status` (Designing, Ordered,
  Complete), `prompt`, `canvas_x`, `canvas_y` (0 to 100), `arrangement_level`
  (1 to 7), `flower_count`, `generation`

**flower_spec**: the spec of a session

- `session_id` (PK), `spec` (FlowerSpec as YAML text), `version`, `updated_at`

**part_override**: per-session key value rows (index on `session_id`)

- `id` (PK, auto_inc), `session_id`, `part_path`, `override_json`,
  `forked_from`, `created_at`
- `part_path` values in use: a JSON path from the part editor (for example
  `petals.layers.0.count`), `arrangement` (the combine endpoint's JSON on a
  merged child), `constituent:N` (the YAML spec of each flower in an
  arrangement, `constituent:0` is the crossed child)

**flower_order**: orders (index on `session_id`)

- `id` (PK, auto_inc), `session_id`, `orderer`, `ordered_at`, `source`
  (Human, Agent), `note` (Option)

**chat_message**: global chat

- `id` (PK, auto_inc), `sender`, `text`, `sent_at`

## Reducers (18)

Lifecycle: `init` (logs), `client_connected` (inserts or marks the user
online), `client_disconnected` (marks offline).

| Reducer                                                        | Does                                                                                                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `create_session(prompt)`                                       | inserts a Designing session at a random position with an empty spec; sets the user's `current_session_id`                     |
| `update_position(session_id, x, y)`                            | moves a session                                                                                                               |
| `update_flower_spec(session_id, spec)`                         | replaces the YAML, bumps `version`                                                                                            |
| `fork_part(session_id, part_path, override_json, forked_from)` | inserts a `part_override`                                                                                                     |
| `update_part_override(override_id, override_json)`             | edits one                                                                                                                     |
| `delete_part_override(override_id)`                            | deletes one                                                                                                                   |
| `place_order(session_id, source, note)`                        | inserts a `flower_order`, sets the session to Ordered, increments `total_orders`                                              |
| `complete_session(session_id)`                                 | sets Complete                                                                                                                 |
| `delete_session(session_id)`                                   | cascades overrides, spec and orders, then the session; refuses an Ordered session                                             |
| `merge_sessions(a, b, ai_arrangement_json)`                    | breeds the child with `genetics::cross`, stores the AI JSON and the constituents, archives the parents                        |
| `split_constituent(session_id, index)`                         | moves one constituent into a new session                                                                                      |
| `remove_constituent(session_id, index)`                        | deletes one constituent and re-indexes the rest                                                                               |
| `send_chat(text)`                                              | inserts a message (1 to 500 characters)                                                                                       |
| `set_name(name)`                                               | 1 to 32 characters                                                                                                            |
| `claim_anonymous_identity(anon_token)`                         | `anon_token` is the anonymous identity as hex; moves its sessions, orders and messages to the caller and merges the user rows |

Every session reducer checks that the caller owns the session. There are no
XP, skin, emote, environment, fitness or leaderboard tables or reducers.
