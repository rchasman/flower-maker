export type Vec2 = [number, number];

/** Drawing command — consumed by SVG path builder and PixiJS Graphics. */
export type DrawCmd =
  | { op: "M"; x: number; y: number }
  | { op: "L"; x: number; y: number }
  | {
      op: "C";
      c1x: number;
      c1y: number;
      c2x: number;
      c2y: number;
      x: number;
      y: number;
    }
  | { op: "Z" };

/** Convert a point sequence into smooth cubic Bézier draw commands (uniform Catmull-Rom). */
export function smoothCmds(points: Vec2[]): DrawCmd[] {
  if (points.length < 2) return [];
  const cmds: DrawCmd[] = [{ op: "M", x: points[0]![0], y: points[0]![1] }];

  if (points.length === 2) {
    cmds.push({ op: "L", x: points[1]![0], y: points[1]![1] });
    return cmds;
  }

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;

    cmds.push({
      op: "C",
      c1x: p1[0] + (p2[0] - p0[0]) / 6,
      c1y: p1[1] + (p2[1] - p0[1]) / 6,
      c2x: p2[0] - (p3[0] - p1[0]) / 6,
      c2y: p2[1] - (p3[1] - p1[1]) / 6,
      x: p2[0],
      y: p2[1],
    });
  }

  return cmds;
}

/**
 * Closed loop of cubic Béziers through the points (uniform Catmull-Rom with
 * wraparound tangents), so the seam at the first point is as smooth as the rest.
 */
export function closedSmoothCmds(points: readonly Vec2[]): DrawCmd[] {
  if (points.length < 3) return [];
  const n = points.length;
  const at = (i: number): Vec2 => points[(i + n) % n]!;
  const segments = points.map((p1, i): DrawCmd => {
    const p0 = at(i - 1);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    return {
      op: "C",
      c1x: p1[0] + (p2[0] - p0[0]) / 6,
      c1y: p1[1] + (p2[1] - p0[1]) / 6,
      c2x: p2[0] - (p3[0] - p1[0]) / 6,
      c2y: p2[1] - (p3[1] - p1[1]) / 6,
      x: p2[0],
      y: p2[1],
    };
  });
  return [
    { op: "M", x: points[0]![0], y: points[0]![1] },
    ...segments,
    { op: "Z" },
  ];
}

/** Closed polyline through the points, straight segments, back to the start. */
export function polygonCmds(points: readonly Vec2[]): DrawCmd[] {
  if (points.length < 3) return [];
  const [first, ...rest] = points;
  return [
    { op: "M", x: first![0], y: first![1] },
    ...rest.map((p): DrawCmd => ({ op: "L", x: p[0], y: p[1] })),
    { op: "Z" },
  ];
}

/** A regular polygon approximating the circle at (cx, cy). */
export function circleCmds(
  cx: number,
  cy: number,
  radius: number,
  vertices = 24,
): DrawCmd[] {
  return polygonCmds(
    Array.from({ length: vertices }, (_, k): Vec2 => {
      const theta = (k / vertices) * Math.PI * 2;
      return [cx + Math.cos(theta) * radius, cy + Math.sin(theta) * radius];
    }),
  );
}

// ── Extents ──

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/** Every point a command touches. A cubic lies inside the hull of its control points, so their box contains the curve. */
function cmdPoints(cmd: DrawCmd): Vec2[] {
  switch (cmd.op) {
    case "M":
    case "L":
      return [[cmd.x, cmd.y]];
    case "C":
      return [
        [cmd.c1x, cmd.c1y],
        [cmd.c2x, cmd.c2y],
        [cmd.x, cmd.y],
      ];
    case "Z":
      return [];
  }
}

export function unionBounds(a: Bounds, b: Bounds | null): Bounds {
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** Axis-aligned box around the commands' points; null when there are none. */
export function cmdsBounds(cmds: readonly DrawCmd[]): Bounds | null {
  const points = cmds.flatMap(cmdPoints);
  const first = points[0];
  if (!first) return null;
  return points
    .slice(1)
    .reduce<Bounds>(
      (box, [x, y]) => unionBounds(box, { minX: x, minY: y, maxX: x, maxY: y }),
      { minX: first[0], minY: first[1], maxX: first[0], maxY: first[1] },
    );
}

export function circleBounds(x: number, y: number, radius: number): Bounds {
  return {
    minX: x - radius,
    minY: y - radius,
    maxX: x + radius,
    maxY: y + radius,
  };
}

/** Farthest any of the commands' points lies from the origin; 0 when there are none. */
export function cmdsReach(cmds: readonly DrawCmd[]): number {
  return cmds
    .flatMap(cmdPoints)
    .reduce((reach, [x, y]) => Math.max(reach, Math.hypot(x, y)), 0);
}

/**
 * Assemble a closed outline from left/right edge points.
 * Left edge runs base→tip, right edge runs tip→base, then close.
 */
export function assembleOutline(leftPts: Vec2[], rightPts: Vec2[]): DrawCmd[] {
  const leftCmds = smoothCmds(leftPts);
  const rightCmds = smoothCmds(rightPts.toReversed());

  const cmds: DrawCmd[] = [...leftCmds];

  if (rightCmds.length > 0 && rightCmds[0]!.op === "M") {
    const m = rightCmds[0]!;
    cmds.push({ op: "L", x: m.x, y: m.y });
    cmds.push(...rightCmds.slice(1));
  } else {
    cmds.push(...rightCmds);
  }

  cmds.push({ op: "Z" });
  return cmds;
}
