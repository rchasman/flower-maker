/**
 * The garden bed every plant stands in, seen at three quarters: soil that
 * fades into the black of the canvas far away and comes up warm and close at the bottom
 * of the canvas, strewn with pebbles and tufts that shrink with distance.
 */

import { FillGradient, Graphics } from "pixi.js";
import { sidHash } from "../flower/util.ts";

export type Bed = { left: number; top: number; right: number; bottom: number };

/** The bed starts this far down the canvas: the soil above it is the far distance, too far to plant. */
export const BED_TOP = 0.34;

/** Far soil, the soil where planting starts, and the nearest soil. */
const SOIL_FAR = 0x000000;
const SOIL_TOP = 0x17120e;
const SOIL_NEAR = 0x2a2119;
const PEBBLE = 0x4a4038;
const TUFT = 0x2f4a2a;
/** the soil starts this far above the bed, as a share of the canvas height: the distance fading in */
const HORIZON = 0.16;
const PEBBLES = 140;
const TUFTS = 36;

/** How much nearer plants are drawn than far ones: a plant's scale at the far and near edges of the bed. */
const DEPTH_SCALE = [0.8, 1.06] as const;

/** The scale a plant standing at canvas y is drawn at: smaller toward the back of the bed. */
export function depthScale(bed: Bed, y: number): number {
  const t = Math.max(0, Math.min(1, (y - bed.top) / (bed.bottom - bed.top)));
  return DEPTH_SCALE[0] + (DEPTH_SCALE[1] - DEPTH_SCALE[0]) * t;
}

/** Draw the bed into `g` for a canvas w by h px. */
export function drawBed(g: Graphics, bed: Bed, w: number, h: number): void {
  g.clear();
  const horizon = Math.max(0, bed.top - h * HORIZON);
  const span = h - horizon;
  g.rect(0, horizon, w, span);
  g.fill(
    new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: SOIL_FAR },
        { offset: (bed.top - horizon) / span, color: SOIL_TOP },
        { offset: 1, color: SOIL_NEAR },
      ],
      textureSpace: "local",
    }),
  );

  // Strewn detail: denser and smaller toward the back, where the bed recedes
  const scatter = (count: number, salt: number) =>
    Array.from({ length: count }, (_, i) => {
      const depth = Math.sqrt(sidHash(salt, i));
      return {
        x: sidHash(salt, 1000 + i) * w,
        y: horizon + depth * span,
        size: 0.35 + depth * 0.9,
        shade: sidHash(salt, 2000 + i),
      };
    });

  for (const p of scatter(PEBBLES, 17)) {
    g.ellipse(p.x, p.y, 2.2 * p.size, 1 * p.size);
    g.fill({ color: PEBBLE, alpha: 0.12 + 0.2 * p.shade * p.size });
  }

  for (const t of scatter(TUFTS, 29)) {
    const height = 5 + 7 * t.size;
    const blades = [-0.5, 0, 0.45];
    for (const lean of blades) {
      g.moveTo(t.x - 0.8 * t.size, t.y);
      g.quadraticCurveTo(
        t.x + lean * height * 0.3,
        t.y - height * 0.55,
        t.x + lean * height,
        t.y - height,
      );
      g.quadraticCurveTo(
        t.x + lean * height * 0.3 + 0.8 * t.size,
        t.y - height * 0.5,
        t.x + 0.8 * t.size,
        t.y,
      );
      g.fill({ color: TUFT, alpha: 0.35 + 0.35 * t.shade });
    }
  }
}
