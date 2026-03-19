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

/** Desaturate a color by blending toward its luminance gray. */
function desaturate(color: number, amount: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const lum = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
  const nr = Math.round(r + (lum - r) * amount);
  const ng = Math.round(g + (lum - g) * amount);
  const nb = Math.round(b + (lum - b) * amount);
  return (nr << 16) | (ng << 8) | nb;
}

/** Shift color toward warm (increase red, decrease blue). */
function warmShift(color: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + 15);
  const g = (color >> 8) & 0xff;
  const b = Math.max(0, (color & 0xff) - 10);
  return (r << 16) | (g << 8) | b;
}

/** Shift color toward cool (increase blue, decrease red). */
function coolShift(color: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) - 10);
  const g = (color >> 8) & 0xff;
  const b = Math.min(255, (color & 0xff) + 15);
  return (r << 16) | (g << 8) | b;
}

/** Convert an { r, g, b } object (0–1 range) to a packed hex color number. */
function rgbToNumber(c: { r: number; g: number; b: number }): number {
  return colorFromSpec(c.r, c.g, c.b);
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

  // ── v2 shapes ──

  // Wedge — narrow base, widest at the very tip, abrupt end
  Cuneate: (t) => t < 0.85 ? Math.pow(t / 0.85, 1.5) * 0.95 : 0.95 * Math.cos((Math.PI * 0.5 * (t - 0.85)) / 0.15),

  // Long-tapered pointed tip — like lanceolate but with exaggerated tip
  Acuminate: (t) => Math.sin(Math.PI * t) * Math.pow(1 - t, 0.6) * 1.3,

  // Fiddle/violin — pinched waist at ~50%
  Panduriform: (t) => {
    const base = Math.sin(Math.PI * Math.pow(t, 0.65));
    const pinch = 1 - 0.4 * Math.exp(-Math.pow((t - 0.5) / 0.12, 2));
    return base * pinch;
  },

  // Clawed base (narrow stalk) widening into broad blade
  Unguiculate: (t) =>
    t < 0.25
      ? (t / 0.25) * 0.2
      : 0.2 + 0.8 * Math.sin((Math.PI * (t - 0.25)) / 0.75),

  // Fan-shaped — very wide at the outer edge, narrow base
  Flabellate: (t) =>
    t < 0.15
      ? (t / 0.15) * 0.15
      : 0.15 + 0.85 * Math.pow(Math.sin((Math.PI * (t - 0.15)) / 0.85), 0.5),

  // Reverse egg — widest at ~65% from base
  Obovate: (t) => Math.sin(Math.PI * Math.pow(t, 1.4)),

  // Diamond — widest at exact center, angular taper both ways
  Rhomboid: (t) =>
    t < 0.5
      ? t * 2 * 0.85
      : (1 - t) * 2 * 0.85,

  // Thread-like — extremely narrow throughout
  Filiform: (t) => {
    if (t < 0.05) return (t / 0.05) * 0.12;
    if (t > 0.9) return 0.12 * (1 - (t - 0.9) / 0.1);
    return 0.12;
  },

  // Kidney-shaped — very wide and short, almost wider than long
  Reniform: (t) => Math.sqrt(Math.max(0, Math.sin(Math.PI * t))) * 1.4,

  // Arrow-shaped — barbed backward-pointing base lobes
  Sagittate: (t) => {
    if (t < 0.12) return 0.7 + (1 - t / 0.12) * 0.5;
    return Math.sin(Math.PI * Math.pow(t, 0.7)) * 0.85;
  },
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
    // ── v2 edge styles ──
    case "Lobed":
      return 1 + Math.sin(t * 4 + seed * 2) * 0.25 * Math.sin(Math.PI * t);
    case "Plicate":
      return 1 + Math.abs(Math.sin(t * 12 + seed * 3)) * 0.1 - 0.05;
    case "Revolute":
      return t > 0.3 ? 1 - (t - 0.3) * 0.18 : 1;
    case "Dentate":
      return 1 + (((t * 16 + seed * 0.1) % 1) < 0.4 ? 0.14 : -0.04);
    case "Erose":
      return 1 + (Math.sin(t * 31 + seed * 11) * Math.cos(t * 19 + seed * 5)) * 0.13;
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

function buildCenter(parsed: NonNullable<ReturnType<typeof parseSpec>>, baseColor: number, sid: number): CenterPlan {
  if (parsed.layers.length === 0) return EMPTY_CENTER;

  const layerFactor = Math.max(0.4, 1 - parsed.layers.length * 0.15);
  const discRadius = Math.max(
    0.06,
    Math.min(0.35, parsed.center.receptacleSize * 0.25 * layerFactor),
  );
  const pistilColor = parsed.center.pistilColor ?? darkenColor(baseColor, 0.4);

  const stamens: StamenPlan[] = parsed.center.stamens.map((s, i) => ({
    angle:
      (i / Math.max(1, parsed.center.stamens.length)) * Math.PI * 2 +
      sidHash(sid, 20 + i) * 0.4,
    length: discRadius + s.height * 0.25,
    filamentColor: s.filamentColor ?? darkenColor(baseColor, 0.6),
    antherColor: s.antherColor ?? 0xffd700,
    antherRadius: 0.025,
  }));

  return {
    discRadius,
    discColor: pistilColor,
    highlightRadius: discRadius * 0.45,
    highlightColor: lightenColor(pistilColor, 0.35),
    stamens,
  };
}

/** Create a complete, scale-independent rendering plan from a flower spec. */
export function createFlowerPlan(
  specJson: string | undefined,
  sid: number,
): FlowerPlan {
  const parsed = parseSpec(specJson);

  if (!parsed) {
    // Unparseable spec — return empty plan.
    return { sepals: [], layers: [], center: EMPTY_CENTER, stem: null, leaves: [] };
  }

  const baseColor =
    parsed.layers[0]?.color ?? fallbackColor(sid);

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
  // Skip center when no petals yet (mid-stream: only stem/foliage so far)
  const center: CenterPlan = buildCenter(parsed, baseColor, sid);

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
    ? { cmds: generateStem(0, stemLen, 0, 0, stemData.curvature ?? 0.1, Math.max(0.03, Math.min(0.08, (stemData.thickness ?? 0.3) * 0.08)), stemData.color ?? 0x2d5a27, stemData.style), color: stemData.color ?? 0x2d5a27 }
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

export type AdornmentPlan = {
  /** Main shape (wrap body, vase body, pedestal, etc.) */
  cmds: DrawCmd[];
  color: number;
  opacity: number;
  /** Optional accent detail (ribbon, bow, trim line) */
  accent?: { cmds: DrawCmd[]; color: number; opacity: number };
  /** Optional second accent (bow loops, vase rim, etc.) */
  detail?: { cmds: DrawCmd[]; color: number; opacity: number };
};

/** Pre-computed rendering plan for a multi-flower arrangement. */
export type ArrangementPlan = {
  members: readonly ArrangementMember[];
  baseY: number;
  adornment: AdornmentPlan | null;
};

// ── AI-driven adornment types ──

/** Metadata returned by the AI combine endpoint, stored as arrangement override. */
export type ArrangementMeta = {
  name?: string;
  adornments?: string[];
  sprite_hints?: { dominant_color?: string; secondary_color?: string; accent_style?: string };
  harmony_note?: string;
  adornment_spec?: AdornmentSpec;
};

/** Structured adornment spec — AI picks the visual vocabulary. */
export type AdornmentSpec = {
  container: {
    type: "tie" | "wrap" | "basket" | "vase" | "urn";
    material: "kraft" | "tissue" | "silk" | "ceramic" | "glass" | "wicker" | "metal";
    color: { r: number; g: number; b: number };
  };
  accent: {
    type: "ribbon" | "bow" | "twine" | "trim" | "band" | "none";
    color: { r: number; g: number; b: number };
  };
  base?: {
    type: "none" | "saucer" | "pedestal" | "plinth";
    color: { r: number; g: number; b: number };
  };
  mood: string;
  evolved_from?: string;
};

/** Parse raw JSON into ArrangementMeta, stripping adornment_spec if it
 *  fails structural validation (legacy records from before Output.object). */
export function parseArrangementMeta(json: string): ArrangementMeta | undefined {
  try {
    const raw = JSON.parse(json) as ArrangementMeta;
    if (raw.adornment_spec) {
      const s = raw.adornment_spec;
      if (!s.container?.type || !s.container.material || !s.container.color
        || !s.accent?.type || !s.accent.color || !s.mood) {
        return { ...raw, adornment_spec: undefined };
      }
    }
    return raw;
  } catch {
    return undefined;
  }
}

// ── Stem/leaf spec parsing ──

type ParsedStem = {
  height: number;
  thickness: number;
  curvature: number;
  color: number;
  style: string;
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
      style: stem.style ?? "Straight",
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

/** Apply stem style modifiers — returns adjusted curvature, halfWidth, and taperRatio. */
function stemStyleModifiers(style: string, curvature: number, halfWidth: number): {
  curvature: number; halfWidth: number; tipRatio: number; segments: number;
} {
  switch (style) {
    case "Arching":
      return { curvature: Math.max(0.2, curvature + 0.15), halfWidth, tipRatio: 0.45, segments: 2 };
    case "Sinuous":
      return { curvature, halfWidth, tipRatio: 0.5, segments: 3 }; // S-curve uses 3 segments
    case "Zigzag":
      return { curvature: 0, halfWidth: halfWidth * 0.9, tipRatio: 0.6, segments: 4 }; // angular
    case "Succulent":
      return { curvature: curvature * 0.5, halfWidth: halfWidth * 2.2, tipRatio: 0.8, segments: 2 };
    case "Woody":
      return { curvature: curvature * 0.7, halfWidth: halfWidth * 1.6, tipRatio: 0.35, segments: 2 };
    case "Trailing":
      return { curvature: Math.min(-0.2, curvature - 0.3), halfWidth, tipRatio: 0.55, segments: 2 };
    case "Twining":
      return { curvature, halfWidth: halfWidth * 0.85, tipRatio: 0.5, segments: 3 };
    default: // Straight
      return { curvature, halfWidth, tipRatio: 0.5, segments: 2 };
  }
}

/** Generate a stem outline as a closed path (two parallel bezier curves). */
function generateStem(
  fromX: number, fromY: number,
  toX: number, toY: number,
  curvature: number,
  halfWidth: number,
  _color: number,
  style?: string,
): DrawCmd[] {
  const mods = stemStyleModifiers(style ?? "Straight", curvature, halfWidth);
  const effCurvature = mods.curvature;
  const effHW = mods.halfWidth;

  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return [];

  // Normal perpendicular to stem direction
  const nx = -dy / len;
  const ny = dx / len;

  // ── Sinuous / Twining: S-curve with two midpoints ──
  if ((style === "Sinuous" || style === "Twining") && len > 0.1) {
    const sway = style === "Twining" ? len * 0.18 : len * 0.22;
    const t1 = 0.33, t2 = 0.66;
    const m1x = fromX + dx * t1 + nx * sway;
    const m1y = fromY + dy * t1 + ny * sway;
    const m2x = fromX + dx * t2 - nx * sway;
    const m2y = fromY + dy * t2 - ny * sway;

    const baseW = effHW;
    const tipW = effHW * mods.tipRatio;
    const w1 = baseW * 0.75 + tipW * 0.25;
    const w2 = baseW * 0.35 + tipW * 0.65;

    // Simplified S-curve: base → m1 → m2 → tip, each side
    const pts: Vec2[] = [
      [fromX, fromY], [m1x, m1y], [m2x, m2y], [toX, toY],
    ];
    const ws = [baseW, w1, w2, tipW];

    const left = pts.map((p, i) => [p[0] + nx * ws[i]!, p[1] + ny * ws[i]!] as Vec2);
    const right = pts.map((p, i) => [p[0] - nx * ws[i]!, p[1] - ny * ws[i]!] as Vec2);
    const leftCmds = smoothCmds(left);
    const rightCmds = smoothCmds(right.toReversed());

    const cmds: DrawCmd[] = [...leftCmds];
    if (rightCmds.length > 0 && rightCmds[0]!.op === "M") {
      cmds.push({ op: "L", x: rightCmds[0]!.x, y: rightCmds[0]!.y });
      cmds.push(...rightCmds.slice(1));
    }
    cmds.push({ op: "Z" });
    return cmds;
  }

  // ── Zigzag: angular segments ──
  if (style === "Zigzag" && len > 0.1) {
    const segs = 4;
    const zigAmt = len * 0.08;
    const pts: Vec2[] = [[fromX, fromY]];
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const sign = i % 2 === 1 ? 1 : -1;
      pts.push([
        fromX + dx * t + nx * zigAmt * sign,
        fromY + dy * t + ny * zigAmt * sign,
      ]);
    }
    pts.push([toX, toY]);

    const baseW = effHW;
    const tipW = effHW * mods.tipRatio;
    const left = pts.map((p, i) => {
      const w = baseW + (tipW - baseW) * (i / (pts.length - 1));
      return [p[0] + nx * w, p[1] + ny * w] as Vec2;
    });
    const right = pts.map((p, i) => {
      const w = baseW + (tipW - baseW) * (i / (pts.length - 1));
      return [p[0] - nx * w, p[1] - ny * w] as Vec2;
    });

    // Use line segments for the angular look
    const cmds: DrawCmd[] = [{ op: "M", x: left[0]![0], y: left[0]![1] }];
    left.slice(1).map(p => { cmds.push({ op: "L", x: p[0], y: p[1] }); return null; });
    right.toReversed().map(p => { cmds.push({ op: "L", x: p[0], y: p[1] }); return null; });
    cmds.push({ op: "Z" });
    return cmds;
  }

  // ── Standard stem (Straight, Arching, Woody, Succulent, Trailing) ──
  const curvOff = effCurvature * len * 0.3;
  const midX = (fromX + toX) / 2 + nx * curvOff;
  const midY = (fromY + toY) / 2 + ny * curvOff;

  const baseW = effHW;
  const tipW = effHW * mods.tipRatio;

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

  // ── v2 leaf shapes ──

  // Reverse egg — widest near tip (~65%)
  Obovate: (t) => Math.sin(Math.PI * Math.pow(t, 1.4)),

  // Evenly oval — symmetric, widest at center
  Elliptic: (t) => Math.sin(Math.PI * t) * 0.95,

  // Reverse lance — widest near tip, long basal taper
  Oblanceolate: (t) => Math.sin(Math.PI * t) * Math.pow(t, 0.3) * 1.05,

  // Triangular — widest at base, straight taper
  Deltoid: (t) => Math.max(0, 1 - t * 0.9) * Math.sqrt(Math.min(1, t * 6)),

  // Spoon-shaped — narrow stalk, rounded broad tip
  Spatulate: (t) =>
    t < 0.35
      ? (t / 0.35) * 0.25
      : 0.25 + 0.75 * Math.sin((Math.PI * (t - 0.35)) / 0.65),

  // Round — nearly circular outline
  Orbicular: (t) => Math.sqrt(Math.max(0, Math.sin(Math.PI * t))) * 1.3,

  // Lyre-shaped — large terminal lobe, smaller basal lobes
  Lyrate: (t) => {
    if (t < 0.15) return 0.5 + Math.sin((Math.PI * t) / 0.15) * 0.3;
    if (t < 0.35) return 0.3 + (t - 0.15) / 0.2 * 0.2;
    return 0.5 + 0.5 * Math.sin((Math.PI * (t - 0.35)) / 0.65);
  },

  // Wedge — narrow base, widens steadily to blunt tip
  Cuneate: (t) =>
    t < 0.85
      ? Math.pow(t / 0.85, 1.3) * 0.9
      : 0.9 * Math.cos((Math.PI * 0.5 * (t - 0.85)) / 0.15),

  // Sickle-shaped — asymmetric curve (handled via the profile + noise)
  Falcate: (t) => Math.sin(Math.PI * t) * 0.6,

  // Doubly feathered — fern-like with pronounced scallops
  Bipinnate: (t) => {
    const base = Math.sin(Math.PI * t) * 0.65;
    const fronds = 1 + Math.sin(t * Math.PI * 12) * 0.2 * Math.sin(Math.PI * t);
    return base * fronds;
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
    case "Spinose":
      return 1 + (((t * 8 + seed * 0.1) % 1) < 0.3 ? 0.18 : -0.02);
    case "Ciliate":
      return 1 + Math.sin(t * 40 + seed) * 0.04;
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

// ── Adornment generators ──
// Each returns DrawCmd[] in unit space, centered on x=0, anchored at baseY.

const WRAP_KRAFT = 0x8B7355;    // warm kraft brown
const WRAP_TISSUE = 0xD4C5B0;   // soft tissue beige
const RIBBON_COLOR = 0xC4A882;  // natural twine
const VASE_COLOR = 0x6B7B8D;    // slate ceramic
const VASE_RIM = 0x8899A6;      // lighter ceramic rim
const STAND_COLOR = 0x5A5A5A;   // stone gray
const STAND_TOP = 0x707070;     // lighter stone

/** Simple tie/band around stems — Group level (2-3 flowers). */
function generateTieAdornment(baseY: number, colors?: { main: number; accent: number }): AdornmentPlan {
  const bandY = baseY - 0.18;  // just above convergence point
  const bandH = 0.025;
  const bandW = 0.08;

  const cmds: DrawCmd[] = [
    { op: "M", x: -bandW, y: bandY - bandH },
    { op: "C", c1x: -bandW, c1y: bandY - bandH * 2, c2x: bandW, c2y: bandY - bandH * 2, x: bandW, y: bandY - bandH },
    { op: "L", x: bandW, y: bandY + bandH },
    { op: "C", c1x: bandW, c1y: bandY + bandH * 2, c2x: -bandW, c2y: bandY + bandH * 2, x: -bandW, y: bandY + bandH },
    { op: "Z" },
  ];

  // Small knot/bow center
  const knotR = 0.015;
  const accent: DrawCmd[] = [
    { op: "M", x: -knotR, y: bandY },
    { op: "C", c1x: -knotR, c1y: bandY - knotR * 2, c2x: knotR, c2y: bandY - knotR * 2, x: knotR, y: bandY },
    { op: "C", c1x: knotR, c1y: bandY + knotR * 2, c2x: -knotR, c2y: bandY + knotR * 2, x: -knotR, y: bandY },
    { op: "Z" },
  ];

  const mainColor = colors?.main ?? RIBBON_COLOR;
  const accentColor = colors?.accent ?? darkenColor(RIBBON_COLOR, 0.7);

  return {
    cmds,
    color: mainColor,
    opacity: 0.85,
    accent: { cmds: accent, color: accentColor, opacity: 0.9 },
  };
}

/** Paper wrap cone — Bunch level (4-6 flowers). */
function generateWrapAdornment(baseY: number, colors?: { main: number; accent: number }): AdornmentPlan {
  const topY = baseY - 0.35;   // wrap opens wide near the flower heads
  const botY = baseY + 0.05;   // wraps slightly past the base
  const topW = 0.35;           // wide opening
  const botW = 0.06;           // narrow bottom point

  // Wrap body — tapered cone with curved edges
  const cmds: DrawCmd[] = [
    { op: "M", x: -topW, y: topY },
    { op: "C", c1x: -topW * 0.9, c1y: topY + (botY - topY) * 0.4,
      c2x: -botW * 1.5, c2y: botY - (botY - topY) * 0.2,
      x: -botW, y: botY },
    { op: "C", c1x: -botW * 0.3, c1y: botY + 0.02,
      c2x: botW * 0.3, c2y: botY + 0.02,
      x: botW, y: botY },
    { op: "C", c1x: botW * 1.5, c1y: botY - (botY - topY) * 0.2,
      c2x: topW * 0.9, c2y: topY + (botY - topY) * 0.4,
      x: topW, y: topY },
    // Curved top edge (paper fold)
    { op: "C", c1x: topW * 0.7, c1y: topY - 0.03,
      c2x: -topW * 0.7, c2y: topY - 0.03,
      x: -topW, y: topY },
    { op: "Z" },
  ];

  // Ribbon tie around the middle of the wrap
  const tieY = baseY - 0.1;
  const tieW = 0.12;
  const tieH = 0.018;
  const accent: DrawCmd[] = [
    { op: "M", x: -tieW, y: tieY - tieH },
    { op: "L", x: tieW, y: tieY - tieH },
    { op: "L", x: tieW, y: tieY + tieH },
    { op: "L", x: -tieW, y: tieY + tieH },
    { op: "Z" },
  ];

  const mainColor = colors?.main ?? WRAP_KRAFT;
  const accentColor = colors?.accent ?? RIBBON_COLOR;

  return {
    cmds,
    color: mainColor,
    opacity: 0.75,
    accent: { cmds: accent, color: accentColor, opacity: 0.85 },
  };
}

/** Vase — Arrangement/Bouquet level (7-19 flowers). */
function generateVaseAdornment(baseY: number, colors?: { main: number; accent: number }): AdornmentPlan {
  const lipY = baseY - 0.3;    // vase lip
  const neckY = baseY - 0.22;  // narrow neck
  const bulgeY = baseY - 0.05; // widest body point
  const footY = baseY + 0.08;  // vase foot
  const lipW = 0.16;
  const neckW = 0.1;
  const bulgeW = 0.22;
  const footW = 0.14;

  // Vase silhouette — left side down, bottom, right side up, lip
  const cmds: DrawCmd[] = [
    { op: "M", x: -lipW, y: lipY },
    // Neck narrows
    { op: "C", c1x: -lipW, c1y: lipY + 0.03,
      c2x: -neckW, c2y: neckY - 0.02,
      x: -neckW, y: neckY },
    // Body bulges out
    { op: "C", c1x: -neckW * 1.1, c1y: neckY + (bulgeY - neckY) * 0.3,
      c2x: -bulgeW, c2y: bulgeY - (bulgeY - neckY) * 0.3,
      x: -bulgeW, y: bulgeY },
    // Taper to foot
    { op: "C", c1x: -bulgeW, c1y: bulgeY + (footY - bulgeY) * 0.5,
      c2x: -footW, c2y: footY - 0.02,
      x: -footW, y: footY },
    // Flat bottom
    { op: "L", x: footW, y: footY },
    // Right side up — foot to bulge
    { op: "C", c1x: footW, c1y: footY - 0.02,
      c2x: bulgeW, c2y: bulgeY + (footY - bulgeY) * 0.5,
      x: bulgeW, y: bulgeY },
    // Bulge to neck
    { op: "C", c1x: bulgeW, c1y: bulgeY - (bulgeY - neckY) * 0.3,
      c2x: neckW * 1.1, c2y: neckY + (bulgeY - neckY) * 0.3,
      x: neckW, y: neckY },
    // Neck to lip
    { op: "C", c1x: neckW, c1y: neckY - 0.02,
      c2x: lipW, c2y: lipY + 0.03,
      x: lipW, y: lipY },
    // Lip top edge
    { op: "C", c1x: lipW * 0.5, c1y: lipY - 0.015,
      c2x: -lipW * 0.5, c2y: lipY - 0.015,
      x: -lipW, y: lipY },
    { op: "Z" },
  ];

  // Rim highlight
  const rimH = 0.012;
  const accent: DrawCmd[] = [
    { op: "M", x: -lipW * 0.95, y: lipY },
    { op: "C", c1x: -lipW * 0.5, c1y: lipY - rimH,
      c2x: lipW * 0.5, c2y: lipY - rimH,
      x: lipW * 0.95, y: lipY },
    { op: "C", c1x: lipW * 0.5, c1y: lipY + rimH,
      c2x: -lipW * 0.5, c2y: lipY + rimH,
      x: -lipW * 0.95, y: lipY },
    { op: "Z" },
  ];

  // Foot base highlight
  const detail: DrawCmd[] = [
    { op: "M", x: -footW * 0.9, y: footY },
    { op: "L", x: footW * 0.9, y: footY },
    { op: "L", x: footW * 0.85, y: footY + 0.015 },
    { op: "L", x: -footW * 0.85, y: footY + 0.015 },
    { op: "Z" },
  ];

  const mainColor = colors?.main ?? VASE_COLOR;
  const rimColor = colors?.accent ?? VASE_RIM;

  return {
    cmds,
    color: mainColor,
    opacity: 0.8,
    accent: { cmds: accent, color: rimColor, opacity: 0.9 },
    detail: { cmds: detail, color: darkenColor(mainColor, 0.7), opacity: 0.7 },
  };
}

/** Pedestal/stand — Centerpiece+ level (20+ flowers). */
function generatePedestalAdornment(baseY: number, colors?: { main: number; accent: number }): AdornmentPlan {
  // Pedestal sits below a vase shape
  const topY = baseY + 0.06;   // top of pedestal (just under the vase foot)
  const midY = baseY + 0.18;   // column midsection
  const baseTopY = baseY + 0.22; // base platform top
  const botY = baseY + 0.26;   // very bottom
  const topW = 0.13;
  const colW = 0.08;
  const baseW = 0.2;

  // Pedestal — column on a wide base
  const cmds: DrawCmd[] = [
    // Top platform
    { op: "M", x: -topW, y: topY },
    { op: "L", x: topW, y: topY },
    { op: "L", x: topW, y: topY + 0.02 },
    // Column right side
    { op: "C", c1x: topW * 0.8, c1y: topY + 0.04,
      c2x: colW, c2y: midY - 0.02,
      x: colW, y: midY },
    // Flare to base
    { op: "C", c1x: colW, c1y: midY + 0.02,
      c2x: baseW * 0.7, c2y: baseTopY - 0.01,
      x: baseW, y: baseTopY },
    // Base bottom
    { op: "L", x: baseW, y: botY },
    { op: "L", x: -baseW, y: botY },
    { op: "L", x: -baseW, y: baseTopY },
    // Left flare up
    { op: "C", c1x: -baseW * 0.7, c1y: baseTopY - 0.01,
      c2x: -colW, c2y: midY + 0.02,
      x: -colW, y: midY },
    // Left column up
    { op: "C", c1x: -colW, c1y: midY - 0.02,
      c2x: -topW * 0.8, c2y: topY + 0.04,
      x: -topW, y: topY + 0.02 },
    { op: "L", x: -topW, y: topY },
    { op: "Z" },
  ];

  // Top platform edge highlight
  const accent: DrawCmd[] = [
    { op: "M", x: -topW * 0.95, y: topY },
    { op: "L", x: topW * 0.95, y: topY },
    { op: "L", x: topW * 0.95, y: topY + 0.012 },
    { op: "L", x: -topW * 0.95, y: topY + 0.012 },
    { op: "Z" },
  ];

  const mainColor = colors?.main ?? STAND_COLOR;
  const topColor = colors?.accent ?? STAND_TOP;

  return {
    cmds,
    color: mainColor,
    opacity: 0.85,
    accent: { cmds: accent, color: topColor, opacity: 0.9 },
  };
}

// ── Material modifiers ──
// Each material adjusts opacity and color feel for the container.

const MATERIAL_MODIFIERS: Record<string, { opacityMul: number; colorAdjust: (c: number) => number }> = {
  kraft:   { opacityMul: 0.75, colorAdjust: c => desaturate(warmShift(c), 0.3) },
  tissue:  { opacityMul: 0.45, colorAdjust: c => lightenColor(c, 0.25) },
  silk:    { opacityMul: 0.85, colorAdjust: c => c },
  ceramic: { opacityMul: 0.8,  colorAdjust: c => coolShift(desaturate(c, 0.4)) },
  glass:   { opacityMul: 0.35, colorAdjust: c => lightenColor(c, 0.3) },
  wicker:  { opacityMul: 0.8,  colorAdjust: c => warmShift(desaturate(c, 0.5)) },
  metal:   { opacityMul: 0.9,  colorAdjust: c => darkenColor(desaturate(c, 0.6), 0.5) },
};

/** Basket — wider than wrap, woven look. */
function generateBasketAdornment(baseY: number, colors?: { main: number; accent: number }): AdornmentPlan {
  const topY = baseY - 0.32;
  const botY = baseY + 0.06;
  const topW = 0.38;
  const botW = 0.18;
  const handleH = 0.12;

  // Basket body — wider, rounded bottom
  const cmds: DrawCmd[] = [
    { op: "M", x: -topW, y: topY },
    { op: "C", c1x: -topW * 0.95, c1y: topY + (botY - topY) * 0.3,
      c2x: -botW * 1.8, c2y: botY - (botY - topY) * 0.15,
      x: -botW, y: botY },
    { op: "C", c1x: -botW * 0.5, c1y: botY + 0.03,
      c2x: botW * 0.5, c2y: botY + 0.03,
      x: botW, y: botY },
    { op: "C", c1x: botW * 1.8, c1y: botY - (botY - topY) * 0.15,
      c2x: topW * 0.95, c2y: topY + (botY - topY) * 0.3,
      x: topW, y: topY },
    { op: "L", x: -topW, y: topY },
    { op: "Z" },
  ];

  // Handle arch
  const accent: DrawCmd[] = [
    { op: "M", x: -topW * 0.7, y: topY },
    { op: "C", c1x: -topW * 0.6, c1y: topY - handleH,
      c2x: topW * 0.6, c2y: topY - handleH,
      x: topW * 0.7, y: topY },
    { op: "C", c1x: topW * 0.55, c1y: topY - handleH + 0.025,
      c2x: -topW * 0.55, c2y: topY - handleH + 0.025,
      x: -topW * 0.7, y: topY },
    { op: "Z" },
  ];

  const mainColor = colors?.main ?? warmShift(WRAP_KRAFT);
  const accentColor = colors?.accent ?? darkenColor(mainColor, 0.6);

  return {
    cmds,
    color: mainColor,
    opacity: 0.8,
    accent: { cmds: accent, color: accentColor, opacity: 0.75 },
  };
}

/** Urn — wide mouth, heavy body, grand presence. */
function generateUrnAdornment(baseY: number, colors?: { main: number; accent: number }): AdornmentPlan {
  const lipY = baseY - 0.32;
  const neckY = baseY - 0.26;
  const bulgeY = baseY - 0.06;
  const footY = baseY + 0.1;
  const lipW = 0.22;
  const neckW = 0.14;
  const bulgeW = 0.28;
  const footW = 0.16;

  const cmds: DrawCmd[] = [
    { op: "M", x: -lipW, y: lipY },
    // Lip flare outward
    { op: "C", c1x: -lipW * 1.1, c1y: lipY + 0.02,
      c2x: -neckW * 0.9, c2y: neckY - 0.01,
      x: -neckW, y: neckY },
    // Body bulges wide
    { op: "C", c1x: -neckW * 1.2, c1y: neckY + (bulgeY - neckY) * 0.25,
      c2x: -bulgeW * 1.05, c2y: bulgeY - (bulgeY - neckY) * 0.25,
      x: -bulgeW, y: bulgeY },
    // Taper to foot
    { op: "C", c1x: -bulgeW, c1y: bulgeY + (footY - bulgeY) * 0.6,
      c2x: -footW * 1.1, c2y: footY - 0.02,
      x: -footW, y: footY },
    // Flat bottom
    { op: "L", x: footW, y: footY },
    // Right side — mirror
    { op: "C", c1x: footW * 1.1, c1y: footY - 0.02,
      c2x: bulgeW, c2y: bulgeY + (footY - bulgeY) * 0.6,
      x: bulgeW, y: bulgeY },
    { op: "C", c1x: bulgeW * 1.05, c1y: bulgeY - (bulgeY - neckY) * 0.25,
      c2x: neckW * 1.2, c2y: neckY + (bulgeY - neckY) * 0.25,
      x: neckW, y: neckY },
    { op: "C", c1x: neckW * 0.9, c1y: neckY - 0.01,
      c2x: lipW * 1.1, c2y: lipY + 0.02,
      x: lipW, y: lipY },
    // Lip top
    { op: "C", c1x: lipW * 0.6, c1y: lipY - 0.018,
      c2x: -lipW * 0.6, c2y: lipY - 0.018,
      x: -lipW, y: lipY },
    { op: "Z" },
  ];

  // Wide rim
  const rimH = 0.015;
  const accent: DrawCmd[] = [
    { op: "M", x: -lipW * 0.95, y: lipY },
    { op: "C", c1x: -lipW * 0.5, c1y: lipY - rimH,
      c2x: lipW * 0.5, c2y: lipY - rimH,
      x: lipW * 0.95, y: lipY },
    { op: "C", c1x: lipW * 0.5, c1y: lipY + rimH,
      c2x: -lipW * 0.5, c2y: lipY + rimH,
      x: -lipW * 0.95, y: lipY },
    { op: "Z" },
  ];

  // Foot ring
  const detail: DrawCmd[] = [
    { op: "M", x: -footW * 0.9, y: footY },
    { op: "L", x: footW * 0.9, y: footY },
    { op: "L", x: footW * 0.85, y: footY + 0.018 },
    { op: "L", x: -footW * 0.85, y: footY + 0.018 },
    { op: "Z" },
  ];

  const mainColor = colors?.main ?? coolShift(VASE_COLOR);
  const rimColor = colors?.accent ?? lightenColor(mainColor, 0.15);

  return {
    cmds,
    color: mainColor,
    opacity: 0.85,
    accent: { cmds: accent, color: rimColor, opacity: 0.9 },
    detail: { cmds: detail, color: darkenColor(mainColor, 0.65), opacity: 0.7 },
  };
}

/** Parse a CSS hex color string to a number. */
function parseHexColor(hex: string): number | null {
  const clean = hex.replace(/^#/, "");
  const parsed = parseInt(clean, 16);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Extract adornment colors from arrangement metadata. */
function extractAdornmentColors(
  meta: ArrangementMeta | undefined,
): { main: number; accent: number } | undefined {
  if (!meta) return undefined;

  // Phase 2: structured spec colors take priority
  if (meta.adornment_spec) {
    const spec = meta.adornment_spec;
    if (spec.container?.color && spec.accent?.color) {
      const rawMain = rgbToNumber(spec.container.color);
      const materialMod = MATERIAL_MODIFIERS[spec.container.material];
      const main = materialMod ? materialMod.colorAdjust(rawMain) : rawMain;
      const accent = rgbToNumber(spec.accent.color);
      return { main, accent };
    }
  }

  // Phase 1 fallback: sprite_hints colors
  if (meta.sprite_hints?.dominant_color) {
    const main = parseHexColor(meta.sprite_hints.dominant_color);
    if (main === null) return undefined;
    const accent = meta.sprite_hints.secondary_color
      ? (parseHexColor(meta.sprite_hints.secondary_color) ?? lightenColor(main, 0.15))
      : lightenColor(main, 0.15);
    return { main, accent };
  }

  return undefined;
}

/** Resolve material opacity multiplier from an AdornmentSpec. */
function resolveOpacityMul(spec: AdornmentSpec | undefined): number {
  if (!spec) return 1;
  return MATERIAL_MODIFIERS[spec.container.material]?.opacityMul ?? 1;
}

/** Apply material opacity to an adornment plan. */
function applyMaterialOpacity(plan: AdornmentPlan, opacityMul: number): AdornmentPlan {
  if (opacityMul === 1) return plan;
  return {
    ...plan,
    opacity: plan.opacity * opacityMul,
    accent: plan.accent ? { ...plan.accent, opacity: plan.accent.opacity * opacityMul } : undefined,
    detail: plan.detail ? { ...plan.detail, opacity: plan.detail.opacity * opacityMul } : undefined,
  };
}

type AdornmentGenerator = (baseY: number, colors?: { main: number; accent: number }) => AdornmentPlan;

const CONTAINER_GENERATORS: Record<AdornmentSpec["container"]["type"], AdornmentGenerator> = {
  tie: generateTieAdornment,
  wrap: generateWrapAdornment,
  basket: generateBasketAdornment,
  vase: generateVaseAdornment,
  urn: generateUrnAdornment,
};

/** Route to the correct shape generator based on AdornmentSpec container type. */
function generateAdornmentFromSpec(baseY: number, spec: AdornmentSpec): AdornmentPlan {
  const colors = extractAdornmentColors({ adornment_spec: spec });
  const opacityMul = resolveOpacityMul(spec);

  const gen = CONTAINER_GENERATORS[spec.container.type] ?? generateVaseAdornment;
  const plan = gen(baseY, colors);

  // Layer on a base if specified
  if (spec.base && spec.base.type !== "none" && spec.base.color) {
    const baseColor = rgbToNumber(spec.base.color);
    const baseColors = { main: baseColor, accent: lightenColor(baseColor, 0.1) };
    const basePlan = generatePedestalAdornment(baseY, baseColors);
    return applyMaterialOpacity({
      cmds: basePlan.cmds,
      color: basePlan.color,
      opacity: basePlan.opacity,
      accent: { cmds: plan.cmds, color: plan.color, opacity: plan.opacity },
      detail: plan.accent,
    }, opacityMul);
  }

  return applyMaterialOpacity(plan, opacityMul);
}

/** Pick the right adornment for an arrangement level. */
function adornmentForLevel(level: number, baseY: number, colors?: { main: number; accent: number }): AdornmentPlan | null {
  if (level <= 1) return null;                                      // single stem — no adornment
  if (level <= 2) return generateTieAdornment(baseY, colors);       // group (2-3)
  if (level <= 3) return generateWrapAdornment(baseY, colors);      // bunch (4-6)
  if (level <= 5) return generateVaseAdornment(baseY, colors);      // arrangement/bouquet (7-19)
  // centerpiece/installation (20+) — vase on a pedestal
  const vase = generateVaseAdornment(baseY, colors);
  const pedestal = generatePedestalAdornment(baseY, colors);
  return {
    cmds: pedestal.cmds,
    color: pedestal.color,
    opacity: pedestal.opacity,
    accent: { cmds: vase.cmds, color: vase.color, opacity: vase.opacity },
    detail: vase.accent,
  };
}

/** Create a complete arrangement plan from constituent flower specs. */
export function createArrangementPlan(
  constituents: ReadonlyArray<{ specJson: string; sid: number }>,
  level: number,
  meta?: ArrangementMeta,
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
    const stemStyle = stemData?.style ?? "Straight";
    const stemCmds = generateStem(
      0, baseY,
      tipX, tipY,
      stemCurvature,
      stemHalfW,
      stemColor,
      stemStyle,
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

  // Phase 2: if AI provided a structured spec, use it directly
  // Phase 1: extract colors from meta and pass to level-gated generator
  const adornment = meta?.adornment_spec
    ? generateAdornmentFromSpec(baseY, meta.adornment_spec)
    : adornmentForLevel(level, baseY, extractAdornmentColors(meta));

  return { members, baseY, adornment };
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
