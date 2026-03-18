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

export type StemPlan = {
  cmds: DrawCmd[];
  color: number;
};

export type LeafPlan = {
  cmds: DrawCmd[];
  veins: DrawCmd[];
  color: number;
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
  stem: StemPlan | null;
  leaves: readonly LeafPlan[];
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

/** Offset a DrawCmd by (dx, dy) in unit space. */
function offsetCmd(cmd: DrawCmd, dx: number, dy: number): DrawCmd {
  switch (cmd.op) {
    case "M": return { op: "M", x: cmd.x + dx, y: cmd.y + dy };
    case "L": return { op: "L", x: cmd.x + dx, y: cmd.y + dy };
    case "C": return {
      op: "C",
      c1x: cmd.c1x + dx, c1y: cmd.c1y + dy,
      c2x: cmd.c2x + dx, c2y: cmd.c2y + dy,
      x: cmd.x + dx, y: cmd.y + dy,
    };
    case "Z": return cmd;
  }
}

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

const EMPTY_CENTER: CenterPlan = {
  discRadius: 0, discColor: 0, highlightRadius: 0, highlightColor: 0, stamens: [],
};

/** Create a complete, scale-independent rendering plan from a flower spec. */
export function createFlowerPlan(
  specJson: string | undefined,
  sid: number,
): FlowerPlan {
  const parsed = parseSpec(specJson);
  const baseColor =
    parsed?.layers[0]?.color ?? fallbackColor(sid);

  if (!parsed || parsed.layers.length === 0) {
    // No layers yet (e.g. mid-stream) — return empty plan so only
    // streamed-in parts appear instead of a random fallback flower.
    return { sepals: [], layers: [], center: EMPTY_CENTER, stem: null, leaves: [] };
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

  // ── Stem + leaves (only when spec contains stem/foliage data) ──
  const stemData = parseSpecStem(specJson);
  const foliage = parseFoliage(specJson);
  const stemLen = stemData ? Math.max(0.6, Math.min(1.8, stemData.height * 1.4)) : 0;

  const stem: StemPlan | null = stemData
    ? { cmds: generateStem(0, stemLen, 0, 0, stemData.curvature, Math.max(0.03, Math.min(0.08, stemData.thickness * 0.08)), stemData.color), color: stemData.color }
    : null;

  // Place leaves only when both stem and foliage data exist
  const leaves: LeafPlan[] = stemData && foliage
    ? foliage.leaves.map(l => {
        const pt = stemPointAt(0, stemLen, 0, 0, stemData.curvature, l.position);
        const side = l.side === "right" ? -1 : 1;
        const leafAngle = pt.angle + side * (Math.PI * 0.35) + l.angleOffset;
        const scale = 0.3 + l.size * 0.25;
        const leaf = generateLeaf(pt.x, pt.y, leafAngle, scale, foliage);
        return { cmds: leaf.outline, veins: leaf.veins, color: foliage.color };
      })
    : [];

  return { sepals, layers, center, stem, leaves };
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
// Arrangement rendering — multi-flower compositions with stems and leaves
// ═══════════════════════════════════════════════════════════════════════════

export type ArrangementMember = {
  flowerPlan: FlowerPlan;
  stem: StemPlan;
  leaves: readonly LeafPlan[];
  offsetX: number;
  offsetY: number;
  scale: number;
  angle: number;
};

/** Pre-computed rendering plan for a multi-flower arrangement. */
export type ArrangementPlan = {
  members: readonly ArrangementMember[];
  baseY: number;
};

// ── Stem/leaf spec parsing ──

type ParsedStem = {
  height: number;
  thickness: number;
  curvature: number;
  color: number;
};

function parseSpecStem(specJson: string | undefined): ParsedStem | null {
  if (!specJson) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spec = JSON.parse(specJson) as any;
    const stem = spec.structure?.stem;
    if (!stem) return null;
    return {
      height: stem.height ?? 0.5,
      thickness: stem.thickness ?? 0.3,
      curvature: stem.curvature ?? 0,
      color: colorToHex(stem.color) ?? 0x2d5a27,
    };
  } catch {
    return null;
  }
}

type ParsedLeafInstance = {
  position: number;  // 0-1 along stem
  side: "left" | "right";
  size: number;
  angleOffset: number;
};

type ParsedFoliage = {
  shape: string;
  color: number;
  serration: string;
  droop: number;
  leaves: ParsedLeafInstance[];
};

const DEFAULT_FOLIAGE: ParsedFoliage = {
  shape: "Ovate", color: 0x3a7d32,
  serration: "None", droop: 0.15,
  leaves: [
    { position: 0.35, side: "left", size: 0.5, angleOffset: 0.05 },
    { position: 0.6, side: "right", size: 0.42, angleOffset: -0.08 },
  ],
};

function parseFoliage(specJson: string | undefined): ParsedFoliage | null {
  if (!specJson) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spec = JSON.parse(specJson) as any;
    const foliage = spec.foliage;
    if (!foliage) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawLeaves = Array.isArray(foliage.leaves) ? foliage.leaves : [];
    // Handle both AI-generated format (position/side) and Rust-serialized format
    // (shape/size without position/side). Alternate sides and spread evenly when
    // position/side are missing.
    const count = Math.min(rawLeaves.length, 6);
    const leaves: ParsedLeafInstance[] = rawLeaves.slice(0, 6).map((l: any, i: number) => ({
      position: Math.max(0.25, Math.min(0.85,
        l.position ?? 0.25 + (i / Math.max(1, count - 1)) * 0.55)),
      side: l.side === "right" || l.side === "left"
        ? l.side as "left" | "right"
        : (i % 2 === 0 ? "left" as const : "right" as const),
      size: Math.max(0.2, Math.min(1.0, l.size ?? 0.5)),
      angleOffset: Math.max(-0.3, Math.min(0.3,
        l.angle_offset ?? (i % 2 === 0 ? 0.05 : -0.08))),
    }));

    // leaf_shape/leaf_color come from AI format; Rust serializes shape/color
    // on individual Leaf objects — pull from first leaf as fallback
    const firstLeaf = rawLeaves[0];
    const leafShape = foliage.leaf_shape
      ?? firstLeaf?.shape
      ?? "Ovate";
    const leafColor = colorToHex(foliage.leaf_color)
      ?? colorToHex(firstLeaf?.color?.stops?.[0]?.color)
      ?? 0x3a7d32;

    return {
      shape: leafShape,
      color: leafColor,
      serration: foliage.serration ?? firstLeaf?.serration ?? "None",
      droop: foliage.droop ?? firstLeaf?.droop ?? 0.15,
      leaves: leaves.length > 0 ? leaves : DEFAULT_FOLIAGE.leaves,
    };
  } catch {
    return null;
  }
}

// ── Stem generation ──

/** Generate a stem outline as a closed path (two parallel bezier curves). */
function generateStem(
  fromX: number, fromY: number,
  toX: number, toY: number,
  curvature: number,
  halfWidth: number,
  _color: number,
): DrawCmd[] {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return [];

  // Normal perpendicular to stem direction
  const nx = -dy / len;
  const ny = dx / len;

  // Curvature offset at midpoint (lateral bend)
  const curvOff = curvature * len * 0.3;
  const midX = (fromX + toX) / 2 + nx * curvOff;
  const midY = (fromY + toY) / 2 + ny * curvOff;

  // Taper: wider at base, narrower at top
  const baseW = halfWidth;
  const tipW = halfWidth * 0.5;

  // Left side (base → tip)
  const lb1x = fromX + nx * baseW;
  const lb1y = fromY + ny * baseW;
  const lm1x = midX + nx * (baseW + tipW) * 0.5;
  const lm1y = midY + ny * (baseW + tipW) * 0.5;
  const lt1x = toX + nx * tipW;
  const lt1y = toY + ny * tipW;

  // Right side (tip → base)
  const rt1x = toX - nx * tipW;
  const rt1y = toY - ny * tipW;
  const rm1x = midX - nx * (baseW + tipW) * 0.5;
  const rm1y = midY - ny * (baseW + tipW) * 0.5;
  const rb1x = fromX - nx * baseW;
  const rb1y = fromY - ny * baseW;

  return [
    { op: "M", x: lb1x, y: lb1y },
    { op: "C", c1x: lb1x, c1y: lb1y + (lm1y - lb1y) * 0.5, c2x: lm1x, c2y: lm1y - (lm1y - lb1y) * 0.5, x: lm1x, y: lm1y },
    { op: "C", c1x: lm1x, c1y: lm1y + (lt1y - lm1y) * 0.5, c2x: lt1x, c2y: lt1y - (lt1y - lm1y) * 0.5, x: lt1x, y: lt1y },
    { op: "L", x: rt1x, y: rt1y },
    { op: "C", c1x: rt1x, c1y: rt1y + (rm1y - rt1y) * 0.5, c2x: rm1x, c2y: rm1y - (rm1y - rt1y) * 0.5, x: rm1x, y: rm1y },
    { op: "C", c1x: rm1x, c1y: rm1y + (rb1y - rm1y) * 0.5, c2x: rb1x, c2y: rb1y - (rb1y - rm1y) * 0.5, x: rb1x, y: rb1y },
    { op: "Z" },
  ];
}

// ── Stem interpolation ──

/** Get a point and tangent angle along a curved stem at parameter t ∈ [0,1] (base → tip). */
function stemPointAt(
  fromX: number, fromY: number,
  toX: number, toY: number,
  curvature: number,
  t: number,
): { x: number; y: number; angle: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len;
  const ny = dx / len;
  const curvOff = curvature * len * 0.3;
  const midX = (fromX + toX) / 2 + nx * curvOff;
  const midY = (fromY + toY) / 2 + ny * curvOff;

  // Quadratic bezier: B(t) = (1-t)²·from + 2(1-t)t·mid + t²·to
  const u = 1 - t;
  const x = u * u * fromX + 2 * u * t * midX + t * t * toX;
  const y = u * u * fromY + 2 * u * t * midY + t * t * toY;

  // Tangent: B'(t) = 2(1-t)(mid-from) + 2t(to-mid)
  const tx = 2 * u * (midX - fromX) + 2 * t * (toX - midX);
  const ty = 2 * u * (midY - fromY) + 2 * t * (toY - midY);
  const angle = Math.atan2(-tx, ty); // perpendicular to stem direction

  return { x, y, angle };
}

// ── Leaf generation ──

// ── Leaf shape profiles — width at t ∈ [0,1] (petiole → tip) ──

const LEAF_PROFILES: Record<string, (t: number) => number> = {
  // Egg-shaped — widest at ~35%
  Ovate: (t) => Math.sin(Math.PI * Math.pow(t, 0.65)),
  // Narrow lance — widest near 25%, long taper
  Lanceolate: (t) => Math.sin(Math.PI * t) * Math.pow(1 - t, 0.2) * 1.1,
  // Heart-shaped — very wide base, notched tip
  Cordate: (t) => {
    const base = Math.sin(Math.PI * Math.pow(t, 0.5)) * 1.2;
    return t < 0.1 ? base * (0.4 + t * 6) : base;
  },
  // Hand-shaped — wide with undulations suggesting lobes
  Palmate: (t) => {
    const base = Math.sin(Math.PI * Math.pow(t, 0.55));
    const lobes = 1 + Math.sin(t * Math.PI * 5) * 0.15 * Math.sin(Math.PI * t);
    return base * lobes;
  },
  // Feather-like — narrow, with slight scallops
  Pinnate: (t) => {
    const base = Math.sin(Math.PI * t) * 0.7;
    const scallop = 1 + Math.sin(t * Math.PI * 8) * 0.1;
    return base * scallop;
  },
  // Grass-like — uniform narrow width
  Linear: (t) => {
    if (t < 0.05) return (t / 0.05) * 0.35;
    if (t > 0.9) return 0.35 * (1 - (t - 0.9) / 0.1);
    return 0.35;
  },
  // Kidney-shaped — very wide and rounded
  Reniform: (t) => Math.sqrt(Math.max(0, Math.sin(Math.PI * t))) * 1.3,
  // Arrow-shaped — barbed base
  Sagittate: (t) => {
    if (t < 0.15) return 0.6 + (1 - t / 0.15) * 0.5;
    return Math.sin(Math.PI * Math.pow(t, 0.7)) * 0.9;
  },
  // Shield-shaped — round
  Peltate: (t) => Math.sqrt(Math.max(0, Math.sin(Math.PI * t))) * 1.1,
  // Needle — very narrow
  Acicular: (t) => {
    if (t < 0.05) return (t / 0.05) * 0.18;
    return 0.18 * (1 - Math.pow(t, 2));
  },
  // Halberd-shaped
  Hastate: (t) => {
    if (t < 0.12) return 0.5 + (1 - t / 0.12) * 0.4;
    return Math.sin(Math.PI * Math.pow(t, 0.65)) * 0.85;
  },
};

function leafProfile(shape: string, t: number): number {
  return (LEAF_PROFILES[shape] ?? LEAF_PROFILES.Ovate!)(Math.max(0, Math.min(1, t)));
}

/** Edge serration modifier for leaves. */
function leafSerration(style: string, t: number, seed: number): number {
  switch (style) {
    case "Fine":
      return 1 + Math.sin(t * 30 + seed) * 0.06;
    case "Coarse":
      return 1 + Math.sin(t * 12 + seed) * 0.12;
    case "Lobed":
      return 1 + Math.sin(t * 5 + seed) * 0.2 * Math.sin(Math.PI * t);
    case "Crenate":
      return 1 + (Math.sin(t * 16 + seed) > 0 ? 0.08 : -0.04);
    case "Dentate":
      return 1 + (((t * 14 + seed * 0.1) % 1) < 0.5 ? 0.1 : -0.05);
    case "Doubly":
      return 1 + Math.sin(t * 20 + seed) * 0.07 + Math.sin(t * 8 + seed * 2) * 0.1;
    default:
      return 1;
  }
}

/** Leaf geometry: filled outline + vein strokes (midrib + side veins). */
type LeafGeometry = { outline: DrawCmd[]; veins: DrawCmd[] };

/** Attempt a simple seeded pseudo-noise for edge variation. */
function leafNoise(t: number, seed: number): number {
  const x = Math.sin(t * 17.3 + seed * 7.9) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1; // -1..1
}

function generateLeaf(
  x: number, y: number,
  angle: number,
  size: number,
  foliage?: ParsedFoliage,
): LeafGeometry {
  const ld = foliage ?? DEFAULT_FOLIAGE;
  const len = size * 1.1;
  const halfW = size * 0.32;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const droopAmt = ld.droop * len * 0.3;
  const seed = angle * 7.3 + size * 3.1;

  // Transform local leaf coords (along midrib, perpendicular) to world
  const toWorld = (along: number, perp: number): Vec2 => {
    const sag = droopAmt * (along / len) * (along / len);
    return [
      x + cosA * along + sinA * (sag + perp),
      y - sinA * along + cosA * (sag + perp),
    ];
  };

  // Polar-inspired outline (adapted from gaia-incremental)
  // Sample points around the leaf using an elliptical envelope with
  // pointed ends via sin(angle*2) modulation + noise for organic edges
  const N = 16;
  const outlinePts: Vec2[] = [];

  for (let i = 0; i <= N; i++) {
    const t = i / N;

    // Width profile from shape enum
    const baseW = halfW * leafProfile(ld.shape, t) * leafSerration(ld.serration, t, seed);

    // Organic edge irregularity (like gaia's p.noise)
    const noise = leafNoise(t, seed) * halfW * 0.08;

    // Asymmetry — slightly wider on one side
    const w = (baseW + noise) * (t < 0.5 ? 1.04 : 0.96);

    outlinePts.push(toWorld(t * len, w));
  }

  // Return path: tip back to base on the other side
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const baseW = halfW * leafProfile(ld.shape, t) * leafSerration(ld.serration, t, seed);
    const noise = leafNoise(t, seed + 5) * halfW * 0.08;
    const w = (baseW + noise) * (t < 0.5 ? 0.96 : 1.04);
    outlinePts.push(toWorld(t * len, -w));
  }

  // Smooth the outline with Catmull-Rom → Bézier
  const outline = smoothCmds(outlinePts);
  outline.push({ op: "Z" });

  // Veins: midrib + 3-4 branching side veins (like gaia-incremental)
  const veins: DrawCmd[] = [];
  const base = toWorld(0, 0);
  const tip = toWorld(len, 0);

  // Midrib
  veins.push({ op: "M", x: base[0], y: base[1] });
  veins.push({ op: "L", x: tip[0], y: tip[1] });

  // Side veins: branch alternately from midrib
  const veinCount = Math.max(3, Math.min(6, Math.round(len * 8)));
  for (let i = 0; i < veinCount; i++) {
    const vt = 0.15 + (i / (veinCount - 1)) * 0.7; // 15-85% along midrib
    const veinBase = toWorld(vt * len, 0);
    const side = i % 2 === 0 ? 1 : -1;
    // Veins angle outward at ~40° from midrib, shorter toward tip
    const veinLen = halfW * leafProfile(ld.shape, vt) * 0.85;
    const veinTip = toWorld(vt * len + len * 0.08, side * veinLen);

    veins.push({ op: "M", x: veinBase[0], y: veinBase[1] });
    veins.push({ op: "L", x: veinTip[0], y: veinTip[1] });
  }

  return { outline, veins };
}

