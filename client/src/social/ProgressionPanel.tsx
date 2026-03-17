import type { User } from '../spacetime/types.ts'

interface ProgressionPanelProps {
  user: User | null
}

const SKIN_THRESHOLDS = [
  { name: 'Seedling', xp: 0, color: '#737373' },
  { name: 'Petal Pusher', xp: 500, color: '#22c55e' },
  { name: 'Garden Keeper', xp: 2000, color: '#3b82f6' },
  { name: 'Bloom Lord', xp: 10000, color: '#a855f7' },
  { name: 'Eternal Flower', xp: 50000, color: '#f59e0b' },
]

export function ProgressionPanel({ user }: ProgressionPanelProps) {
  if (!user) return null

  const currentSkin = [...SKIN_THRESHOLDS].reverse().find((s) => user.xp >= s.xp) ?? SKIN_THRESHOLDS[0]!
  const nextSkin = SKIN_THRESHOLDS.find((s) => s.xp > user.xp)
  const progress = nextSkin
    ? ((user.xp - (currentSkin?.xp ?? 0)) / (nextSkin.xp - (currentSkin?.xp ?? 0))) * 100
    : 100

  return (
    <div style={{
      padding: '0.75rem',
      background: '#141414',
      borderRadius: '0.375rem',
      border: '1px solid #1a1a1a',
      fontSize: '0.6875rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ color: currentSkin?.color ?? '#737373', fontWeight: 500 }}>
          {currentSkin?.name ?? 'Unknown'}
        </span>
        <span style={{ color: '#525252' }}>
          {user.xp} XP · lvl {user.level}
        </span>
      </div>

      {nextSkin && (
        <>
          <div style={{
            height: '0.25rem',
            background: '#1a1a1a',
            borderRadius: '0.125rem',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: nextSkin.color,
              borderRadius: '0.125rem',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ color: '#404040', fontSize: '0.625rem', marginTop: '0.25rem' }}>
            {nextSkin.xp - user.xp} XP to {nextSkin.name}
          </div>
        </>
      )}

      <div style={{ color: '#525252', marginTop: '0.375rem' }}>
        {user.total_orders} orders placed
      </div>
    </div>
  )
}
