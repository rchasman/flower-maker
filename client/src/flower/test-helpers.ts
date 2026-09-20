import type { DrawCmd, Vec2 } from "./geometry.ts";

const CUBIC_STEPS = 8;

/** Sample every command into points; cubics are subdivided into CUBIC_STEPS. */
export function flattenCmds(cmds: readonly DrawCmd[]): Vec2[] {
  return cmds.reduce<{ points: Vec2[]; current: Vec2 }>(
    (acc, cmd) => {
      switch (cmd.op) {
        case "M":
        case "L":
          return {
            points: [...acc.points, [cmd.x, cmd.y]],
            current: [cmd.x, cmd.y],
          };
        case "C": {
          const [x0, y0] = acc.current;
          const samples: Vec2[] = Array.from(
            { length: CUBIC_STEPS },
            (_, i) => {
              const s = (i + 1) / CUBIC_STEPS;
              const r = 1 - s;
              return [
                r * r * r * x0 +
                  3 * r * r * s * cmd.c1x +
                  3 * r * s * s * cmd.c2x +
                  s * s * s * cmd.x,
                r * r * r * y0 +
                  3 * r * r * s * cmd.c1y +
                  3 * r * s * s * cmd.c2y +
                  s * s * s * cmd.y,
              ];
            },
          );
          return {
            points: [...acc.points, ...samples],
            current: [cmd.x, cmd.y],
          };
        }
        case "Z":
          return acc;
      }
    },
    { points: [], current: [0, 0] },
  ).points;
}

/** Even-odd ray casting. */
export function pointInPolygon(
  [px, py]: Vec2,
  polygon: readonly Vec2[],
): boolean {
  return polygon.reduce((inside, [xi, yi], i) => {
    const [xj, yj] = polygon[(i + polygon.length - 1) % polygon.length]!;
    const crosses =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    return crosses ? !inside : inside;
  }, false);
}
