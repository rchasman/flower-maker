import { useSession } from '../session/SessionProvider.tsx'
import { useUsers } from '../spacetime/hooks.ts'

export function ConnectedUsers() {
  const { conn } = useSession()
  const users = useUsers(conn)

  const online = users.filter((u) => u.online)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div style={{ fontSize: '0.6875rem', color: '#737373', fontWeight: 500 }}>
        {online.length} online
      </div>
      {online.map((user) => (
        <div key={user.identity} style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          fontSize: '0.625rem',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#22c55e', flexShrink: 0,
          }} />
          <span style={{ color: '#a3a3a3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.name ?? user.identity.slice(0, 12)}
          </span>
          <span style={{ color: '#404040', marginLeft: 'auto', flexShrink: 0 }}>
            lvl {user.level}
          </span>
        </div>
      ))}
    </div>
  )
}
