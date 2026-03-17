import { readStream } from "../lib/utils.ts";
import type { GardenSim } from "../wasm/loader.ts";
import type { DbConnection, FlowerSession, FlowerSpec } from "./types.ts";
import { isVariant } from "./types.ts";

/// Wire SpacetimeDB table callbacks to the WASM simulation.
/// Only flowers owned by the current user are added to the physics world.
export function wireToWasm(conn: DbConnection, sim: GardenSim) {
  conn.db.flower_session.onInsert((_ctx, session: FlowerSession) => {
    if (isVariant(session.status, "Designing")) {
      sim.upsert_flower(
        Number(session.id),
        "{}",
        Number(session.canvasX),
        Number(session.canvasY),
      );
    }
  });

  conn.db.flower_session.onUpdate(
    (_ctx, _old: FlowerSession, next: FlowerSession) => {
      if (isVariant(next.status, "Complete")) {
        sim.wilt_flower(Number(next.id));
      } else {
        sim.upsert_flower(
          Number(next.id),
          "{}",
          Number(next.canvasX),
          Number(next.canvasY),
        );
      }
    },
  );

  conn.db.flower_session.onDelete((_ctx, session: FlowerSession) => {
    sim.remove_flower(Number(session.id));
  });

  conn.db.flower_spec.onInsert((_ctx, spec: FlowerSpec) => {
    for (const session of conn.db.flower_session.iter()) {
      if (
        session.id === spec.sessionId &&
        isVariant(session.status, "Designing")
      ) {
        sim.upsert_flower(
          Number(session.id),
          spec.specJson,
          Number(session.canvasX),
          Number(session.canvasY),
        );
        break;
      }
    }
  });

  conn.db.flower_spec.onUpdate((_ctx, _old: FlowerSpec, next: FlowerSpec) => {
    for (const session of conn.db.flower_session.iter()) {
      if (
        session.id === next.sessionId &&
        isVariant(session.status, "Designing")
      ) {
        sim.upsert_flower(
          Number(session.id),
          next.specJson,
          Number(session.canvasX),
          Number(session.canvasY),
        );
        break;
      }
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
