import type { ArrangementMeta } from "../flower/render.ts";
import { readStream, parseSpec } from "../lib/utils.ts";
import type { GardenSim } from "../wasm/loader.ts";
import type { DbConnection, FlowerSession, FlowerSpec } from "./types.ts";
import { isVariant } from "./types.ts";
import {
  arrangementFlowers,
  arrangementMeta,
  type ArrangementFlower,
} from "./arrangements.ts";
import { getMyIdentity } from "./connection.ts";

/** Normalize a SpacetimeDB identity to a comparable hex string. */
function identityHex(id: unknown): string {
  if (!id) return "";
  // SpacetimeDB v2 Identity objects have toHexString or toString methods
  if (
    typeof (id as { toHexString?: () => string }).toHexString === "function"
  ) {
    return (id as { toHexString: () => string }).toHexString();
  }
  const s = String(id);
  // If String() returned a hex-like value, use it; otherwise empty
  return s.startsWith("[object") ? "" : s;
}

/** Check if a session belongs to the current user. */
export function isMySession(session: FlowerSession): boolean {
  const me = getMyIdentity();
  if (!me) return true; // fallback: show all if identity unavailable
  const myHex = identityHex(me);
  if (!myHex) return true; // can't determine identity, show all
  return identityHex(session.owner) === myHex;
}

/** Canvas viewport dimensions — updated by FlowerCanvas on mount/resize. */
let viewportW = 800;
let viewportH = 600;

export function setCanvasViewport(w: number, h: number) {
  viewportW = w;
  viewportH = h;
}

export function getCanvasViewport(): { w: number; h: number; pad: number } {
  return { w: viewportW, h: viewportH, pad: 60 };
}

/** Map server positions (0–100 range) to fill the canvas viewport with padding. */
function resolvePosition(
  session: FlowerSession,
  index: number,
  total: number,
): [number, number] {
  const cx = Number(session.canvasX);
  const cy = Number(session.canvasY);

  const pad = 60;
  const usableW = viewportW - pad * 2;
  const usableH = viewportH - pad * 2;

  if (cx !== 0 || cy !== 0) {
    // Server stores 0–100, scale to fill canvas
    return [pad + (cx / 100) * usableW, pad + (cy / 100) * usableH];
  }

  // Fallback grid when position is unset
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.max(1, Math.ceil(total / cols));
  const col = index % cols;
  const row = Math.floor(index / cols);
  return [
    pad + (usableW / Math.max(1, cols)) * (col + 0.5),
    pad + (usableH / Math.max(1, rows)) * (row + 0.5),
  ];
}

/** A canvas point in px as the server's 0–100 position: the inverse of resolvePosition. */
export function toServerPosition(x: number, y: number): [number, number] {
  const { w, h, pad } = getCanvasViewport();
  return [
    Math.max(0, Math.min(100, ((x - pad) / (w - pad * 2)) * 100)),
    Math.max(0, Math.min(100, ((y - pad) / (h - pad * 2)) * 100)),
  ];
}

/** What the garden canvas needs to hear from the database besides the simulation. */
export type CanvasEvents = {
  /** an arrangement's flowers or AI meta changed; empty flowers for a single flower */
  setArrangement(
    sid: number,
    flowers: ArrangementFlower[],
    meta: ArrangementMeta | null,
  ): void;
  /** a merge produced this arrangement: it blooms in */
  bloom(sid: number): void;
};

const isShown = (session: FlowerSession): boolean =>
  isVariant(session.status, "Designing") && isMySession(session);

