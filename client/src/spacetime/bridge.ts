import { readStream } from "../lib/utils.ts";
import type { GardenSim } from "../wasm/loader.ts";
import type { DbConnection, FlowerSession, FlowerSpec } from "./types.ts";
import { isVariant } from "./types.ts";

/** Spread flowers across the canvas when server positions are all zero. */
function resolvePosition(
  session: FlowerSession,
  index: number,
  total: number,
): [number, number] {
  const cx = Number(session.canvasX);
  const cy = Number(session.canvasY);
  if (cx !== 0 || cy !== 0) return [cx, cy];

  // Distribute in a grid pattern centered on the viewport
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const spacing = 80;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const offsetX = (cols - 1) * spacing * 0.5;
  const offsetY = (Math.ceil(total / cols) - 1) * spacing * 0.5;
  return [400 + col * spacing - offsetX, 300 + row * spacing - offsetY];
}

/// Wire SpacetimeDB table callbacks to the WASM simulation.
/// Seeds existing rows then listens for future changes.
export function wireToWasm(conn: DbConnection, sim: GardenSim) {
  // Seed existing sessions already in the local cache
  const existing = [...conn.db.flower_session.iter()].filter(s =>
    isVariant(s.status, "Designing"),
  );
  const specLookup = [...conn.db.flower_spec.iter()].reduce(
    (acc, spec) => acc.set(spec.sessionId, spec.specJson),
    new Map<bigint, string>(),
  );
  existing.map((session, i) => {
    const [x, y] = resolvePosition(session, i, existing.length);
    const specJson = specLookup.get(session.id) ?? "{}";
    sim.upsert_flower(session.id, specJson, x, y);
    return session.id;
  });

  conn.db.flower_session.onInsert((_ctx, session: FlowerSession) => {
    if (isVariant(session.status, "Designing")) {
      const count = sim.flower_count() + 1;
      const [x, y] = resolvePosition(session, count, count);
      const spec = [...conn.db.flower_spec.iter()].find(
        s => s.sessionId === session.id,
      );
      sim.upsert_flower(session.id, spec?.specJson ?? "{}", x, y);
    }
  });

  conn.db.flower_session.onUpdate(
    (_ctx, _old: FlowerSession, next: FlowerSession) => {
      if (isVariant(next.status, "Complete")) {
        sim.wilt_flower(next.id);
      } else {
        const count = sim.flower_count();
        const [x, y] = resolvePosition(next, count, count);
        const spec = [...conn.db.flower_spec.iter()].find(
          s => s.sessionId === next.id,
        );
        sim.upsert_flower(next.id, spec?.specJson ?? "{}", x, y);
      }
    },
  );

  conn.db.flower_session.onDelete((_ctx, session: FlowerSession) => {
    sim.remove_flower(session.id);
  });

  conn.db.flower_spec.onInsert((_ctx, spec: FlowerSpec) => {
    const session = [...conn.db.flower_session.iter()].find(
      s => s.id === spec.sessionId && isVariant(s.status, "Designing"),
    );
    if (session) {
      const count = sim.flower_count();
      const [x, y] = resolvePosition(session, count, count);
      sim.upsert_flower(session.id, spec.specJson, x, y);
    }
  });

  conn.db.flower_spec.onUpdate((_ctx, _old: FlowerSpec, next: FlowerSpec) => {
    const session = [...conn.db.flower_session.iter()].find(
      s => s.id === next.sessionId && isVariant(s.status, "Designing"),
    );
    if (session) {
      const count = sim.flower_count();
      const [x, y] = resolvePosition(session, count, count);
      sim.upsert_flower(session.id, next.specJson, x, y);
    }
  });

  console.log("[bridge] SpacetimeDB → WASM wired");
}

/// Handle a merge event from the WASM simulation.
/// Calls the AI combine endpoint, then the SpacetimeDB merge_sessions reducer.
export async function handleMerge(
  conn: DbConnection,
  sessionAId: number,
  sessionBId: number,
): Promise<void> {
  let specA: FlowerSpec | null = null;
  let specB: FlowerSpec | null = null;
  for (const spec of conn.db.flower_spec.iter()) {
    if (Number(spec.sessionId) === sessionAId) specA = spec;
    if (Number(spec.sessionId) === sessionBId) specB = spec;
  }

  if (!specA || !specB) {
    console.warn(
      "[merge] Missing spec for session",
      sessionAId,
      "or",
      sessionBId,
    );
    return;
  }

  let sessionA: FlowerSession | null = null;
  let sessionB: FlowerSession | null = null;
  for (const s of conn.db.flower_session.iter()) {
    if (Number(s.id) === sessionAId) sessionA = s;
    if (Number(s.id) === sessionBId) sessionB = s;
  }

  const totalCount =
    Number(sessionA?.flowerCount ?? 1) + Number(sessionB?.flowerCount ?? 1);
  const level = levelForCount(totalCount);

  try {
    const res = await fetch("/api/flower/combine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spec_a: JSON.parse(specA.specJson),
        spec_b: JSON.parse(specB.specJson),
        total_count: totalCount,
        level,
      }),
    });

    const arrangementJson = await readStream(res);

    conn.reducers.mergeSessions({ sessionAId: BigInt(sessionAId), sessionBId: BigInt(sessionBId), aiArrangementJson: arrangementJson });

    console.log(
      "[merge] Merged",
      sessionAId,
      "+",
      sessionBId,
      "→ total",
      totalCount,
      "flowers",
    );
  } catch (err) {
    console.error("[merge] Failed:", err);
  }
}

function levelForCount(count: number): string {
  if (count <= 1) return "stem";
  if (count <= 3) return "group";
  if (count <= 6) return "bunch";
  if (count <= 9) return "arrangement";
  if (count <= 19) return "bouquet";
  if (count <= 49) return "centerpiece";
  return "installation";
}
