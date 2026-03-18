import { run, scoreColor } from "../lib/utils.ts";
import { useSession } from "../session/SessionProvider.tsx";
import { useFlowerSessions, useFlowerSpecs, useOrders, useUsers, usePartOverrides } from "../spacetime/hooks.ts";
import type { FlowerSession, FlowerSpec, FlowerPartOverride, User } from "../spacetime/types.ts";
import { isVariant } from "../spacetime/types.ts";
import { createFlowerPlan, createArrangementPlan, cmdsToSvgD, hexString } from "../flower/render.ts";

interface FlowerGridProps {
  onEnterDesigner: () => void;
}

type ZoneData = {
  user: User;
  session: FlowerSession | null;
  /** All "Designing" sessions owned by this user — for the live mini-canvas. */
  allSessions: readonly FlowerSession[];
  incomingOrders: number;
  isYours: boolean;
};

export function FlowerGrid({ onEnterDesigner }: FlowerGridProps) {
  const { state, conn, identityHex } = useSession();
  const sessions = useFlowerSessions(conn);
  const specs = useFlowerSpecs(conn);
  const users = useUsers(conn);
  const orders = useOrders(conn);
  const partOverrides = usePartOverrides(conn);
  const onlineCount = users.filter(u => u.online).length;

  // Build constituent map for arrangement rendering
  const constituentMap = partOverrides
    .filter(o => o.partPath.startsWith("constituent:"))
    .reduce<Map<string, Array<{ specJson: string; sid: number }>>>((acc, o) => {
      const key = String(o.sessionId);
      const idx = parseInt(o.partPath.split(":")[1] ?? "0", 10);
      const existing = acc.get(key) ?? [];
      existing[idx] = { specJson: o.overrideJson, sid: idx };
      acc.set(key, existing);
      return acc;
    }, new Map());

  // Build a spec lookup by sessionId for O(1) access
  const specBySessionId = specs.reduce<Map<string, FlowerSpec>>(
    (acc, s) => acc.set(String(s.sessionId), s),
    new Map(),
  );

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

  // Group all "Designing" sessions by owner
  const sessionsByOwner = sessions
    .filter(s => isVariant(s.status, "Designing"))
    .reduce<Map<string, FlowerSession[]>>((acc, s) => {
      const key = String(s.owner);
      const list = acc.get(key) ?? [];
      return acc.set(key, [...list, s]);
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
        allSessions: sessionsByOwner.get(String(user.identity)) ?? [],
        incomingOrders: ordersByOwner.get(String(user.identity)) ?? 0,
        isYours: String(user.identity) === identityHex,
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
            specBySessionId={specBySessionId}
            constituentMap={constituentMap}
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

const ARRANGEMENT_LEVELS: readonly string[] = [
  "Stem",
  "Group",
  "Bunch",
  "Arrangement",
  "Bouquet",
  "Centerpiece",
  "Installation",
];

function arrangementName(level: number): string {
  return ARRANGEMENT_LEVELS[Math.min(level, ARRANGEMENT_LEVELS.length) - 1] ?? "Stem";
}

// ── Mini canvas — live SVG replica of a user's designer canvas ───────────
// Uses the exact same math as FlowerCanvas (PixiJS) via shared render module.

/** Render a single flower from its spec-driven plan. */
function SvgFlower({ sid, x, y, r, specJson, plan: precomputedPlan }: { sid: number; x: number; y: number; r: number; specJson?: string; plan?: ReturnType<typeof createFlowerPlan> }) {
  const plan = precomputedPlan ?? createFlowerPlan(specJson, sid);
  const scale = r;

  return (
    <g>
      {/* Sepals — behind petals */}
      {plan.sepals.map((sepal, i) => (
        <path
          key={`sep-${i}`}
          d={cmdsToSvgD(sepal.cmds, x, y, scale)}
          fill={hexString(sepal.color)}
          opacity={0.85}
        />
      ))}

      {/* Petal layers — outer first (lower z), inner last (upper z) */}
      {plan.layers.map((layer, li) =>
        layer.petals.map((petal, pi) => (
          <path
            key={`l${li}-p${pi}`}
            d={cmdsToSvgD(petal.cmds, x, y, scale)}
            fill={hexString(layer.color)}
            opacity={layer.opacity}
          />
        )),
      )}

      {/* Stamens */}
      {plan.center.stamens.map((s, i) => {
        const sx = x + Math.cos(s.angle) * s.length * scale;
        const sy = y + Math.sin(s.angle) * s.length * scale;
        return (
          <g key={`stm-${i}`}>
            <line
              x1={x}
              y1={y}
              x2={sx}
              y2={sy}
              stroke={hexString(s.filamentColor)}
              strokeWidth={Math.max(0.3, scale * 0.02)}
              opacity={0.7}
            />
            <circle
              cx={sx}
              cy={sy}
              r={s.antherRadius * scale}
              fill={hexString(s.antherColor)}
            />
          </g>
        );
      })}

      {/* Center disc (pistil) */}
      <circle cx={x} cy={y} r={plan.center.discRadius * scale} fill={hexString(plan.center.discColor)} />
      <circle cx={x} cy={y} r={plan.center.highlightRadius * scale} fill={hexString(plan.center.highlightColor)} opacity={0.6} />
    </g>
  );
}

/** Render a multi-flower arrangement from its pre-computed plan. */
function SvgArrangement({ x, y, r, constituents, level }: {
  x: number; y: number; r: number;
  constituents: ReadonlyArray<{ specJson: string; sid: number }>;
  level: number;
}) {
  const plan = createArrangementPlan(constituents, level);
  const scale = r;

  return (
    <g>
      {/* Stems */}
      {plan.members.map((member, i) => (
        <path
          key={`stem-${i}`}
          d={cmdsToSvgD(member.stem.cmds, x, y, scale)}
          fill={hexString(member.stem.color)}
          opacity={0.9}
        />
      ))}

      {/* Leaves */}
      {plan.members.map((member, mi) =>
        member.leaves.map((leaf, li) => (
          <path
            key={`leaf-${mi}-${li}`}
            d={cmdsToSvgD(leaf.cmds, x, y, scale)}
            fill={hexString(leaf.color)}
            opacity={0.85}
          />
        )),
      )}

      {/* Flower heads (back to front) */}
      {[...plan.members].reverse().map((member, i) => {
        const flowerScale = scale * member.scale;
        const ox = x + member.offsetX * scale;
        const oy = y + member.offsetY * scale;
        return (
          <SvgFlower key={`head-${i}`} sid={member.flowerPlan === plan.members[0]?.flowerPlan ? 0 : i + 1} x={ox} y={oy} r={flowerScale} specJson={undefined} plan={member.flowerPlan} />
        );
      })}
    </g>
  );
}

/** Live mini-canvas: renders all of a user's flowers at their real positions, scaled to fit. */
function MiniCanvas({ sessions, specBySessionId, constituentMap, size }: { sessions: readonly FlowerSession[]; specBySessionId: Map<string, FlowerSpec>; constituentMap: Map<string, Array<{ specJson: string; sid: number }>>; size: number }) {
  if (sessions.length === 0) return null;

  // Compute bounding box of all flower positions
  const positions = sessions.map(s => ({
    sid: Number(s.id),
    sessionKey: String(s.id),
    x: Number(s.canvasX) || 0,
    y: Number(s.canvasY) || 0,
  }));

  // If all at (0,0), spread them in a grid
  const allZero = positions.every(p => p.x === 0 && p.y === 0);
  const resolved = allZero
    ? positions.map((p, i) => {
        const cols = Math.max(1, Math.ceil(Math.sqrt(positions.length)));
        const spacing = 80;
        const col = i % cols;
        const row = Math.floor(i / cols);
        return { ...p, x: 100 + col * spacing, y: 100 + row * spacing };
      })
    : positions;

  const xs = resolved.map(p => p.x);
  const ys = resolved.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Add padding around the bounding box
  const pad = 30;
  const bboxW = Math.max(maxX - minX + pad * 2, 60);
  const bboxH = Math.max(maxY - minY + pad * 2, 60);
  const vbX = minX - pad;
  const vbY = minY - pad;

  // Flower radius scales with how many there are (smaller when crowded)
  const flowerR = Math.max(6, Math.min(14, bboxW / (sessions.length + 1)));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${vbX} ${vbY} ${bboxW} ${bboxH}`}
      style={{ borderRadius: "0.25rem" }}
    >
      <rect x={vbX} y={vbY} width={bboxW} height={bboxH} fill="#0d0d0d" />
      {resolved.map(p => {
        const constituents = constituentMap.get(p.sessionKey);
        if (constituents && constituents.length > 1) {
          const level = Math.min(7, Math.ceil(constituents.length / 3));
          return <SvgArrangement key={p.sid} x={p.x} y={p.y} r={flowerR} constituents={constituents} level={level} />;
        }
        return <SvgFlower key={p.sid} sid={p.sid} x={p.x} y={p.y} r={flowerR} specJson={specBySessionId.get(p.sessionKey)?.specJson} />;
      })}
    </svg>
  );
}

/** Empty zone placeholder — subtle crosshair. */
function EmptyZoneIcon({ isYours }: { isYours: boolean }) {
  const color = isYours ? "#6b6bb4" : "#333";
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <line x1="20" y1="10" x2="20" y2="30" stroke={color} strokeWidth="1" />
      <line x1="10" y1="20" x2="30" y2="20" stroke={color} strokeWidth="1" />
      <line x1="13" y1="13" x2="27" y2="27" stroke={color} strokeWidth="0.5" />
      <line x1="27" y1="13" x2="13" y2="27" stroke={color} strokeWidth="0.5" />
    </svg>
  );
}

// ── Zone card ────────────────────────────────────────────────────────────

function ZoneCard({
  zone,
  specBySessionId,
  constituentMap,
  onClick,
}: {
  zone: ZoneData;
  specBySessionId: Map<string, FlowerSpec>;
  constituentMap: Map<string, Array<{ specJson: string; sid: number }>>;
  onClick?: () => void;
}) {
  const { user, session, allSessions, incomingOrders, isYours } = zone;
  const level = session ? Number(session.arrangementLevel) : 0;
  const flowerCount = allSessions.length;

  const displayName = run(() => {
    if (isYours && session) return `Your Zone`;
    if (isYours) return "Your Zone";
    return user.name ?? "Anonymous";
  });

  const subtitle = run(() => {
    if (session) {
      const name = session.prompt.slice(0, 20);
      const levelName = arrangementName(level);
      return `${name} -- ${levelName}`;
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
        gap: "0.25rem",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s",
        fontSize: "0.75rem",
        color: isYours ? "#8b8bd4" : "#525252",
        opacity: user.online ? 1 : 0.6,
      }}
    >
      {allSessions.length > 0 ? (
        <MiniCanvas sessions={allSessions} specBySessionId={specBySessionId} constituentMap={constituentMap} size={100} />
      ) : (
        <EmptyZoneIcon isYours={isYours} />
      )}

      <span
        style={{
          maxWidth: "90%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: isYours ? 500 : 400,
        }}
      >
        {displayName}
      </span>

      {subtitle && (
        <span
          style={{
            fontSize: "0.625rem",
            color: isYours ? "#7b7bc4" : "#404040",
            maxWidth: "90%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {subtitle}
        </span>
      )}

      {flowerCount > 0 && (
        <span style={{ fontSize: "0.5625rem", color: "#333" }}>
          {flowerCount} {flowerCount === 1 ? "flower" : "flowers"}
          {session ? ` -- ${arrangementName(level)}` : ""}
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
