import { useMemo, memo } from "react";
import { useSession } from "../session/SessionProvider.tsx";
import {
  useFlowerSessions,
  useFlowerSpecs,
  useUsers,
  usePartOverrides,
} from "../spacetime/hooks.ts";
import type { FlowerSession, FlowerSpec, User } from "../spacetime/types.ts";
import { isVariant } from "../spacetime/types.ts";
import {
  parseArrangementMeta,
  type ArrangementMeta,
} from "../flower/render.ts";
import { PixiMiniCanvas } from "./PixiMiniCanvas.tsx";

interface FlowerGridProps {
  onEnterDesigner: () => void;
}

type ZoneData = {
  user: User;
  allSessions: readonly FlowerSession[];
  isYours: boolean;
};

export function FlowerGrid({ onEnterDesigner }: FlowerGridProps) {
  const { state, conn, identityHex } = useSession();
  const sessions = useFlowerSessions(conn);
  const specs = useFlowerSpecs(conn);
  const users = useUsers(conn);
  const partOverrides = usePartOverrides(conn);
  const onlineCount = useMemo(
    () => users.filter(u => u.online).length,
    [users],
  );

  // Build constituent map for arrangement rendering
  const constituentMap = useMemo(
    () =>
      partOverrides
        .filter(o => o.partPath.startsWith("constituent:"))
        .reduce<Map<string, Array<{ spec: string; sid: number }>>>((acc, o) => {
          const key = String(o.sessionId);
          const idx = parseInt(o.partPath.split(":")[1] ?? "0", 10);
          const existing = acc.get(key) ?? [];
          existing[idx] = { spec: o.overrideJson, sid: idx };
          acc.set(key, existing);
          return acc;
        }, new Map()),
    [partOverrides],
  );

  // Build arrangement meta map (AI-generated adornment hints)
  const arrangementMetaMap = useMemo(
    () =>
      partOverrides
        .filter(o => o.partPath === "arrangement")
        .reduce<Map<string, ArrangementMeta>>((acc, o) => {
          const meta = parseArrangementMeta(o.overrideJson);
          if (meta) acc.set(String(o.sessionId), meta);
          return acc;
        }, new Map()),
    [partOverrides],
  );

  // Build a spec lookup by sessionId for O(1) access
  const specBySessionId = useMemo(
    () =>
      specs.reduce<Map<string, FlowerSpec>>(
        (acc, s) => acc.set(String(s.sessionId), s),
        new Map(),
      ),
    [specs],
  );

  // Group all "Designing" sessions by owner
  const sessionsByOwner = useMemo(
    () =>
      sessions
        .filter(s => isVariant(s.status, "Designing"))
        .reduce<Map<string, FlowerSession[]>>((acc, s) => {
          const key = String(s.owner);
          const list = acc.get(key) ?? [];
          return acc.set(key, [...list, s]);
        }, new Map()),
    [sessions],
  );

  // Build zone data: one slot per user
  const zones = useMemo(
    (): readonly ZoneData[] =>
      users
        .map((user): ZoneData => ({
          user,
          allSessions: sessionsByOwner.get(String(user.identity)) ?? [],
          isYours: String(user.identity) === identityHex,
        }))
        .filter(z => z.allSessions.length > 0 || z.isYours)
        .sort((a, b) => {
          if (a.isYours) return -1;
          if (b.isYours) return 1;
          if (a.user.online && !b.user.online) return -1;
          if (!a.user.online && b.user.online) return 1;
          if (a.user.online && b.user.online) {
            return Number(a.user.joinedAt) - Number(b.user.joinedAt);
          }
          return Number(b.user.totalOrders) - Number(a.user.totalOrders);
        }),
    [users, sessionsByOwner, identityHex],
  );

  const userNameMap = useMemo(
    () => new Map(users.map(u => [String(u.identity), u.name])),
    [users],
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
      <header
        style={{
          padding: "0.75rem 1.5ch",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "1.5ch" }}>
          <span className="wordmark">flower-maker</span>
          <span className="label">Everyone designing flowers, live.</span>
        </div>

        <div
          style={{
            display: "flex",
            gap: "2ch",
            alignItems: "center",
          }}
        >
          <span className="label">
            <span style={{ color: "var(--text-primary)" }}>{onlineCount}</span>{" "}
            online
          </span>
          <span className="label">
            <span style={{ color: "var(--text-primary)" }}>{zones.length}</span>{" "}
            zones
          </span>
          <ConnectionStatus state={state} />
        </div>
      </header>

      {/* ── Zone Grid ── */}
      <div
        className="zone-grid"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        }}
      >
        {zones.map(zone => (
          <div key={String(zone.user.identity)} className="zone-enter">
            <MemoZoneCard
              zone={zone}
              specBySessionId={specBySessionId}
              constituentMap={constituentMap}
              arrangementMetaMap={arrangementMetaMap}
              userName={userNameMap.get(String(zone.user.identity))}
              onClick={zone.isYours ? onEnterDesigner : undefined}
            />
          </div>
        ))}

        {/* Empty state */}
        {zones.length === 0 && state === "connected" && (
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-quaternary)",
              fontSize: "var(--font-size-sm)",
              padding: "3rem",
            }}
          >
            No one is designing yet. Click your zone to start.
          </div>
        )}

        {state !== "connected" && (
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-quaternary)",
              fontSize: "var(--font-size-sm)",
              padding: "3rem",
            }}
          >
            {state === "connecting" ? (
              <span>
                Connecting
                <span className="generating" />
              </span>
            ) : (
              <span style={{ color: "var(--negative)" }}>
                The database is offline. Restart it and refresh.
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom status bar ── */}
      <div className="status-bar">
        <span>flower-maker v0.1</span>
        <span className="sep">│</span>
        <span>
          {sessions.filter(s => isVariant(s.status, "Designing")).length} active
          sessions
        </span>
        <span className="sep">│</span>
        <span>{specs.length} specs loaded</span>
        <span style={{ marginLeft: "auto" }}>spacetimedb</span>
      </div>
    </div>
  );
}

