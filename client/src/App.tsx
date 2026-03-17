import { useState } from 'react'

type View = 'grid' | 'designer'

export function App() {
  const [view, setView] = useState<View>('grid')

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {view === 'grid' ? (
        <GridView onEnterDesigner={() => setView('designer')} />
      ) : (
        <DesignerView onBackToGrid={() => setView('grid')} />
      )}
    </div>
  )
}

function GridView({ onEnterDesigner }: { onEnterDesigner: () => void }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '1.5rem',
    }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 300, letterSpacing: '-0.02em' }}>
        flower-maker
      </h1>
      <p style={{ color: '#737373', maxWidth: '28rem', textAlign: 'center', lineHeight: 1.6 }}>
        Design bouquets. See everyone designing live. Place real orders as JSON payloads.
      </p>
      <button
        onClick={onEnterDesigner}
        style={{
          padding: '0.75rem 2rem',
          background: '#262626',
          color: '#e5e5e5',
          border: '1px solid #404040',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        Enter your zone
      </button>
      <p style={{ color: '#525252', fontSize: '0.75rem', marginTop: '2rem' }}>
        Grid of live zones will render here via PixiJS
      </p>
    </div>
  )
}

function DesignerView({ onBackToGrid }: { onBackToGrid: () => void }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '1.5rem',
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 300 }}>Your Zone</h2>
      <p style={{ color: '#737373' }}>Designer canvas + template picker will render here</p>
      <button
        onClick={onBackToGrid}
        style={{
          padding: '0.5rem 1.5rem',
          background: 'transparent',
          color: '#a3a3a3',
          border: '1px solid #333',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          fontSize: '0.8125rem',
        }}
      >
        Back to grid
      </button>
    </div>
  )
}