// ── Arrangement layout ──

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees

type LayoutSlot = {
  offsetX: number;
  offsetY: number;
  stemAngle: number;
  scale: number;
  stemLength: number;
};

/** Compute flower positions for an arrangement level. */
function layoutForLevel(count: number, level: number): LayoutSlot[] {
  if (count <= 1) {
    // Single stem — straight down
    return [{ offsetX: 0, offsetY: -0.7, stemAngle: 0, scale: 1.0, stemLength: 0.7 }];
  }

  return Array.from({ length: count }, (_, i) => {
    const isHero = i === 0;

    if (level <= 2) {
      // Group (2-3): fan stems from shared base
      const spread = Math.PI * 0.35;
      const angleStep = count > 1 ? spread / (count - 1) : 0;
      const angle = -spread / 2 + i * angleStep;
      const stemLen = isHero ? 0.8 : 0.65;
      return {
        offsetX: Math.sin(angle) * stemLen * 0.7,
        offsetY: -stemLen * 0.85 + Math.abs(Math.sin(angle)) * 0.15,
        stemAngle: angle,
        scale: isHero ? 0.85 : 0.7,
        stemLength: stemLen,
      };
    }

    if (level <= 3) {
      // Bunch (4-6): wider fan
      const spread = Math.PI * 0.55;
      const angleStep = count > 1 ? spread / (count - 1) : 0;
      const angle = -spread / 2 + i * angleStep;
      const stemLen = isHero ? 0.8 : 0.55 + Math.random() * 0.15;
      return {
        offsetX: Math.sin(angle) * stemLen * 0.6,
        offsetY: -stemLen * 0.8 + Math.abs(Math.sin(angle)) * 0.2,
        stemAngle: angle,
        scale: isHero ? 0.8 : 0.6 + (1 - Math.abs(angle) / (spread / 2)) * 0.1,
        stemLength: stemLen,
      };
    }

    // Arrangement / Bouquet / Centerpiece: golden-angle spiral
    const radius = isHero ? 0 : 0.2 + Math.sqrt(i / count) * 0.5;
    const theta = i * GOLDEN_ANGLE;
    const stemLen = isHero ? 0.85 : 0.55 + (1 - radius) * 0.2;
    return {
      offsetX: Math.cos(theta) * radius,
      offsetY: -stemLen * 0.75 + Math.sin(theta) * radius * 0.3,
      stemAngle: Math.cos(theta) * radius * 0.6,
      scale: isHero ? 0.8 : Math.max(0.45, 0.7 - radius * 0.35),
      stemLength: stemLen,
    };
  });
}

