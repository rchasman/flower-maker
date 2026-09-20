/** Packed-int color helpers shared by the plan builders and the Pixi drawers. */

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

export function lightenColor(color: number, amount: number): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) + 255 * amount));
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) + 255 * amount));
  const b = Math.min(255, Math.floor((color & 0xff) + 255 * amount));
  return (r << 16) | (g << 8) | b;
}

/** Linearly interpolate between two packed-int colors. t=0 → a, t=1 → b. */
export function lerpColor(a: number, b: number, t: number): number {
  const t1 = Math.max(0, Math.min(1, t));
  const r = Math.round(((a >> 16) & 0xff) * (1 - t1) + ((b >> 16) & 0xff) * t1);
  const g = Math.round(((a >> 8) & 0xff) * (1 - t1) + ((b >> 8) & 0xff) * t1);
  const bl = Math.round((a & 0xff) * (1 - t1) + (b & 0xff) * t1);
  return (r << 16) | (g << 8) | bl;
}

/** Blend a color toward its luminance gray; 0 leaves it unchanged, 1 is gray. */
export function desaturate(color: number, amount: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const lum = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
  const nr = Math.round(r + (lum - r) * amount);
  const ng = Math.round(g + (lum - g) * amount);
  const nb = Math.round(b + (lum - b) * amount);
  return (nr << 16) | (ng << 8) | nb;
}

type Hsl = { h: number; s: number; l: number };

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const sector = hueSector(r, g, b, max, d);
  return { h: (((sector * 60) % 360) + 360) % 360, s, l };
}

function hueSector(
  r: number,
  g: number,
  b: number,
  max: number,
  d: number,
): number {
  if (max === r) return (g - b) / d;
  if (max === g) return (b - r) / d + 2;
  return (r - g) / d + 4;
}

/** Hue in [0, 360) with chroma c and second-largest component x, as (r, g, b) before the lightness offset. */
function hslChannels(
  h: number,
  c: number,
  x: number,
): [number, number, number] {
  if (h < 60) return [c, x, 0];
  if (h < 120) return [x, c, 0];
  if (h < 180) return [0, c, x];
  if (h < 240) return [0, x, c];
  if (h < 300) return [x, 0, c];
  return [c, 0, x];
}

function hslToRgb({ h, s, l }: Hsl): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = hslChannels(h, c, x);
  return colorFromSpec(r + m, g + m, b + m);
}

/** Rotate a color's hue by `degrees`; a whole turn or a gray returns the color unchanged. */
export function hueRotate(color: number, degrees: number): number {
  const turn = ((degrees % 360) + 360) % 360;
  if (turn === 0) return color;
  const hsl = rgbToHsl(
    ((color >> 16) & 0xff) / 255,
    ((color >> 8) & 0xff) / 255,
    (color & 0xff) / 255,
  );
  if (hsl.s === 0) return color;
  return hslToRgb({ ...hsl, h: (hsl.h + turn) % 360 });
}
