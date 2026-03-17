// Placeholder types until SpacetimeDB bindings are generated.
// Replace with actual generated types from module_bindings/ when available.

export type Identity = string

export interface User {
  identity: Identity
  name: string | null
  online: boolean
  current_session_id: number | null
  total_orders: number
  xp: number
  level: number
  joined_at: number
}

export interface FlowerSession {
  id: number
  owner: Identity
  created_at: number
  status: 'Designing' | 'Ordered' | 'Complete'
  prompt: string
  canvas_x: number
  canvas_y: number
  arrangement_level: number
  flower_count: number
  generation: number
  fitness_json: string
}

export interface FlowerSpec {
  session_id: number
  spec_json: string
  version: number
  updated_at: number
}

export interface FlowerOrder {
  id: number
  session_id: number
  orderer: Identity
  ordered_at: number
  source: 'Human' | 'Agent'
  note: string | null
}

export interface Environment {
  id: number
  name: string
  config_json: string
  is_active: boolean
  created_at: number
}

export interface FitnessScore {
  id: number
  session_id: number
  environment_id: number
  score: number
  generation: number
  evaluated_at: number
}

export interface LeaderboardEntry {
  id: number
  environment_id: number
  session_id: number
  owner: Identity
  score: number
  rank: number
  flower_name: string
  updated_at: number
}

export interface ChatMessage {
  id: number
  sender: Identity
  text: string
  sent_at: number
  emote: string | null
}

export interface SkinDefinition {
  id: number
  name: string
  description: string
  rarity: string
  unlock_xp: number
  css_class: string
}

export interface UserSkin {
  id: number
  owner: Identity
  skin_id: number
  unlocked_at: number
  equipped: boolean
}

// Placeholder DbConnection type — replaced by generated bindings
export interface DbConnection {
  db: {
    flower_session: TableAccessor<FlowerSession>
    flower_spec: TableAccessor<FlowerSpec>
    user: TableAccessor<User>
    flower_order: TableAccessor<FlowerOrder>
    environment: TableAccessor<Environment>
    fitness_score: TableAccessor<FitnessScore>
    leaderboard_entry: TableAccessor<LeaderboardEntry>
    chat_message: TableAccessor<ChatMessage>
    skin_definition: TableAccessor<SkinDefinition>
    user_skin: TableAccessor<UserSkin>
  }
  reducers: Record<string, (...args: unknown[]) => void>
}

export interface TableAccessor<T> {
  count(): number
  iter(): Iterable<T>
  onInsert(cb: (ctx: unknown, row: T) => void): void
  onUpdate(cb: (ctx: unknown, oldRow: T, newRow: T) => void): void
  onDelete(cb: (ctx: unknown, row: T) => void): void
}