/** Create a complete arrangement plan from constituent flower specs. */
export function createArrangementPlan(
  constituents: ReadonlyArray<{ specJson: string; sid: number }>,
  level: number,
): ArrangementPlan {
  const count = constituents.length;
  const slots = layoutForLevel(count, level);
  const baseY = 0.9; // stems converge at this Y (below flower heads)

  const members: ArrangementMember[] = slots.map((slot, i) => {
    const { specJson, sid } = constituents[Math.min(i, count - 1)]!;
    const flowerPlan = createFlowerPlan(specJson, sid);
    const stemData = parseSpecStem(specJson);
    const foliage = parseFoliage(specJson);

    // Stem from base to flower head position (use defaults for arrangements since
    // the arrangement layout itself provides structure even when spec is partial)
    const stemThickness = stemData?.thickness ?? 0.3;
    const stemCurvatureBase = stemData?.curvature ?? 0;
    const stemColor = stemData?.color ?? 0x2d5a27;
    const stemHalfW = Math.max(0.03, Math.min(0.08, stemThickness * 0.08));
    const stemCurvature = stemCurvatureBase + slot.stemAngle * 0.3;
    // Extend stem slightly past the head center so the tip overlaps into the
    // flower head, covering the BASE_OFFSET gap between center and petal ring.
    const dx = slot.offsetX - 0;
    const dy = slot.offsetY - baseY;
    const stemDist = Math.sqrt(dx * dx + dy * dy);
    const overshoot = 0.06; // push tip 6% of unit radius into the flower head
    const tipX = stemDist > 0.01 ? slot.offsetX + (dx / stemDist) * overshoot : slot.offsetX;
    const tipY = stemDist > 0.01 ? slot.offsetY + (dy / stemDist) * overshoot : slot.offsetY;
    const stemCmds = generateStem(
      0, baseY,
      tipX, tipY,
      stemCurvature,
      stemHalfW,
      stemColor,
    );

    const stem: StemPlan = { cmds: stemCmds, color: stemColor };

    // One leaf per arrangement stem, placed mid-stem, smaller to avoid overlap
    const leaves: LeafPlan[] = foliage && foliage.leaves.length > 0
      ? [foliage.leaves[0]!].map(l => {
          // Place at 40-60% up the stem (avoid crowded base area)
          const pos = Math.max(0.4, Math.min(0.6, l.position));
          const pt = stemPointAt(0, baseY, slot.offsetX, slot.offsetY, stemCurvature, pos);
          const side = l.side === "right" ? -1 : 1;
          const leafAngle = pt.angle + side * (Math.PI * 0.35) + l.angleOffset;
          const leafScale = (0.2 + l.size * 0.15) * slot.scale;
          const leaf = generateLeaf(pt.x, pt.y, leafAngle, leafScale, foliage);
          return { cmds: leaf.outline, veins: leaf.veins, color: foliage.color };
        })
      : [];

    return {
      flowerPlan,
      stem,
      leaves,
      offsetX: slot.offsetX,
      offsetY: slot.offsetY,
      scale: slot.scale,
      angle: slot.stemAngle,
    };
  });

  return { members, baseY };
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
