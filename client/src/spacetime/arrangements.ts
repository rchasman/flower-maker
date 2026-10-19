import {
  parseArrangementMeta,
  type ArrangementMeta,
} from "../flower/render.ts";

type OverrideRow = {
  partPath: string;
  overrideJson: string;
  forkedFrom: string;
};

/** One flower of an arrangement and the seed it is drawn with. */
export type ArrangementFlower = { spec: string; sid: number };

/** FNV-1a: a flower keeps its seed, and so its look, whatever slot it moves to. */
function specSeed(spec: string): number {
  return Array.from({ length: spec.length }, (_, i) =>
    spec.charCodeAt(i),
  ).reduce((hash, code) => Math.imul(hash ^ code, 16777619) >>> 0, 2166136261);
}

/** An arrangement's flowers from its session's overrides, in slot order; empty for a single flower. */
export function arrangementFlowers(
  overrides: readonly OverrideRow[],
): ArrangementFlower[] {
  return overrides
    .flatMap(o => {
      const slot = o.partPath.match(/^constituent:(\d+)$/)?.[1];
      return slot === undefined
        ? []
        : [{ slot: Number(slot), spec: o.overrideJson }];
    })
    .toSorted((a, b) => a.slot - b.slot)
    .map(({ spec }) => ({ spec, sid: specSeed(spec) }));
}

/** The AI's name, container and hints for an arrangement, once they have arrived. */
function arrangementMeta(
  overrides: readonly OverrideRow[],
): ArrangementMeta | null {
  const row = overrides.find(o => o.partPath === "arrangement");
  return row ? (parseArrangementMeta(row.overrideJson) ?? null) : null;
}

/** The two sessions an arrangement was merged from, or null for one that was not. */
function mergedFrom(
  overrides: readonly OverrideRow[],
): [string, string] | null {
  const parents = overrides
    .find(o => o.partPath.startsWith("constituent:"))
    ?.forkedFrom.match(/^merge:(\d+)\+(\d+)$/);
  return parents ? [parents[1]!, parents[2]!] : null;
}

/**
 * An arrangement's look: its own AI meta, or until that arrives, the meta
 * of the parent it grew from that holds more flowers. The container keeps
 * its parent's material and colors from the moment of the merge.
 */
export function inheritedMeta(
  sessionId: string,
  bySession: ReadonlyMap<string, readonly OverrideRow[]>,
): ArrangementMeta | null {
  const rows = bySession.get(sessionId) ?? [];
  const own = arrangementMeta(rows);
  if (own) return own;
  const parents = mergedFrom(rows);
  if (!parents) return null;
  const size = (sid: string) =>
    Math.max(1, arrangementFlowers(bySession.get(sid) ?? []).length);
  const [larger, smaller] =
    size(parents[0]) >= size(parents[1]) ? parents : [parents[1], parents[0]];
  return inheritedMeta(larger, bySession) ?? inheritedMeta(smaller, bySession);
}

/** Overrides grouped by session id. */
export function overridesBySession<
  T extends OverrideRow & { sessionId: bigint },
>(overrides: readonly T[]): Map<string, T[]> {
  return overrides.reduce(
    (acc, o) =>
      acc.set(String(o.sessionId), [
        ...(acc.get(String(o.sessionId)) ?? []),
        o,
      ]),
    new Map<string, T[]>(),
  );
}
