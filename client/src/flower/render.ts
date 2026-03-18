/**
 * Spec-driven botanical flower rendering — single source of truth for
 * FlowerCanvas (PixiJS) and FlowerGrid (SVG).
 *
 * Each flower's full taxonomy (petal shape, arrangement, curvature, edge style,
 * reproductive system, sepals) drives a unique visual. No more cartoon blobs.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

type Vec2 = [number, number];

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

export type StamenPlan = {
  angle: number;
  length: number;
  filamentColor: number;
  antherColor: number;
  antherRadius: number;
};

export type CenterPlan = {
  discRadius: number;
  discColor: number;
  highlightRadius: number;
  highlightColor: number;
  stamens: readonly StamenPlan[];
};

/** Pre-computed rendering plan for a flower — cached per spec, scale-independent. */
export type FlowerPlan = {
  sepals: ReadonlyArray<{ cmds: DrawCmd[]; color: number }>;
  layers: ReadonlyArray<{
    petals: ReadonlyArray<{ cmds: DrawCmd[] }>;
    color: number;
    opacity: number;
  }>;
  center: CenterPlan;
};

// ═══════════════════════════════════════════════════════════════════════════
// Color utilities
// ═══════════════════════════════════════════════════════════════════════════

/** Deterministic hash from sid — yields a float in [0, 1). */
export function sidHash(sid: number, salt: number): number {
  const n = Math.sin(sid * 9301 + salt * 4973) * 49297;
  return n - Math.floor(n);
}

const HUES = [
  0xff6b9d, 0xc084fc, 0x67e8f9, 0xfbbf24, 0x4ade80, 0xf87171, 0xa78bfa,
  0x38bdf8,
];

/** Fallback palette when spec colors are default/zero. */
export function fallbackColor(sid: number): number {
  return HUES[sid % HUES.length]!;
}

/** Convert 0.0–1.0 RGB floats to a hex color number. */
export function colorFromSpec(r: number, g: number, b: number): number {
  const ri = Math.round(Math.max(0, Math.min(1, r)) * 255);
  const gi = Math.round(Math.max(0, Math.min(1, g)) * 255);
  const bi = Math.round(Math.max(0, Math.min(1, b)) * 255);
  return (ri << 16) | (gi << 8) | bi;
}

/** Darken a hex color number by a factor (0–1, where 0 = black). */
export function darkenColor(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

function lightenColor(color: number, amount: number): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) + 255 * amount));
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) + 255 * amount));
  const b = Math.min(255, Math.floor((color & 0xff) + 255 * amount));
  return (r << 16) | (g << 8) | b;
}