/// Wire SpacetimeDB table callbacks to the WASM simulation and the canvas.
/// The SDK applies a whole transaction to its cache before any callback
/// runs, so a merged arrangement's flowers are readable when its session row
/// arrives and it is drawn as an arrangement from its first frame.
export function wireToWasm(
  conn: DbConnection,
  sim: GardenSim,
  canvas: CanvasEvents,
) {
  const specOf = (sid: bigint): string | undefined =>
    conn.db.flowerSpec.sessionId.find(sid)?.spec;
  const overridesOf = (sid: bigint) => overridesFor(conn, sid);
  const pushArrangement = (sid: bigint) => {
    const rows = overridesOf(sid);
    canvas.setArrangement(
      Number(sid),
      arrangementFlowers(rows),
      arrangementMeta(rows),
    );
  };
  const place = (session: FlowerSession, spec: string) => {
    const count = sim.flower_count() + 1;
    const [x, y] = resolvePosition(session, count, count);
    sim.upsert_flower(session.id, spec, x, y);
  };

  // Seed existing sessions owned by the current user
  const existing = [...conn.db.flowerSession.iter()].filter(isShown);
  existing.map((session, i) => {
    pushArrangement(session.id);
    const spec = specOf(session.id);
    if (!spec) return session.id;
    const [x, y] = resolvePosition(session, i, existing.length);
    sim.upsert_flower(session.id, spec, x, y);
    return session.id;
  });

  conn.db.flowerSession.onInsert((_ctx, session: FlowerSession) => {
    if (!isShown(session)) return;
    pushArrangement(session.id);
    const spec = specOf(session.id);
    if (spec) place(session, spec);
    const merged = overridesOf(session.id).some(o =>
      o.forkedFrom.startsWith("cross:"),
    );
    if (merged) canvas.bloom(Number(session.id));
  });

  conn.db.flowerSession.onUpdate(
    (_ctx, old: FlowerSession, next: FlowerSession) => {
      if (isVariant(next.status, "Complete")) {
        sim.wilt_flower(next.id);
        return;
      }
      // Only a new server position moves a flower: physics owns it otherwise.
      if (old.canvasX === next.canvasX && old.canvasY === next.canvasY) return;
      const [x, y] = resolvePosition(next, 0, 1);
      sim.set_body_position(next.id, x, y);
    },
  );

  conn.db.flowerSession.onDelete((_ctx, session: FlowerSession) => {
    sim.remove_flower(session.id);
  });

  const onSpec = (spec: FlowerSpec) => {
    const session = conn.db.flowerSession.id.find(spec.sessionId);
    if (!session || !isShown(session)) return;
    if (!sim.update_spec(session.id, spec.spec)) place(session, spec.spec);
  };
  conn.db.flowerSpec.onInsert((_ctx, spec: FlowerSpec) => onSpec(spec));
  conn.db.flowerSpec.onUpdate((_ctx, _old, next: FlowerSpec) => onSpec(next));

  const onOverride = (o: { sessionId: bigint }) => pushArrangement(o.sessionId);
  conn.db.partOverride.onInsert((_ctx, o) => onOverride(o));
  conn.db.partOverride.onUpdate((_ctx, _old, o) => onOverride(o));
  conn.db.partOverride.onDelete((_ctx, o) => onOverride(o));

  console.log("[bridge] SpacetimeDB → WASM wired");
}

/// Merge flower A into flower B at `at`, a 0–100 server position, or where B
/// stands when null. The arrangement exists at once; the AI's name and
/// container are asked for afterwards and fill it in when they arrive.
/// False when the server refused the merge.
export async function handleMerge(
  conn: DbConnection,
  sessionAId: number,
  sessionBId: number,
  at: [number, number] | null,
): Promise<boolean> {
  const specA = conn.db.flowerSpec.sessionId.find(BigInt(sessionAId));
  const specB = conn.db.flowerSpec.sessionId.find(BigInt(sessionBId));
  const sessionA = conn.db.flowerSession.id.find(BigInt(sessionAId));
  const sessionB = conn.db.flowerSession.id.find(BigInt(sessionBId));
  if (!specA || !specB || !sessionA || !sessionB) {
    console.warn("[merge] Missing session", sessionAId, "or", sessionBId);
    return false;
  }

  const [x, y] = at ?? [sessionB.canvasX, sessionB.canvasY];
  try {
    await conn.reducers.mergeSessions({
      sessionAId: BigInt(sessionAId),
      sessionBId: BigInt(sessionBId),
      x,
      y,
    });
  } catch (err) {
    console.error("[merge] Refused:", err);
    return false;
  }

  const totalCount =
    Number(sessionA.flowerCount) + Number(sessionB.flowerCount);
  const parentAdornments = [
    ...overridesFor(conn, sessionA.id),
    ...overridesFor(conn, sessionB.id),
  ]
    .filter(o => o.partPath === "arrangement")
    .flatMap(o => parseSpec(o.overrideJson) ?? []);

  try {
    const res = await fetch("/api/flower/combine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spec_a: parseSpec(specA.spec),
        spec_b: parseSpec(specB.spec),
        total_count: totalCount,
        level: levelForCount(totalCount),
        parent_adornments:
          parentAdornments.length > 0 ? parentAdornments : undefined,
      }),
    });
    if (!res.ok) throw new Error(`combine answered ${res.status}`);
    await conn.reducers.setMergeArrangement({
      sessionAId: BigInt(sessionAId),
      sessionBId: BigInt(sessionBId),
      aiArrangementJson: await readStream(res),
    });
  } catch (err) {
    // The arrangement stands without the AI's name and container.
    console.error("[merge] Arrangement details failed:", err);
  }
  return true;
}

const overridesFor = (conn: DbConnection, sid: bigint) =>
  [...conn.db.partOverride.iter()].filter(o => o.sessionId === sid);

function levelForCount(count: number): string {
  if (count <= 1) return "stem";
  if (count <= 3) return "group";
  if (count <= 6) return "bunch";
  if (count <= 9) return "arrangement";
  if (count <= 19) return "bouquet";
  if (count <= 49) return "centerpiece";
  return "installation";
}
