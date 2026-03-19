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
      <div style={{ fontSize: "0.6875rem", color: "#737373", fontWeight: 500 }}>
        {online.length} online
      </div>
      {online.map(user => (
        <div
          key={String(user.identity)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.625rem",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#22c55e",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              color: colorForIdentity(colorMap, String(user.identity)),
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: 500,
            }}
          >
            {user.name ?? String(user.identity).slice(0, 12)}
          </span>
        </div>
      ))}
    </div>
  );
}