/** Convert a hex color number to a CSS hex string. */
export function hexString(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function colorToHex(
  c: { r?: number; g?: number; b?: number } | undefined,
): number | null {
  if (!c) return null;
  const r = c.r ?? 0;
  const g = c.g ?? 0;
  const b = c.b ?? 0;
  if (r + g + b < 0.05) return null;
  return colorFromSpec(r, g, b);
}

// ═══════════════════════════════════════════════════════════════════════════
// Petal shape profiles — width at position t ∈ [0,1] (base→tip)
// Returns 0..1 representing relative width at that position.
// Each profile produces a visually distinct petal silhouette.
// ═══════════════════════════════════════════════════════════════════════════

const SHAPE_PROFILES: Record<string, (t: number) => number> = {
  // Classic egg-shaped — widest at ~35% from base, gentle taper to tip
  Ovate: (t) => Math.sin(Math.PI * Math.pow(t, 0.7)),

  // Narrow lance — widest near 25%, long gradual taper to pointed tip
  Lanceolate: (t) =>
    Math.sin(Math.PI * t) * Math.pow(1 - t, 0.25) * 1.1,

  // Spoon/spatula — narrow stalk at base, wide rounded top
  Spatulate: (t) =>
    t < 0.3
      ? (t / 0.3) * 0.3
      : 0.3 + 0.7 * Math.sin((Math.PI * (t - 0.3)) / 0.7),

  // Rectangular — nearly parallel sides with rounded ends
  Oblong: (t) => {
    if (t < 0.1) return Math.sin((Math.PI * t) / 0.2) * 0.88;
    if (t > 0.9) return Math.sin((Math.PI * (1 - t)) / 0.2) * 0.88;
    return 0.88;
  },

  // Nearly circular — very wide, widest at center
  Orbicular: (t) => Math.sqrt(Math.max(0, Math.sin(Math.PI * t))),

  // Heart-shaped — wide, with a notch at the tip
  Cordate: (t) => {
    const base = Math.sin(Math.PI * Math.pow(t, 0.6));
    return t > 0.85
      ? base * (1 - 0.4 * Math.pow((t - 0.85) / 0.15, 0.5))
      : base;
  },

  // Triangular — widest at base, linear taper to point
  Deltoid: (t) =>
    Math.max(0, 1 - t * 0.95) * Math.sqrt(Math.min(1, t * 5)),

  // Sickle-curved — handled via asymmetry in generation, profile is narrower
  Falcate: (t) => Math.sin(Math.PI * t) * 0.7,

  // Strap-shaped — uniform narrow width, blunt tip (daisy ray petals)
  Ligulate: (t) => {
    if (t < 0.08) return (t / 0.08) * 0.45;
    if (t > 0.85) return 0.45 * Math.cos((Math.PI * 0.5 * (t - 0.85)) / 0.15);
    return 0.45;
  },

  // Very narrow tube — disc florets
  Tubular: (t) => {
    if (t < 0.05) return (t / 0.05) * 0.22;
    if (t > 0.88)
      return 0.22 * (1 + 0.6 * Math.sin((Math.PI * (t - 0.88)) / 0.12));
    return 0.22;
  },

  // Fringed ovate — base shape is ovate, edges get intrinsic fringe
  Fimbriate: (t) => Math.sin(Math.PI * Math.pow(t, 0.7)),

  // Deeply cut/slashed ovate — base shape, intrinsic lacerate edge
  Laciniate: (t) => Math.sin(Math.PI * Math.pow(t, 0.7)),

  // Backward-toothed — base shape, intrinsic serrate edge
  Runcinate: (t) => Math.sin(Math.PI * Math.pow(t, 0.7)),
};

function shapeProfile(shape: string, t: number): number {
  return (SHAPE_PROFILES[shape] ?? SHAPE_PROFILES.Ovate!)(
    Math.max(0, Math.min(1, t)),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Edge modifiers — perturbation multiplied onto petal width
// ═══════════════════════════════════════════════════════════════════════════

function edgeModifier(style: string, t: number, seed: number): number {
  switch (style) {
    case "Ruffled":
      return 1 + Math.sin(t * 14 + seed * 7) * 0.18;
    case "Fringed":
      return 1 + (Math.sin(t * 24 + seed * 3) > 0.2 ? 0.14 : -0.07);
    case "Serrated":
      return 1 + (((t * 10 + seed * 0.1) % 1) < 0.5 ? 0.12 : -0.06);
    case "Rolled":
      return 1 - t * 0.12;
    case "Undulate":
      return 1 + Math.sin(t * 8 + seed * 5) * 0.12;
    case "Crisped":
      return 1 + Math.sin(t * 20 + seed * 4) * 0.09;
    case "Lacerate":
      return (
        1 +
        Math.sin(t * 9 + seed * 3) * Math.cos(t * 13 + seed * 7) * 0.18
      );
    default:
      return 1;
  }
}

/** Shapes with intrinsic edge effects baked into their identity. */
function intrinsicEdge(shape: string): string | null {
  switch (shape) {
    case "Fimbriate":
      return "Fringed";
    case "Laciniate":
      return "Lacerate";
    case "Runcinate":
      return "Serrated";
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Smooth curve generation — Catmull-Rom → cubic Bézier
// ═══════════════════════════════════════════════════════════════════════════

/** Convert a point sequence into smooth cubic Bézier draw commands. */
function smoothCmds(points: Vec2[]): DrawCmd[] {
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

// ═══════════════════════════════════════════════════════════════════════════
// Petal outline generation
// ═══════════════════════════════════════════════════════════════════════════

const PETAL_SEGMENTS = 14;
const BASE_OFFSET = 0.08;

/**
 * Generate a petal outline at angle θ, in unit flower space (radius = 1).
 * The outline is a closed path of smooth cubic Bézier curves whose shape
 * is driven by the botanical PetalShape and EdgeStyle enums.
 */
function generatePetal(
  angle: number,
  shape: string,
  edge: string,
  length: number, // spec layer.length (0.1-5.0)
  width: number, // spec layer.width (0.1-3.0)
  curvature: number, // -1 to 1
  curl: number, // 0 to 1
  seed: number,
): DrawCmd[] {
  // Normalize dimensions to unit flower space
  const petalLen = Math.max(0.25, Math.min(1.15, length * 0.4));
  const petalW = Math.max(0.06, Math.min(0.45, width * 0.15));

  // Combine spec edge with any intrinsic edge from shape
  const effectiveEdge = edge !== "Smooth" ? edge : (intrinsicEdge(shape) ?? "Smooth");

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const leftPts: Vec2[] = [];
  const rightPts: Vec2[] = [];

  for (let i = 0; i <= PETAL_SEGMENTS; i++) {
    const t = i / PETAL_SEGMENTS;

    // Position along centerline (local petal space, +X = outward)
    const along = BASE_OFFSET + t * petalLen;

    // Curvature: lateral bend of the centerline (cupped = +, recurved = -)
    const bend = curvature * 0.15 * Math.sin(Math.PI * t);

    // Curl: tip bends backward (inward toward center)
    const curlDisp =
      curl > 0 && t > 0.65
        ? curl * Math.pow((t - 0.65) / 0.35, 2) * -0.12
        : 0;

    const localX = along + curlDisp;
    const localY = bend;

    // Width at this position
    const baseW =
      petalW * shapeProfile(shape, t) * edgeModifier(effectiveEdge, t, seed);

    // Falcate asymmetry — one side bulges
    const asym = shape === "Falcate" ? 0.3 * Math.sin(Math.PI * t) : 0;
    const lw = baseW * (1 + asym);
    const rw = baseW * (1 - asym);

    // Rotate from local petal space to flower space
    leftPts.push([
      cosA * localX - sinA * (localY + lw),
      sinA * localX + cosA * (localY + lw),
    ]);
    rightPts.push([
      cosA * localX - sinA * (localY - rw),
      sinA * localX + cosA * (localY - rw),
    ]);
  }

  // Outline: left edge (base→tip), connect to right edge (tip→base), close
  const leftCmds = smoothCmds(leftPts);
  const rightCmds = smoothCmds(rightPts.toReversed());

  const cmds: DrawCmd[] = [...leftCmds];

  // Bridge left tip → right tip (skip the MoveTo of right side)
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

// ═══════════════════════════════════════════════════════════════════════════
// Spec parsing
// ═══════════════════════════════════════════════════════════════════════════

type ParsedLayer = {
  count: number;
  shape: string;
  edgeStyle: string;
  width: number;
  length: number;
  curvature: number;
  curl: number;
  opacity: number;
  angularOffset: number;
  color: number | null;
};

type ParsedCenter = {
  receptacleSize: number;
  pistilColor: number | null;
  stamens: Array<{
    filamentColor: number | null;
    antherColor: number | null;
    height: number;
  }>;
};

type ParsedSepal = {
  color: number | null;
  length: number;
};

type ParsedSpec = {
  layers: ParsedLayer[];
  center: ParsedCenter;
  sepals: ParsedSepal[];
};

function parseSpec(specJson: string | undefined): ParsedSpec | null {
  if (!specJson) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spec = JSON.parse(specJson) as any;

    const layers: ParsedLayer[] = (spec.petals?.layers ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (layer: any) => ({
        count: layer.count ?? 5,
        shape: layer.shape ?? "Ovate",
        edgeStyle: layer.edge_style ?? "Smooth",
        width: layer.width ?? 0.5,
        length: layer.length ?? 0.5,
        curvature: layer.curvature ?? 0,
        curl: layer.curl ?? 0,
        opacity: layer.opacity ?? 1,
        angularOffset: ((layer.angular_offset ?? 0) * Math.PI) / 180,
        color: colorToHex(layer.color?.stops?.[0]?.color),
      }),
    );

    const reproductive = spec.reproductive ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stamens = (reproductive.stamens ?? []).map((s: any) => ({
      filamentColor: colorToHex(s.filament_color),
      antherColor: colorToHex(s.anther_color),
      height: s.height ?? 0.5,
    }));

    const center: ParsedCenter = {
      receptacleSize: spec.structure?.receptacle?.size ?? 0.5,
      pistilColor: colorToHex(reproductive.pistil?.color),
      stamens,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sepals: ParsedSepal[] = (spec.structure?.sepals ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => ({
        color: colorToHex(s.color),
        length: s.length ?? 0.5,
      }),
    );

    return { layers, center, sepals };
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Flower plan creation
// ═══════════════════════════════════════════════════════════════════════════

/** Create a complete, scale-independent rendering plan from a flower spec. */
export function createFlowerPlan(
  specJson: string | undefined,
  sid: number,
): FlowerPlan {
  const parsed = parseSpec(specJson);
  const baseColor =
    parsed?.layers[0]?.color ?? fallbackColor(sid);

  if (!parsed || parsed.layers.length === 0) {
    return createFallbackPlan(sid);
  }

  // ── Petal layers (outer first for correct z-order) ──
  let cumulativeOffset = sidHash(sid, 5) * Math.PI * 2;

  const layers = parsed.layers.map((layer, layerIdx) => {
    const count = Math.max(1, Math.min(55, layer.count));
    const angleStep = (Math.PI * 2) / count;
    cumulativeOffset += layer.angularOffset;

    // Each layer gets progressively lighter/darker for depth
    const layerColor =
      layer.color ?? darkenColor(baseColor, 1 - layerIdx * 0.06);

    const petals = Array.from({ length: count }, (_, i) => ({
      cmds: generatePetal(
        cumulativeOffset + i * angleStep,
        layer.shape,
        layer.edgeStyle,
        layer.length,
        layer.width,
        layer.curvature,
        layer.curl,
        sidHash(sid, 10 + layerIdx * 100 + i),
      ),
    }));

    return { petals, color: layerColor, opacity: layer.opacity };
  });

  // ── Center (pistil + stamens) ──
  // More petal layers → smaller visible center
  const layerFactor = Math.max(0.4, 1 - parsed.layers.length * 0.15);
  const discRadius = Math.max(
    0.06,
    Math.min(0.35, parsed.center.receptacleSize * 0.25 * layerFactor),
  );

  const pistilColor =
    parsed.center.pistilColor ?? darkenColor(baseColor, 0.4);

  const stamens: StamenPlan[] = parsed.center.stamens.map((s, i) => ({
    angle:
      (i / Math.max(1, parsed.center.stamens.length)) * Math.PI * 2 +
      sidHash(sid, 20 + i) * 0.4,
    length: discRadius + s.height * 0.25,
    filamentColor: s.filamentColor ?? darkenColor(baseColor, 0.6),
    antherColor: s.antherColor ?? 0xffd700,
    antherRadius: 0.025,
  }));

  const center: CenterPlan = {
    discRadius,
    discColor: pistilColor,
    highlightRadius: discRadius * 0.45,
    highlightColor: lightenColor(pistilColor, 0.35),
    stamens,
  };

  // ── Sepals (behind petals) ──
  const sepalCount = parsed.sepals.length;
  const sepals = parsed.sepals.map((s, i) => {
    const angle =
      (i / Math.max(1, sepalCount)) * Math.PI * 2 + cumulativeOffset * 0.5;
    const sepalLen = 0.3 + s.length * 0.6;
    return {
      cmds: generatePetal(
        angle,
        "Lanceolate",
        "Smooth",
        sepalLen,
        0.3,
        0.1,
        0,
        sidHash(sid, 50 + i),
      ),
      color: s.color ?? 0x2d5a27,
    };
  });

  return { sepals, layers, center };
}

/** Fallback plan when no spec available — sid-based pseudo-random flower. */
function createFallbackPlan(sid: number): FlowerPlan {
  const color = fallbackColor(sid);
  const petalCount = 5 + Math.floor(sidHash(sid, 1) * 3);
  const angleStep = (Math.PI * 2) / petalCount;
  const rotOff = sidHash(sid, 5) * Math.PI * 2;

  const petals = Array.from({ length: petalCount }, (_, i) => ({
    cmds: generatePetal(
      rotOff + i * angleStep,
      "Ovate",
      "Smooth",
      0.5 + sidHash(sid, 2) * 0.3,
      0.5 + sidHash(sid, 3) * 0.3,
      0.1,
      0,
      sidHash(sid, 10 + i),
    ),
  }));

  return {
    sepals: [],
    layers: [{ petals, color, opacity: 1 }],
    center: {
      discRadius: 0.18,
      discColor: darkenColor(color, 0.45),
      highlightRadius: 0.09,
      highlightColor: 0xfefce8,
      stamens: [],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SVG path conversion
// ═══════════════════════════════════════════════════════════════════════════

/** Convert draw commands to an SVG path `d` string, scaled and translated. */
export function cmdsToSvgD(
  cmds: readonly DrawCmd[],
  cx: number,
  cy: number,
  scale: number,
): string {
  return cmds
    .map((cmd) => {
      switch (cmd.op) {
        case "M":
          return `M ${cx + cmd.x * scale} ${cy + cmd.y * scale}`;
        case "L":
          return `L ${cx + cmd.x * scale} ${cy + cmd.y * scale}`;
        case "C":
          return `C ${cx + cmd.c1x * scale} ${cy + cmd.c1y * scale} ${cx + cmd.c2x * scale} ${cy + cmd.c2y * scale} ${cx + cmd.x * scale} ${cy + cmd.y * scale}`;
        case "Z":
          return "Z";
      }
    })
    .join(" ");
}

// ═══════════════════════════════════════════════════════════════════════════
// Legacy API — preserved for any transitional callers
// ═══════════════════════════════════════════════════════════════════════════

/** Resolve flower color from specJson — real spec color or sid-based fallback. */
export function resolveFlowerColor(
  sid: number,
  specJson: string | undefined,
): number {
  const parsed = parseSpec(specJson);
  return parsed?.layers[0]?.color ?? fallbackColor(sid);
}

/** Resolve petal count from specJson — real spec count or sid-based fallback. */
export function resolveFlowerPetalCount(
  sid: number,
  specJson: string | undefined,
): number {
  const parsed = parseSpec(specJson);
  const count = parsed?.layers[0]?.count ?? 0;
  return count > 0 ? count : 5 + Math.floor(sidHash(sid, 1) * 3);
}
