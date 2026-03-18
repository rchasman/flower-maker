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
  /** All "Designing" sessions owned by this user — for the live mini-canvas. */
  allSessions: readonly FlowerSession[];
  incomingOrders: number;
  isYours: boolean;
};

export function FlowerGrid({ onEnterDesigner }: FlowerGridProps) {
  const { state, conn } = useSession();
  const sessions = useFlowerSessions(conn);
  const users = useUsers(conn);
  const orders = useOrders(conn);
  const onlineCount = users.filter(u => u.online).length;

  const { identityHex } = useSession();

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

const HUES = ["#ff6b9d", "#c084fc", "#67e8f9", "#fbbf24", "#4ade80", "#f87171", "#a78bfa", "#38bdf8"];

function sidHash(sid: number, salt: number): number {
  return ((sid * 2654435761 + salt * 40503) >>> 0) / 4294967296;
}

function flowerColor(sid: number): string {
  return HUES[sid % HUES.length]!;
}

function darkenHex(hex: string, factor: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.floor(((n >> 16) & 0xff) * factor);
  const g = Math.floor(((n >> 8) & 0xff) * factor);
  const b = Math.floor((n & 0xff) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Render one SVG flower at a given position (matches PixiJS petal logic). */
function SvgFlower({ sid, x, y, r }: { sid: number; x: number; y: number; r: number }) {
  const color = flowerColor(sid);
  const petalCount = 5 + Math.floor(sidHash(sid, 1) * 3);
  const petalLength = 0.75 + sidHash(sid, 2) * 0.35;
  const petalWidth = 0.28 + sidHash(sid, 3) * 0.18;
  const rotOffset = sidHash(sid, 5) * Math.PI * 2;
  const outerColor = darkenHex(color, 0.88);
  const pistilColor = darkenHex(color, 0.45);

  const petals = Array.from({ length: petalCount }, (_, i) => {
    const angle = rotOffset + (i * Math.PI * 2) / petalCount;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const pLen = r * petalLength;
    const pW = r * petalWidth;
    const pcx = x + cos * pLen * 0.55;
    const pcy = y + sin * pLen * 0.55;
    return (
      <ellipse
        key={`o${i}`}
        cx={pcx}
        cy={pcy}
        rx={pLen * 0.5}
        ry={pW}
        transform={`rotate(${(angle * 180) / Math.PI} ${pcx} ${pcy})`}
        fill={outerColor}
        opacity={0.9}
      />
    );
  });

  const innerPetals = Array.from({ length: petalCount }, (_, i) => {
    const angle = rotOffset + (i * Math.PI * 2) / petalCount + Math.PI / petalCount;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const pLen = r * petalLength * 0.6;
    const pW = r * petalWidth * 0.7;
    const pcx = x + cos * pLen * 0.5;
    const pcy = y + sin * pLen * 0.5;
    return (
      <ellipse
        key={`i${i}`}
        cx={pcx}
        cy={pcy}
        rx={pLen * 0.45}
        ry={pW}
        transform={`rotate(${(angle * 180) / Math.PI} ${pcx} ${pcy})`}
        fill={color}
        opacity={0.85}
      />
    );
  });

  return (
    <g>
      {petals}
      {innerPetals}
      <circle cx={x} cy={y} r={r * 0.28} fill={pistilColor} />
      <circle cx={x} cy={y} r={r * 0.14} fill="#fefce8" opacity={0.6} />
    </g>
  );
}

/** Live mini-canvas: renders all of a user's flowers at their real positions, scaled to fit. */
function MiniCanvas({ sessions, size }: { sessions: readonly FlowerSession[]; size: number }) {
  if (sessions.length === 0) return null;

  // Compute bounding box of all flower positions
  const positions = sessions.map(s => ({
    sid: Number(s.id),
    x: Number(s.canvasX),
    y: Number(s.canvasY),
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
      {resolved.map(p => (
        <SvgFlower key={p.sid} sid={p.sid} x={p.x} y={p.y} r={flowerR} />
      ))}
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
  onClick,
}: {
  zone: ZoneData;
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
        <MiniCanvas sessions={allSessions} size={100} />
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
