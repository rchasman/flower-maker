import { useMemo, memo } from "react";
import { useSession } from "../session/SessionProvider.tsx";
import { useFlowerSessions, useFlowerSpecs, useUsers, usePartOverrides } from "../spacetime/hooks.ts";
import type { FlowerSession, FlowerSpec, User } from "../spacetime/types.ts";
import { isVariant } from "../spacetime/types.ts";
import { parseArrangementMeta, type ArrangementMeta } from "../flower/render.ts";
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
  const onlineCount = useMemo(() => users.filter(u => u.online).length, [users]);

  // Build constituent map for arrangement rendering
  const constituentMap = useMemo(() => partOverrides
    .filter(o => o.partPath.startsWith("constituent:"))
    .reduce<Map<string, Array<{ spec: string; sid: number }>>>((acc, o) => {
      const key = String(o.sessionId);
      const idx = parseInt(o.partPath.split(":")[1] ?? "0", 10);
      const existing = acc.get(key) ?? [];
      existing[idx] = { spec: o.overrideJson, sid: idx };
      acc.set(key, existing);
      return acc;
    }, new Map()), [partOverrides]);

  // Build arrangement meta map (AI-generated adornment hints)
  const arrangementMetaMap = useMemo(() => partOverrides
    .filter(o => o.partPath === "arrangement")
    .reduce<Map<string, ArrangementMeta>>((acc, o) => {
      const meta = parseArrangementMeta(o.overrideJson);
      if (meta) acc.set(String(o.sessionId), meta);
      return acc;
    }, new Map()), [partOverrides]);

  // Build a spec lookup by sessionId for O(1) access
  const specBySessionId = useMemo(() => specs.reduce<Map<string, FlowerSpec>>(
    (acc, s) => acc.set(String(s.sessionId), s),
    new Map(),
  ), [specs]);

  // Group all "Designing" sessions by owner
  const sessionsByOwner = useMemo(() => sessions
    .filter(s => isVariant(s.status, "Designing"))
    .reduce<Map<string, FlowerSession[]>>((acc, s) => {
      const key = String(s.owner);
      const list = acc.get(key) ?? [];
      return acc.set(key, [...list, s]);
    }, new Map()), [sessions]);

  // Build zone data: one slot per user
  const zones = useMemo((): readonly ZoneData[] => users
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
    }), [users, sessionsByOwner, identityHex]);

  const userNameMap = useMemo(
    () => new Map(users.map(u => [String(u.identity), u.name])),
    [users],
  );

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* ── TUI Header / Status Bar ── */}
      <header
        style={{
          padding: "0.375rem 1.5ch",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--tui-border)",
          background: "var(--tui-bg-0)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1ch" }}>
          <span className="tui-glow-green" style={{ color: "var(--tui-green)", fontWeight: 600 }}>
            FLOWER-MAKER
          </span>
          <span style={{ color: "var(--tui-border)" }}>│</span>
          <span style={{ color: "var(--tui-fg-3)", fontSize: "var(--tui-font-size-xs)" }}>
            collaborative botanical AI
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: "1.5ch",
            alignItems: "center",
            fontSize: "var(--tui-font-size-xs)",
          }}
        >
          <span style={{ color: "var(--tui-fg-3)" }}>
            <span style={{ color: "var(--tui-cyan)" }}>{onlineCount}</span> online
          </span>
          <span style={{ color: "var(--tui-border)" }}>│</span>
          <span style={{ color: "var(--tui-fg-3)" }}>
            <span style={{ color: "var(--tui-fg-1)" }}>{zones.length}</span> zones
          </span>
          <span style={{ color: "var(--tui-border)" }}>│</span>
          <ConnectionStatus state={state} />
        </div>
      </header>

      {/* ── Zone Grid ── */}
      <div
        className="tui-zone-grid"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        }}
      >
        {zones.map((zone) => (
          <div
            key={String(zone.user.identity)}
            className="tui-zone-enter"
          >
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
              color: "var(--tui-fg-4)",
              fontSize: "var(--tui-font-size-sm)",
              padding: "3rem",
            }}
          >
            no zones active. click your zone to begin designing.
          </div>
        )}

        {state !== "connected" && (
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--tui-fg-4)",
              fontSize: "var(--tui-font-size-sm)",
              padding: "3rem",
            }}
          >
            {state === "connecting" ? (
              <span>
                <span style={{ color: "var(--tui-amber)" }}>[sync]</span>{" "}
                establishing connection<span className="tui-generating" />
              </span>
            ) : (
              <span>
                <span style={{ color: "var(--tui-red)" }}>[err]</span>{" "}
                spacetimedb offline — restart and refresh
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom status bar ── */}
      <div className="tui-status-bar">
        <span>flower-maker v0.1</span>
        <span className="sep">│</span>
        <span>{sessions.filter(s => isVariant(s.status, "Designing")).length} active sessions</span>
        <span className="sep">│</span>
        <span>{specs.length} specs loaded</span>
        <span style={{ marginLeft: "auto" }}>
          spacetimedb
        </span>
      </div>
    </div>
  );
}


