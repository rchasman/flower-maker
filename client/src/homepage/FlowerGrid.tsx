import { run, scoreColor } from "../lib/utils.ts";
import { useSession } from "../session/SessionProvider.tsx";
import { useFlowerSessions, useUsers } from "../spacetime/hooks.ts";
import type { FlowerSession } from "../spacetime/types.ts";
import { isVariant } from "../spacetime/types.ts";

interface FlowerGridProps {
  onEnterDesigner: () => void;
}

export function FlowerGrid({ onEnterDesigner }: FlowerGridProps) {
  const { state, conn } = useSession();
  const sessions = useFlowerSessions(conn);
  const users = useUsers(conn);
  const onlineCount = users.filter(u => u.online).length;

  const activeSessions = sessions.filter(
    s => !isVariant(s.status, "Complete"),
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "1rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #262626",
        }}
      >
        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 400,
            letterSpacing: "-0.02em",
          }}
        >
          flower-maker
        </h1>
        <div
          style={{
            display: "flex",
            gap: "1rem",
            alignItems: "center",
            fontSize: "0.8125rem",
            color: "#737373",
          }}
        >
          <span>{onlineCount} online</span>
          <span>{activeSessions.length} flowers</span>
          <ConnectionDot state={state} />
        </div>
      </header>

      {/* Grid */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "2px",
          padding: "2px",
          overflow: "auto",
          background: "#0a0a0a",
        }}
      >
        {/* Your zone — always first */}
        <ZoneCard label="Your Zone" isYours onClick={onEnterDesigner} />

        {/* Other people's zones */}
        {activeSessions.map(session => (
          <ZoneCard
            key={Number(session.id)}
            session={session}
            label={session.prompt.slice(0, 30)}
          />
        ))}

        {/* Empty state */}
        {activeSessions.length === 0 && state === "connected" && (
          <div
            style={{
              gridColumn: "2 / -1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#404040",
              fontSize: "0.8125rem",
              padding: "3rem",
            }}
          >
            No flowers yet. Click your zone to start designing.
          </div>
        )}

        {state !== "connected" && (
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#404040",
              fontSize: "0.8125rem",
              padding: "3rem",
            }}
          >
            {state === "connecting"
              ? "Connecting to SpacetimeDB..."
              : "Not connected — start SpacetimeDB and refresh"}
          </div>
        )}
      </div>
    </div>
  );
}

function ZoneCard({
  session,
  label,
  isYours,
  onClick,
}: {
  session?: FlowerSession;
  label: string;
  isYours?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        aspectRatio: "1",
        background: isYours ? "#1a1a2e" : "#141414",
        border: isYours ? "1px solid #3b3b6d" : "1px solid #1a1a1a",
        borderRadius: "0.25rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s",
        fontSize: "0.75rem",
        color: isYours ? "#8b8bd4" : "#525252",
      }}
    >
      <span style={{ fontSize: "1.5rem" }}>
        {run(() => {
          if (isYours) return "✦";
          return session ? "🌸" : "·";
        })}
      </span>
      <span
        style={{
          maxWidth: "90%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {session && (
        <span style={{ fontSize: "0.625rem", color: "#404040" }}>
          lvl {Number(session.arrangementLevel)} · {Number(session.flowerCount)}f
        </span>
      )}
    </div>
  );
}

function ConnectionDot({ state }: { state: string }) {
  const stateScores: Record<string, number> = {
    connected: 100,
    connecting: 50,
  };
  const color = scoreColor(stateScores[state] ?? 0);
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        display: "inline-block",
      }}
    />
  );
}
