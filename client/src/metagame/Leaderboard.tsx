import { useState } from 'react'
import { useSession } from '../session/SessionProvider.tsx'
import { useLeaderboard, useEnvironments } from '../spacetime/hooks.ts'

export function Leaderboard() {
  const { conn } = useSession()
  const environments = useEnvironments(conn)
  const leaderboard = useLeaderboard(conn)
  const [selectedEnvId, setSelectedEnvId] = useState<number | null>(null)

  const activeEnvs = environments.filter((e) => e.is_active)
  const currentEnvId = selectedEnvId ?? activeEnvs[0]?.id ?? null
  const currentEnv = activeEnvs.find((e) => e.id === currentEnvId)

  const entries = leaderboard
    .filter((e) => e.environment_id === currentEnvId)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Environment tabs */}
      <div style={{
        display: 'flex', gap: '0.25rem',
        flexWrap: 'wrap',
      }}>
        {activeEnvs.map((env) => (
          <button
            key={env.id}
            onClick={() => setSelectedEnvId(env.id)}
            style={{
              padding: '0.25rem 0.5rem',
              background: env.id === currentEnvId ? '#262626' : 'transparent',
              border: '1px solid #262626',
              borderRadius: '0.25rem',
              color: env.id === currentEnvId ? '#e5e5e5' : '#525252',
              cursor: 'pointer',
              fontSize: '0.625rem',
            }}
          >
            {env.name}
          </button>
        ))}
      </div>

      {/* Leaderboard entries */}
      {currentEnv && (
        <div style={{ fontSize: '0.6875rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0.25rem 0',
            color: '#525252',
            borderBottom: '1px solid #1a1a1a',
            fontWeight: 500,
          }}>
            <span>#</span>
            <span style={{ flex: 1, marginLeft: '0.5rem' }}>Flower</span>
            <span>Score</span>
          </div>

          {entries.length === 0 && (
            <div style={{ padding: '1rem', color: '#404040', textAlign: 'center' }}>
              No entries yet for {currentEnv.name}.
            </div>
          )}

          {entries.map((entry, i) => (
            <div key={entry.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.375rem 0',
              borderBottom: '1px solid #0d0d0d',
              color: '#a3a3a3',
            }}>
              <span style={{
                width: '1.25rem',
                color: i < 3 ? ['#fbbf24', '#a3a3a3', '#cd7f32'][i] : '#525252',
                fontWeight: i < 3 ? 600 : 400,
              }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, marginLeft: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.flower_name}
              </span>
              <span style={{
                fontFamily: "'Geist Mono', monospace",
                color: entry.score > 70 ? '#22c55e' : entry.score > 40 ? '#eab308' : '#ef4444',
              }}>
                {entry.score.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
