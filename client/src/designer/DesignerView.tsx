import { useState } from 'react'
import { useSession } from '../session/SessionProvider.tsx'
import { useFlowerSessions } from '../spacetime/hooks.ts'
import { TemplatePicker } from './TemplatePicker.tsx'

interface DesignerViewProps {
  onBackToGrid: () => void
}

export function DesignerView({ onBackToGrid }: DesignerViewProps) {
  const { conn } = useSession()
  const sessions = useFlowerSessions(conn)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Filter to only your designing sessions (placeholder — needs identity)
  const mySessions = sessions.filter((s) => s.status === 'Designing')

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      {/* Left sidebar — template picker */}
      <aside style={{
        width: '280px',
        borderRight: '1px solid #262626',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid #262626',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 500 }}>Templates</h2>
          <button
            onClick={onBackToGrid}
            style={{
              background: 'none',
              border: 'none',
              color: '#737373',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            ← Grid
          </button>
        </div>
        <TemplatePicker />
      </aside>

      {/* Center — canvas area */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          background: '#0d0d0d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#404040',
          fontSize: '0.8125rem',
        }}>
          Designer canvas with rapier2d physics will render here
        </div>

        {/* My flowers list */}
        {mySessions.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '0.5rem',
            background: '#1a1a1a',
            padding: '0.5rem',
            borderRadius: '0.5rem',
            border: '1px solid #262626',
          }}>
            {mySessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                style={{
                  padding: '0.375rem 0.75rem',
                  background: selectedId === s.id ? '#262626' : 'transparent',
                  border: 'none',
                  borderRadius: '0.25rem',
                  color: selectedId === s.id ? '#e5e5e5' : '#737373',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                }}
              >
                {s.prompt.slice(0, 15)}...
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Right sidebar — properties / orders (placeholder) */}
      <aside style={{
        width: '280px',
        borderLeft: '1px solid #262626',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        <h2 style={{ fontSize: '0.875rem', fontWeight: 500 }}>Properties</h2>
        {selectedId ? (
          <p style={{ color: '#737373', fontSize: '0.75rem' }}>
            Session #{selectedId} selected. Part editor + fitness display will render here.
          </p>
        ) : (
          <p style={{ color: '#525252', fontSize: '0.75rem' }}>
            Select a flower or pick a template to start.
          </p>
        )}

        <div style={{ marginTop: 'auto' }}>
          <button style={{
            width: '100%',
            padding: '0.625rem',
            background: '#166534',
            color: '#e5e5e5',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.8125rem',
          }}>
            Place Order →
          </button>
        </div>
      </aside>
    </div>
  )
}