/** Empty zone placeholder — subtle crosshair. */
function EmptyZoneIcon({ isYours }: { isYours: boolean }) {
  const color = isYours ? "var(--accent-dim)" : "var(--border)";
  return (
    <svg
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      viewBox="0 0 40 40"
    >
      <line x1="20" y1="10" x2="20" y2="30" stroke={color} strokeWidth="1" />
      <line x1="10" y1="20" x2="30" y2="20" stroke={color} strokeWidth="1" />
      <line x1="13" y1="13" x2="27" y2="27" stroke={color} strokeWidth="0.5" />
      <line x1="27" y1="13" x2="13" y2="27" stroke={color} strokeWidth="0.5" />
      {isYours && (
        <text
          x="20"
          y="36"
          textAnchor="middle"
          fill="var(--accent-dim)"
          fontSize="3"
          fontFamily="var(--font-mono)"
        >
          YOUR ZONE
        </text>
      )}
    </svg>
  );
}

// ── Zone card ────────────────────────────────────────────────────────────

type ZoneCardProps = {
  zone: ZoneData;
  specBySessionId: Map<string, FlowerSpec>;
  constituentMap: Map<string, Array<{ spec: string; sid: number }>>;
  arrangementMetaMap: Map<string, ArrangementMeta>;
  userName?: string;
  onClick?: () => void;
};

const MemoZoneCard = memo(
  function ZoneCard({
    zone,
    specBySessionId,
    constituentMap,
    arrangementMetaMap,
    userName,
    onClick,
  }: ZoneCardProps) {
    const { user, allSessions, isYours } = zone;

    return (
      <div
        onClick={onClick}
        className="zone-card"
        data-yours={isYours ? "true" : undefined}
        data-offline={!user.online ? "true" : undefined}
      >
        {allSessions.length > 0 ? (
          <PixiMiniCanvas
            sessions={allSessions}
            specBySessionId={specBySessionId}
            constituentMap={constituentMap}
            arrangementMetaMap={arrangementMetaMap}
          />
        ) : (
          <EmptyZoneIcon isYours={isYours} />
        )}

        {/* Zone label overlay */}
        <div className="zone-label">
          <span className="name">
            {isYours && (
              <span style={{ color: "var(--accent)", marginRight: "0.5ch" }}>
                ▸
              </span>
            )}
            {userName ?? String(user.identity).slice(0, 8)}
          </span>
          <span>
            {allSessions.length > 0 && (
              <span style={{ color: "var(--text-tertiary)" }}>
                {allSessions.length}{" "}
                {allSessions.length === 1 ? "flower" : "flowers"}
              </span>
            )}
            {user.online && (
              <span
                style={{
                  color: "var(--positive)",
                  marginLeft: "0.5ch",
                  fontSize: "0.5rem",
                }}
              >
                ●
              </span>
            )}
          </span>
        </div>
      </div>
    );
  },
  (prev, next) =>
    String(prev.zone.user.identity) === String(next.zone.user.identity) &&
    prev.userName === next.userName &&
    prev.zone.user.online === next.zone.user.online &&
    prev.zone.allSessions.length === next.zone.allSessions.length &&
    prev.zone.isYours === next.zone.isYours &&
    prev.specBySessionId === next.specBySessionId &&
    prev.constituentMap === next.constituentMap &&
    prev.arrangementMetaMap === next.arrangementMetaMap &&
    prev.onClick === next.onClick,
);

function ConnectionStatus({ state }: { state: string }) {
  const stateConfig: Record<string, { label: string; cls: string }> = {
    connected: { label: "Connected", cls: "badge-positive" },
    connecting: { label: "Connecting", cls: "badge-muted" },
  };
  const config = stateConfig[state] ?? {
    label: "Offline",
    cls: "badge-negative",
  };

  return <span className={`badge ${config.cls}`}>{config.label}</span>;
}
