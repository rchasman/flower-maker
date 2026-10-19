/**
 * Shading for a buckled petal margin. Seen from above, a margin that rises
 * and falls in waves shows little in its outline; what shows is the light on
 * the flanks. A flank whose slope tilts it toward the light is brighter, one
 * that tilts away is darker, and the band reaches into the blade about as far
 * as the wave is deep.
 */

import { polygonCmds, type DrawCmd, type Vec2 } from "./geometry.ts";
import { petalLocalToFlower, type PetalFrame } from "./petal.ts";

/** A lobe of light or shade along one margin; shade below 0 darkens, above 0 lightens. */
type PetalFold = { cmds: DrawCmd[]; shade: number };

/** Lobes stop just inside the drawn outline, short of the base and the tip where its edges meet. */
const EDGE_U = 0.97;
const T_MIN = 0.03;
const T_MAX = 0.97;
/** How far into the blade the deepest lobe reaches, in half widths. */
const FOLD_DEPTH = 0.5;
/** Flanks flatter than this cast no lobe. */
const MIN_SHADE = 0.04;
/** Even a petal side-on to the light shows its waves: the sky lights them from above. */
const AMBIENT = 0.35;

type Station = { t: number; value: number };

/** Consecutive stations whose shade has one sign, each run padded with its zero-depth neighbours. */
function runsOf(stations: readonly Station[]): Station[][] {
  const sign = (v: number) => (Math.abs(v) < MIN_SHADE ? 0 : Math.sign(v));
  return stations
    .reduce<{ start: number; end: number }[]>((runs, s, i) => {
      const current = runs.at(-1);
      if (sign(s.value) === 0) return runs;
      return current &&
        current.end === i - 1 &&
        sign(stations[current.start]!.value) === sign(s.value)
        ? [...runs.slice(0, -1), { ...current, end: i }]
        : [...runs, { start: i, end: i }];
    }, [])
    .map(({ start, end }) =>
      stations
        .slice(Math.max(0, start - 1), Math.min(stations.length, end + 2))
        .map((s, k, run) =>
          (k === 0 && start > 0) ||
          (k === run.length - 1 && end < stations.length - 1)
            ? { ...s, value: 0 }
            : s,
        ),
    );
}

function lobe(
  run: readonly Station[],
  side: 1 | -1,
  frame: PetalFrame,
): PetalFold {
  const peak = run.reduce((m, s) => Math.max(m, Math.abs(s.value)), 0);
  const outer = run.map(s => petalLocalToFlower(s.t, side * EDGE_U, frame));
  const inner = run.map(s =>
    petalLocalToFlower(
      s.t,
      side * (EDGE_U - FOLD_DEPTH * (Math.abs(s.value) / peak)),
      frame,
    ),
  );
  const points: Vec2[] = [...outer, ...inner.reverse()];
  const signed = run.find(s => s.value !== 0)?.value ?? 0;
  return {
    cmds: polygonCmds(points),
    shade: Math.sign(signed) * Math.min(1, peak),
  };
}

/**
 * The light and shade lobes along both margins of a petal. `facing` is the
 * cosine between the petal's axis and the light: a flank rising toward the
 * tip faces back toward the base, so it is lit when the light comes from the
 * base side and shaded when it comes from beyond the tip.
 */
export function generatePetalFolds(
  frame: PetalFrame,
  facing: number,
): PetalFold[] {
  const light = AMBIENT + (1 - AMBIENT) * facing;
  const last = frame.spine.length - 1;
  return ([1, -1] as const).flatMap(side => {
    const stations = frame.spine
      .map((s, i): Station => ({
        t: i / last,
        value: -(side === 1 ? s.leftSlope : s.rightSlope) * light,
      }))
      .filter(s => s.t >= T_MIN && s.t <= T_MAX);
    return runsOf(stations).map(run => lobe(run, side, frame));
  });
}
