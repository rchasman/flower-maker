import { run, scoreColor } from "../lib/utils.ts";
import { useSession } from "../session/SessionProvider.tsx";
import { useFlowerSessions, useOrders, useUsers } from "../spacetime/hooks.ts";
import type { FlowerSession, User } from "../spacetime/types.ts";
import { isVariant } from "../spacetime/types.ts";

interface FlowerGridProps {
  onEnterDesigner: () => void;
}

type ZoneData = {
  user: User;
  session: FlowerSession | null;
  incomingOrders: number;
  isYours: boolean;
};

export function FlowerGrid({ onEnterDesigner }: FlowerGridProps) {
  const { state, conn } = useSession();
  const sessions = useFlowerSessions(conn);
  const users = useUsers(conn);
  const orders = useOrders(conn);
  const onlineCount = users.filter(u => u.online).length;

  const myIdentity = conn ? String(conn.identity) : null;

  // Build a session lookup by id for O(1) access
  const sessionById = sessions.reduce<Map<string, FlowerSession>>(
    (acc, s) => acc.set(String(s.id), s),
    new Map(),
  );

  // Count incoming orders per session owner
  const ordersByOwner = orders.reduce<Map<string, number>>((acc, order) => {
    const session = sessionById.get(String(order.sessionId));
    if (!session) return acc;
    const ownerKey = String(session.owner);
    return acc.set(ownerKey, (acc.get(ownerKey) ?? 0) + 1);
  }, new Map());

  // Build zone data: one slot per user
  const zones: readonly ZoneData[] = users
    .map((user): ZoneData => {
      const currentSession = run(() => {
        if (user.currentSessionId == null) return null;
        return sessionById.get(String(user.currentSessionId)) ?? null;
      });
      return {
        user,
        session: currentSession,
        incomingOrders: ordersByOwner.get(String(user.identity)) ?? 0,
        isYours: String(user.identity) === myIdentity,
      };
    })
    .sort((a, b) => {
      // "Your Zone" always first
      if (a.isYours) return -1;
      if (b.isYours) return 1;
      // Online users before offline
      if (a.user.online && !b.user.online) return -1;
      if (!a.user.online && b.user.online) return 1;
      // Online: sort by joinedAt ascending
      if (a.user.online && b.user.online) {
        return Number(a.user.joinedAt) - Number(b.user.joinedAt);
      }
      // Offline: sort by totalOrders descending
      return Number(b.user.totalOrders) - Number(a.user.totalOrders);
    });

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
          <span>{zones.length} zones</span>
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
        {zones.map(zone => (
          <ZoneCard
            key={String(zone.user.identity)}
            zone={zone}
            onClick={zone.isYours ? onEnterDesigner : undefined}
          />
        ))}

        {/* Empty state */}
        {zones.length === 0 && state === "connected" && (
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
            No zones yet. Click your zone to start designing.
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
              : "Not connected -- start SpacetimeDB and refresh"}
          </div>
        )}
      </div>
    </div>
  );
}

function FlowerIcon({ designing }: { designing: boolean }) {
  if (designing) {
    return (
      <span
        style={{
          fontSize: "1.25rem",
          color: "#8b8bd4",
          fontFamily: "monospace",
        }}
      >
        *
      </span>
    );
  }

  // Simple dot-pattern flower: 5 dots around a center
  return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="2.5" fill="#525252" />
      <circle cx="12" cy="6" r="1.5" fill="#404040" />
      <circle cx="17" cy="10" r="1.5" fill="#404040" />
      <circle cx="15" cy="16" r="1.5" fill="#404040" />
      <circle cx="9" cy="16" r="1.5" fill="#404040" />
      <circle cx="7" cy="10" r="1.5" fill="#404040" />
    </svg>
  );
}

function ZoneCard({
  zone,
  onClick,
}: {
  zone: ZoneData;
  onClick?: () => void;
}) {
  const { user, session, incomingOrders, isYours } = zone;
  const isDesigning = session != null && isVariant(session.status, "Designing");
  const displayName = run(() => {
    if (isYours) return "Your Zone";
    return user.name ?? "Anonymous";
  });

  const subtitle = run(() => {
    if (session && isDesigning) {
      return session.prompt.slice(0, 30);
    }
    if (!user.online && incomingOrders > 0) {
      return `${incomingOrders} orders`;
    }
    if (!user.online) {
      return `${Number(user.totalOrders)} total orders`;
    }
    return null;
  });

  return (
    <div
      onClick={onClick}
      style={{
        aspectRatio: "1",
        background: isYours ? "#1a1a2e" : "#141414",
        border: run(() => {
          if (isYours) return "1px solid #3b3b6d";
          if (user.online) return "1px solid #1f1f1f";
          return "1px solid #1a1a1a";
        }),
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
        opacity: user.online ? 1 : 0.6,
      }}
    >
      <FlowerIcon designing={isDesigning} />

      <span
        style={{
          maxWidth: "90%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {displayName}
      </span>

      {subtitle && (
        <span
          style={{
            fontSize: "0.625rem",
            color: "#404040",
            maxWidth: "90%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {subtitle}
        </span>
      )}

      <span style={{ fontSize: "0.5625rem", color: "#333" }}>
        lvl {Number(user.level)}
      </span>
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
