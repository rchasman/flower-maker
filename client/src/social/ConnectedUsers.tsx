import { useMemo } from "react";
import { useSession } from "../session/SessionProvider.tsx";
import { useUsers } from "../spacetime/hooks.ts";
import { buildColorMap, colorForIdentity } from "./Chat.tsx";

export function ConnectedUsers() {
  const { conn } = useSession();
  const users = useUsers(conn);

  const colorMap = useMemo(() => buildColorMap(users), [users]);
  const online = users.filter(u => u.online);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <div
        style={{
          fontSize: "var(--font-size-xs)",
          color: "var(--positive)",
          marginBottom: "0.25rem",
        }}
      >
        ── OPERATORS ONLINE ({online.length})
      </div>
      {online.map(user => (
        <div
          key={String(user.identity)}
          className="log-entry"
          style={{ display: "flex", alignItems: "center", gap: "1ch" }}
        >
          <span style={{ color: "var(--positive)", fontSize: "0.5rem" }}>
            ●
          </span>
          <span
            className="nick"
            style={{ color: colorForIdentity(colorMap, String(user.identity)) }}
          >
            {user.name ?? String(user.identity).slice(0, 12)}
          </span>
        </div>
      ))}
      {online.length === 0 && (
        <div
          style={{
            color: "var(--text-quaternary)",
            fontSize: "var(--font-size-sm)",
          }}
        >
          No one else is connected.
        </div>
      )}
    </div>
  );
}