/** Empty zone placeholder — subtle crosshair. */
function EmptyZoneIcon({ isYours }: { isYours: boolean }) {
  const color = isYours ? "var(--tui-purple-dim)" : "var(--tui-border)";
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 40 40">
      <line x1="20" y1="10" x2="20" y2="30" stroke={color} strokeWidth="1" />
      <line x1="10" y1="20" x2="30" y2="20" stroke={color} strokeWidth="1" />
      <line x1="13" y1="13" x2="27" y2="27" stroke={color} strokeWidth="0.5" />
      <line x1="27" y1="13" x2="13" y2="27" stroke={color} strokeWidth="0.5" />
      {isYours && (
        <text
          x="20" y="36"
          textAnchor="middle"
          fill="var(--tui-purple-dim)"
          fontSize="3"
          fontFamily="var(--tui-font)"
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

const MemoZoneCard = memo(function ZoneCard({
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
      className="tui-zone-card"
      data-yours={isYours ? "true" : undefined}
      data-offline={!user.online ? "true" : undefined}
    >
      {allSessions.length > 0 ? (
        <PixiMiniCanvas sessions={allSessions} specBySessionId={specBySessionId} constituentMap={constituentMap} arrangementMetaMap={arrangementMetaMap} />
      ) : (
        <EmptyZoneIcon isYours={isYours} />
      )}

      {/* Zone label overlay */}
      <div className="tui-zone-label">
        <span className="name">
          {isYours && <span style={{ color: "var(--tui-purple)", marginRight: "0.5ch" }}>▸</span>}
          {userName ?? String(user.identity).slice(0, 8)}
        </span>
        <span>
          {allSessions.length > 0 && (
            <span style={{ color: "var(--tui-fg-2)" }}>
              {allSessions.length} {allSessions.length === 1 ? "flower" : "flowers"}
            </span>
          )}
          {user.online && (
            <span style={{ color: "var(--tui-green)", marginLeft: "0.5ch", fontSize: "0.5rem" }}>●</span>
          )}
        </span>
      </div>
    </div>
  );
}, (prev, next) =>
  String(prev.zone.user.identity) === String(next.zone.user.identity) &&
  prev.userName === next.userName &&
  prev.zone.user.online === next.zone.user.online &&
  prev.zone.allSessions.length === next.zone.allSessions.length &&
  prev.zone.isYours === next.zone.isYours &&
  prev.specBySessionId === next.specBySessionId &&
  prev.constituentMap === next.constituentMap &&
  prev.arrangementMetaMap === next.arrangementMetaMap &&
  prev.onClick === next.onClick
);

function ConnectionStatus({ state }: { state: string }) {
  const stateConfig: Record<string, { label: string; cls: string }> = {
    connected: { label: "CONNECTED", cls: "tui-badge-green" },
    connecting: { label: "SYNCING", cls: "tui-badge-amber" },
  };
  const config = stateConfig[state] ?? { label: "OFFLINE", cls: "tui-badge-red" };

  return (
    <span className={`tui-badge ${config.cls}`}>
      {config.label}
    </span>
  );
}
