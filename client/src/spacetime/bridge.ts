import type { GardenSim } from '../wasm/loader.ts'
import type { DbConnection, FlowerSession, FlowerSpec } from './types.ts'

/// Wire SpacetimeDB table callbacks to the WASM simulation.
/// Only flowers owned by the current user are added to the physics world.
export function wireToWasm(conn: DbConnection, sim: GardenSim) {
  // When a new session appears, add it to the simulation
  conn.db.flower_session.onInsert((_ctx, session: FlowerSession) => {
    if (session.status === 'Designing') {
      sim.upsert_flower(session.id, '{}', session.canvas_x, session.canvas_y)
    }
  })

  // When a session is updated (e.g. spec changes, status changes)
  conn.db.flower_session.onUpdate((_ctx, _old: FlowerSession, next: FlowerSession) => {
    if (next.status === 'Complete') {
      sim.wilt_flower(next.id)
    } else {
      sim.upsert_flower(next.id, '{}', next.canvas_x, next.canvas_y)
    }
  })

  // When a session is deleted
  conn.db.flower_session.onDelete((_ctx, session: FlowerSession) => {
    sim.remove_flower(session.id)
  })

  // When a flower spec is updated, forward the spec JSON to WASM
  conn.db.flower_spec.onInsert((_ctx, spec: FlowerSpec) => {
    // Re-upsert with the actual spec data
    // We need the session position — look it up from the local cache
    for (const session of conn.db.flower_session.iter()) {
      if (session.id === spec.session_id && session.status === 'Designing') {
        sim.upsert_flower(session.id, spec.spec_json, session.canvas_x, session.canvas_y)
        break
      }
    }
  })

  conn.db.flower_spec.onUpdate((_ctx, _old: FlowerSpec, next: FlowerSpec) => {
    for (const session of conn.db.flower_session.iter()) {
      if (session.id === next.session_id && session.status === 'Designing') {
        sim.upsert_flower(session.id, next.spec_json, session.canvas_x, session.canvas_y)
        break
      }
    }
  })

  console.log('[bridge] SpacetimeDB → WASM wired')
}

/// Handle a merge event from the WASM simulation.
/// Calls the AI combine endpoint, then the SpacetimeDB merge_sessions reducer.
export async function handleMerge(
  conn: DbConnection,
  sessionAId: number,
  sessionBId: number,
): Promise<void> {
  // Look up specs from SpacetimeDB local cache
  let specA: FlowerSpec | null = null
  let specB: FlowerSpec | null = null
  for (const spec of conn.db.flower_spec.iter()) {
    if (spec.session_id === sessionAId) specA = spec
    if (spec.session_id === sessionBId) specB = spec
  }

  if (!specA || !specB) {
    console.warn('[merge] Missing spec for session', sessionAId, 'or', sessionBId)
    return
  }

  // Look up session data for flower counts
  let sessionA: FlowerSession | null = null
  let sessionB: FlowerSession | null = null
  for (const s of conn.db.flower_session.iter()) {
    if (s.id === sessionAId) sessionA = s
    if (s.id === sessionBId) sessionB = s
  }

  const totalCount = (sessionA?.flower_count ?? 1) + (sessionB?.flower_count ?? 1)
  const level = levelForCount(totalCount)

  try {
    // Call AI to generate the combination description
    const res = await fetch('/api/flower/combine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spec_a: JSON.parse(specA.spec_json),
        spec_b: JSON.parse(specB.spec_json),
        total_count: totalCount,
        level,
      }),
    })

    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let arrangementJson = ''

    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        arrangementJson += decoder.decode(value, { stream: true })
      }
    }

    // Call SpacetimeDB reducer to perform the merge
    conn.reducers['merge_sessions']?.(sessionAId, sessionBId, arrangementJson)

    console.log('[merge] Merged', sessionAId, '+', sessionBId, '→ total', totalCount, 'flowers')
  } catch (err) {
    console.error('[merge] Failed:', err)
  }
}

function levelForCount(count: number): string {
  if (count <= 1) return 'stem'
  if (count <= 3) return 'group'
  if (count <= 6) return 'bunch'
  if (count <= 9) return 'arrangement'
  if (count <= 19) return 'bouquet'
  if (count <= 49) return 'centerpiece'
  return 'installation'
}
