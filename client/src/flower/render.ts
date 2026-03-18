/** Shared flower rendering math — single source of truth for FlowerCanvas (PixiJS) and FlowerGrid (SVG). */

/** Deterministic hash from sid — yields a float in [0, 1). */
export function sidHash(sid: number, salt: number): number {
  const n = Math.sin(sid * 9301 + salt * 4973) * 49297;
  return n - Math.floor(n);
}

/** Flower shape parameters — uses spec petal_count, sid-hash for proportions. */
export function flowerShape(sid: number, specPetalCount: number) {
  const petalCount = specPetalCount > 0 ? specPetalCount : 5 + Math.floor(sidHash(sid, 1) * 3);
  const petalLength = 0.75 + sidHash(sid, 2) * 0.35;
  const petalWidth = 0.28 + sidHash(sid, 3) * 0.18;
  const petalTaper = 0.6 + sidHash(sid, 4) * 0.3;
  const rotationOffset = sidHash(sid, 5) * Math.PI * 2;
  return { petalCount, petalLength, petalWidth, petalTaper, rotationOffset };
}

const HUES = [0xff6b9d, 0xc084fc, 0x67e8f9, 0xfbbf24, 0x4ade80, 0xf87171, 0xa78bfa, 0x38bdf8];

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

/** Convert a hex color number to a CSS hex string. */
export function hexString(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** Extract petal color + count from specJson, matching WASM's primary_petal_color logic. */
export function parseSpecVisuals(specJson: string | undefined): { color: number | null; petalCount: number } {
  if (!specJson) return { color: null, petalCount: 0 };
  try {
    const spec = JSON.parse(specJson) as {
      petals?: {
        layers?: Array<{
          count?: number;
          color?: { stops?: Array<{ color?: { r?: number; g?: number; b?: number } }> };
        }>;
      };
    };
    const layer = spec.petals?.layers?.[0];
    const stop = layer?.color?.stops?.[0]?.color;
    const petalCount = layer?.count ?? 0;
    if (stop && (stop.r ?? 0) + (stop.g ?? 0) + (stop.b ?? 0) > 0.05) {
      return { color: colorFromSpec(stop.r ?? 0, stop.g ?? 0, stop.b ?? 0), petalCount };
    }
    return { color: null, petalCount };
  } catch {
    return { color: null, petalCount: 0 };
  }
}

/** Resolve flower color from specJson — real spec color or sid-based fallback. */
export function resolveFlowerColor(sid: number, specJson: string | undefined): number {
  const visuals = parseSpecVisuals(specJson);
  return visuals.color ?? fallbackColor(sid);
}

/** Resolve petal count from specJson — real spec count or sid-based fallback. */
export function resolveFlowerPetalCount(sid: number, specJson: string | undefined): number {
  const visuals = parseSpecVisuals(specJson);
  return visuals.petalCount > 0 ? visuals.petalCount : 5 + Math.floor(sidHash(sid, 1) * 3);
}
