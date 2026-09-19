/**
 * Shared PixiJS drawing functions for flowers and arrangements.
 *
 * Used by both the interactive designer canvas (FlowerCanvas) and the
 * read-only grid previews (MiniCanvas) so they produce identical visuals.
 */

import { FillGradient, Graphics } from "pixi.js";
import type { BioPattern } from "../data/flower-enums.ts";
import { darkenColor, lightenColor } from "./color.ts";
import type { NectaryPlan, ParticleSeed } from "./effects.ts";
import type { DrawCmd } from "./geometry.ts";
import type { BudPlan, SeedHeadPlan } from "./lifeStage.ts";
import type {
  ArrangementPlan,
  CorollaPlan,
  FlowerPlan,
  LayerPlan,
  LeafPlan,
  PetalPlan,
} from "./render.ts";
import type { StemPlan } from "./stem.ts";
import { GOLDEN_ANGLE, LIGHT_ANGLE, unreachable } from "./util.ts";

// ── Low-level path helper ──

/** Execute DrawCmd[] on a PixiJS Graphics context, scaled around (ox, oy). */
function drawCmds(
  g: Graphics,
  cmds: readonly DrawCmd[],
  scale: number,
  ox = 0,
  oy = 0,
): void {
  for (const cmd of cmds) {
    switch (cmd.op) {
      case "M":
        g.moveTo(cmd.x * scale + ox, cmd.y * scale + oy);
        break;
      case "L":
        g.lineTo(cmd.x * scale + ox, cmd.y * scale + oy);
        break;
      case "C":
        g.bezierCurveTo(
          cmd.c1x * scale + ox,
          cmd.c1y * scale + oy,
          cmd.c2x * scale + ox,
          cmd.c2y * scale + oy,
          cmd.x * scale + ox,
          cmd.y * scale + oy,
        );
        break;
      case "Z":
        g.closePath();
        break;
    }
  }
}

// ── Part-level helpers ──

const LIGHT_COS = Math.cos(LIGHT_ANGLE);
const LIGHT_SIN = Math.sin(LIGHT_ANGLE);

/** Per-draw placement shared by every petal pass of one head. */
type PetalPass = {
  scale: number;
  alpha: number;
  opacity: number;
  lightOffsetX: number;
  lightOffsetY: number;
  shadowOffX: number;
  shadowOffY: number;
};

/** One petal or corolla lobe: fill, gradient stops, light, shadow, texture, marks, veins, outline. */
function drawPetal(
  g: Graphics,
  petal: PetalPlan,
  petalIdx: number,
  pass: PetalPass,
): void {
  const { scale, alpha, opacity, lightOffsetX, lightOffsetY } = pass;

  // Intra-layer depth: each petal casts a subtle shadow on the one behind it
  if (petalIdx > 0) {
    drawCmds(
      g,
      petal.cmds,
      scale * 1.01,
      pass.shadowOffX * 0.5,
      pass.shadowOffY * 0.5,
    );
    g.fill({ color: 0x000000, alpha: alpha * 0.04 });
  }

  drawCmds(g, petal.cmds, scale);
  g.fill({ color: petal.color, alpha: alpha * opacity });

  for (let si = 1; si < petal.gradientStops.length; si++) {
    const stop = petal.gradientStops[si]!;
    if (stop.cmds.length === 0) continue;
    const stopAlpha = alpha * opacity * (0.65 - (si - 1) * 0.1);
    drawCmds(g, stop.cmds, scale);
    g.fill({ color: stop.blendedColor, alpha: Math.max(0.15, stopAlpha) });
  }

  drawCmds(g, petal.cmds, scale, lightOffsetX, lightOffsetY);
  g.fill({ color: petal.lightColor, alpha: alpha * opacity * 0.18 });

  drawCmds(g, petal.cmds, scale, -lightOffsetX * 0.7, -lightOffsetY * 0.7);
  g.fill({ color: petal.shadowColor, alpha: alpha * opacity * 0.1 });

  drawCmds(g, petal.cmds, scale);
  g.fill({ color: petal.highlightColor, alpha: alpha * 0.15 });

  // Texture pass — material-specific visual treatment
  switch (petal.texture) {
    case "Velvet": {
      // Edge darkening — thick inner stroke for soft absorbed-light look
      drawCmds(g, petal.cmds, scale);
      g.stroke({
        color: petal.textureEdge,
        width: Math.max(1.5, scale * 0.025),
        alpha: alpha * 0.2,
      });
      break;
    }
    case "Silk": {
      // Bright specular band — thin highlight stripe across petal center
      drawCmds(g, petal.cmds, scale, lightOffsetX * 2, lightOffsetY * 2);
      g.fill({ color: petal.textureHighlight, alpha: alpha * 0.12 });
      break;
    }
    case "Waxy": {
      // Sharp specular — bright highlight near petal base
      drawCmds(g, petal.cmds, scale, lightOffsetX * 1.5, lightOffsetY * 1.5);
      g.fill({ color: petal.textureHighlight, alpha: alpha * 0.15 });
      break;
    }
    case "Metallic": {
      // Color-shift: warm/cool offset fills for metallic sheen
      drawCmds(g, petal.cmds, scale, lightOffsetX, lightOffsetY);
      g.fill({ color: petal.textureHighlight, alpha: alpha * 0.2 });
      drawCmds(g, petal.cmds, scale, -lightOffsetX, -lightOffsetY);
      g.fill({ color: petal.textureEdge, alpha: alpha * 0.12 });
      break;
    }
    case "Papery": {
      // Desaturated overlay — muted, translucent look
      drawCmds(g, petal.cmds, scale);
      g.fill({ color: petal.textureHighlight, alpha: alpha * 0.08 });
      break;
    }
    case "Glassy":
    case "Crystalline": {
      // Sharp specular point — bright white highlight
      drawCmds(g, petal.cmds, scale, lightOffsetX * 2.5, lightOffsetY * 2.5);
      g.fill({ color: 0xffffff, alpha: alpha * 0.18 });
      break;
    }
    case "Pearlescent": {
      // Warm and cool offset fills for rainbow sheen
      drawCmds(g, petal.cmds, scale, lightOffsetX * 0.8, lightOffsetY * 0.8);
      g.fill({ color: petal.textureHighlight, alpha: alpha * 0.1 });
      drawCmds(g, petal.cmds, scale, -lightOffsetX * 0.5, -lightOffsetY * 0.5);
      g.fill({ color: petal.textureEdge, alpha: alpha * 0.08 });
      break;
    }
    case "Frosted": {
      // White edge frost
      drawCmds(g, petal.cmds, scale);
      g.stroke({
        color: 0xffffff,
        width: Math.max(1, scale * 0.02),
        alpha: alpha * 0.15,
      });
      break;
    }
    // Matte textures get no extra pass
    case "Smooth":
    case "Rough":
    case "Hairy":
    case "Fuzzy":
    case "Scaled":
    case "Leathery":
    case "Powdery":
      break;
    default:
      unreachable(petal.texture);
  }

  // Iridescence: a hue-shifted sheen toward the light and its complement away from it
  if (petal.iridescence) {
    const { color, complement, intensity } = petal.iridescence;
    drawCmds(g, petal.cmds, scale, lightOffsetX * 0.8, lightOffsetY * 0.8);
    g.fill({ color, alpha: alpha * intensity * 0.25 });
    drawCmds(g, petal.cmds, scale, -lightOffsetX * 0.5, -lightOffsetY * 0.5);
    g.fill({ color: complement, alpha: alpha * intensity * 0.12 });
  }

  for (const mark of petal.marks) {
    drawCmds(g, mark.cmds, scale);
    g.fill({ color: mark.color, alpha: alpha * opacity * mark.alpha });
  }

  if (petal.veinCmds.length > 0) {
    drawCmds(g, petal.veinCmds, scale);
    g.stroke({
      color: petal.midribGlowColor,
      width: Math.max(0.8, scale * 0.018),
      alpha: alpha * 0.12,
    });

    drawCmds(g, petal.veinCmds, scale);
    g.stroke({
      color: petal.veinColor,
      width: Math.max(0.3, scale * 0.008),
      alpha: alpha * 0.25,
    });
  }

  drawCmds(g, petal.cmds, scale);
  g.stroke({
    color: petal.outlineColor,
    width: Math.max(0.3, scale * 0.006),
    alpha: alpha * opacity * 0.4,
  });
}

/**
 * Gradient textures are GPU resources, so one is built per corolla plan and
 * reused across redraws; the plan object is the cache key and the entry goes
 * with it.
 */
const corollaGradients = new WeakMap<CorollaPlan, FillGradient>();

/** Radial gradient from the throat to the rim opening, in the body's local (bounding box) space. */
function corollaGradient(corolla: CorollaPlan): FillGradient {
  const cached = corollaGradients.get(corolla);
  if (cached) return cached;
  const gradient = new FillGradient({
    type: "radial",
    center: { x: 0.5, y: 0.5 },
    innerRadius: (0.5 * corolla.throat.radius) / corolla.bodyRadius,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: (0.5 * corolla.rimRadius) / corolla.bodyRadius,
    colorStops: [
      { offset: 0, color: corolla.throat.innerColor },
      { offset: 1, color: corolla.throat.rimColor },
    ],
    textureSpace: "local",
  });
  corollaGradients.set(corolla, gradient);
  return gradient;
}

/** The fused cup: base fill, throat-to-rim gradient, outline. Lobes and throat disc are drawn after. */
function drawCorollaBody(
  g: Graphics,
  corolla: CorollaPlan,
  pass: PetalPass,
): void {
  const { scale, alpha, opacity } = pass;
  drawCmds(g, corolla.body, scale);
  g.fill({ color: corolla.color, alpha: alpha * opacity });
  drawCmds(g, corolla.body, scale);
  g.fill({ fill: corollaGradient(corolla), alpha: alpha * opacity * 0.9 });
  drawCmds(g, corolla.body, scale);
  g.stroke({
    color: darkenColor(corolla.color, 0.55),
    width: Math.max(0.3, scale * 0.006),
    alpha: alpha * opacity * 0.4,
  });
}

function drawThroat(g: Graphics, corolla: CorollaPlan, pass: PetalPass): void {
  const { scale, alpha, opacity } = pass;
  g.circle(0, 0, corolla.throat.radius * scale);
  g.fill({ color: corolla.throat.innerColor, alpha: alpha * opacity * 0.9 });
}

/** Every outline a layer draws, for the depth shadow it casts on the layer below. */
const layerOutlines = (layer: LayerPlan): DrawCmd[][] => [
  ...(layer.corolla ? [layer.corolla.body] : []),
  ...layer.petals.map(petal => petal.cmds),
  ...(layer.corolla?.lobes.map(lobe => lobe.cmds) ?? []),
];

/** Draw petal layers with 7-pass rendering per petal; a fused layer draws its corolla body, lobes and throat. */
function drawPetals(
  g: Graphics,
  layers: readonly LayerPlan[],
  scale: number,
  alpha: number,
) {
  const lightOffsetX = LIGHT_COS * scale * 0.012;
  const lightOffsetY = LIGHT_SIN * scale * 0.012;
  const shadowOffX = -lightOffsetX * 1.5;
  const shadowOffY = -lightOffsetY * 1.5;

  for (const [layerIdx, layer] of layers.entries()) {
    const pass: PetalPass = {
      scale,
      alpha,
      opacity: layer.opacity,
      lightOffsetX,
      lightOffsetY,
      shadowOffX,
      shadowOffY,
    };

    // Pass 1: petal overlap depth shadows (inner layers cast onto outer)
    if (layerIdx > 0) {
      for (const cmds of layerOutlines(layer)) {
        drawCmds(g, cmds, scale * 1.02, shadowOffX, shadowOffY);
        g.fill({ color: 0x000000, alpha: alpha * 0.06 });
      }
    }

    // Pass 2: normal petal rendering (with intra-layer overlap shadows)
    if (layer.corolla) drawCorollaBody(g, layer.corolla, pass);
    for (const [petalIdx, petal] of layer.petals.entries()) {
      drawPetal(g, petal, petalIdx, pass);
    }
    if (layer.corolla) {
      for (const [lobeIdx, lobe] of layer.corolla.lobes.entries()) {
        drawPetal(g, lobe, lobeIdx, pass);
      }
      drawThroat(g, layer.corolla, pass);
    }
  }
}

/** Draw stamens with curved filaments and anther highlights. */
function drawStamens(
  g: Graphics,
  stamens: FlowerPlan["center"]["stamens"],
  scale: number,
  alpha: number,
) {
  for (const [i, s] of stamens.entries()) {
    const sx = Math.cos(s.angle) * s.length * scale;
    const sy = Math.sin(s.angle) * s.length * scale;
    const midX = sx * 0.5;
    const midY = sy * 0.5;
    const perpX = -sy * 0.12;
    const perpY = sx * 0.12;
    const bendDir = i % 2 === 0 ? 1 : -1;

    g.moveTo(0, 0);
    g.bezierCurveTo(
      midX + perpX * bendDir,
      midY + perpY * bendDir,
      midX + perpX * bendDir * 0.5,
      midY + perpY * bendDir * 0.5,
      sx,
      sy,
    );
    g.stroke({
      color: s.filamentColor,
      width: Math.max(0.4, scale * 0.022),
      alpha: alpha * 0.75,
    });

    const ar = s.antherRadius * scale;
    g.circle(sx, sy, ar);
    g.fill({ color: s.antherColor, alpha });
    g.circle(sx, sy, ar);
    g.stroke({
      color: darkenColor(s.antherColor, 0.5),
      width: Math.max(0.2, scale * 0.004),
      alpha: alpha * 0.4,
    });
    g.circle(sx - ar * 0.25, sy - ar * 0.25, ar * 0.35);
    g.fill({ color: 0xffffff, alpha: alpha * 0.25 });
  }
}

/** The nectary's static glow and marks, under the pistil. */
function drawNectary(
  g: Graphics,
  nectary: NectaryPlan,
  scale: number,
  alpha: number,
): void {
  const intensity = nectary.glow?.intensity ?? 0.5;
  if (nectary.fills.length > 0) {
    drawCmds(g, nectary.fills, scale);
    g.fill({ color: nectary.color, alpha: alpha * (0.2 + intensity * 0.3) });
  }
  if (nectary.strokes.length > 0) {
    drawCmds(g, nectary.strokes, scale);
    g.stroke({
      color: nectary.color,
      width: Math.max(0.5, nectary.strokeWidth * scale),
      alpha: alpha * (0.3 + intensity * 0.4),
    });
  }
}

/** The seed head's dense stipple, then its pappus hairs and anthers or its seed marks. */
function drawSeedHead(
  g: Graphics,
  seedHead: SeedHeadPlan,
  scale: number,
  alpha: number,
): void {
  drawCmds(g, seedHead.stipple, scale);
  g.fill({ color: seedHead.stippleColor, alpha: alpha * 0.7 });
  if (seedHead.strokes.length > 0) {
    drawCmds(g, seedHead.strokes, scale);
    g.stroke({
      color: seedHead.strokeColor,
      width: Math.max(0.4, seedHead.strokeWidth * scale),
      alpha: alpha * 0.8,
    });
  }
  drawCmds(g, seedHead.fills, scale);
  g.fill({ color: seedHead.fillColor, alpha: alpha * 0.9 });
}

/** Draw center disc with outline, radial depth, stippling, seed head and pistil highlight. */
function drawCenterDisc(
  g: Graphics,
  center: FlowerPlan["center"],
  scale: number,
  alpha: number,
) {
  const discR = center.discRadius * scale;
  const discColor = center.discColor;

  if (center.nectary) drawNectary(g, center.nectary, scale, alpha);
  if (discR <= 0) return;

  g.circle(0, 0, discR);
  g.fill({ color: discColor, alpha });
  g.circle(0, 0, discR);
  g.stroke({
    color: darkenColor(discColor, 0.45),
    width: Math.max(0.3, scale * 0.006),
    alpha: alpha * 0.4,
  });

  g.circle(0, 0, discR * 0.75);
  g.fill({ color: lightenColor(discColor, 0.08), alpha: alpha * 0.3 });
  g.circle(0, 0, discR * 0.5);
  g.fill({ color: lightenColor(discColor, 0.15), alpha: alpha * 0.25 });

  const stippleCount = Math.max(5, Math.min(16, Math.round(discR * 4)));
  for (let i = 0; i < stippleCount; i++) {
    const t = (i + 1) / (stippleCount + 1);
    const r2 = discR * t * 0.85;
    const theta = i * GOLDEN_ANGLE;
    const dotX = Math.cos(theta) * r2;
    const dotY = Math.sin(theta) * r2;
    const dotR = Math.max(0.3, scale * 0.008 * (1 - t * 0.4));
    const dotColor =
      i % 2 === 0 ? darkenColor(discColor, 0.6) : lightenColor(discColor, 0.1);
    g.circle(dotX, dotY, dotR);
    g.fill({ color: dotColor, alpha: alpha * (0.35 + t * 0.2) });
  }

  if (center.seedHead) drawSeedHead(g, center.seedHead, scale, alpha);

  const hlR = center.highlightRadius * scale;
  if (hlR > 0) {
    g.circle(discR * 0.08, -discR * 0.12, hlR);
    g.fill({ color: center.highlightColor, alpha: alpha * 0.55 });
  }
}

/** Draw aura on a SEPARATE Graphics to avoid rectangular bounding-box artifacts. */
export function drawAura(
  g: Graphics,
  plan: FlowerPlan,
  r: number,
  alpha: number,
) {
  if (!plan.aura) return;
  const scale = r;
  const now = performance.now();
  const auraR = plan.aura.radius * scale * 2.5;
  const pulse = 0.85 + 0.15 * Math.sin(now / 800);
  const auraAlpha = alpha * plan.aura.opacity * pulse;

  switch (plan.aura.kind) {
    case "Prismatic":
    case "Rainbow": {
      for (const [i, f] of [0.6, 0.8, 1.0].entries()) {
        const hueShift = [0xff6b9d, 0x67e8f9, 0xc084fc][i]!;
        g.circle(0, 0, auraR * f);
        g.fill({ color: hueShift, alpha: auraAlpha * 0.3 });
      }
      break;
    }
    case "Crystal": {
      const sides = 6;
      for (let i = 0; i < sides; i++) {
        const a1 = (i / sides) * Math.PI * 2 + now / 3000;
        const a2 = ((i + 1) / sides) * Math.PI * 2 + now / 3000;
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a1) * auraR, Math.sin(a1) * auraR);
        g.lineTo(Math.cos(a2) * auraR, Math.sin(a2) * auraR);
        g.fill({
          color: plan.aura!.color,
          alpha: auraAlpha * (0.3 + 0.1 * Math.sin(now / 400 + i)),
        });
      }
      break;
    }
    case "Flame":
    case "Solar": {
      const flicker = 0.7 + 0.3 * Math.sin(now / 150);
      g.circle(0, 0, auraR * flicker);
      g.fill({ color: plan.aura.color, alpha: auraAlpha * 0.5 });
      g.circle(0, 0, auraR * 0.6 * flicker);
      g.fill({ color: 0xfbbf24, alpha: auraAlpha * 0.3 });
      break;
    }
    case "Frost": {
      g.circle(0, 0, auraR);
      g.fill({ color: 0xbfdbfe, alpha: auraAlpha * 0.4 });
      g.circle(0, 0, auraR * 0.7);
      g.fill({ color: plan.aura.color, alpha: auraAlpha * 0.25 });
      break;
    }
    case "Aurora":
    case "Nebula": {
      const shift = Math.sin(now / 1200) * 0.3;
      g.circle(shift * scale * 0.3, 0, auraR * 1.1);
      g.fill({ color: plan.aura.color, alpha: auraAlpha * 0.25 });
      g.circle(-shift * scale * 0.3, 0, auraR * 0.8);
      g.fill({ color: 0x67e8f9, alpha: auraAlpha * 0.2 });
      break;
    }
    case "Shadow":
    case "Void": {
      g.circle(0, 0, auraR * 0.9);
      g.fill({ color: 0x1a1a2e, alpha: auraAlpha * 0.5 });
      break;
    }
    case "Electric":
    case "Storm": {
      const jitter = Math.sin(now / 80) * scale * 0.05;
      g.circle(jitter, -jitter, auraR * 0.85);
      g.fill({ color: plan.aura.color, alpha: auraAlpha * 0.35 });
      break;
    }
    case "Mist":
    case "Sparkle":
    case "Ethereal":
    case "Moonlight": {
      g.circle(0, 0, auraR);
      g.fill({ color: plan.aura.color, alpha: auraAlpha * 0.35 });
      g.circle(0, 0, auraR * 0.6);
      g.fill({ color: plan.aura.color, alpha: auraAlpha * 0.2 });
      break;
    }
    default:
      unreachable(plan.aura.kind);
  }
}

// ── Full flower / arrangement drawing ──

/** A stem, pedicel or branch outline with its darker edge. */
function drawStalk(
  g: Graphics,
  cmds: readonly DrawCmd[],
  color: number,
  scale: number,
  alpha: number,
): void {
  drawCmds(g, cmds, scale);
  g.fill({ color, alpha: alpha * 0.9 });
  drawCmds(g, cmds, scale);
  g.stroke({
    color: darkenColor(color, 0.5),
    width: Math.max(0.4, scale * 0.008),
    alpha: alpha * 0.45,
  });
}

/** Sepals and showy bracts: a flat fill with a darker edge. */
function drawBlades(
  g: Graphics,
  blades: ReadonlyArray<{ cmds: DrawCmd[]; color: number }>,
  scale: number,
  alpha: number,
): void {
  for (const blade of blades) {
    drawCmds(g, blade.cmds, scale);
    g.fill({ color: blade.color, alpha: alpha * 0.85 });
    drawCmds(g, blade.cmds, scale);
    g.stroke({
      color: darkenColor(blade.color, 0.5),
      width: Math.max(0.3, scale * 0.005),
      alpha: alpha * 0.35,
    });
  }
}

function drawLeaf(g: Graphics, leaf: LeafPlan, scale: number, alpha: number) {
  const leafAlpha = alpha * leaf.alpha;
  drawCmds(g, leaf.cmds, scale);
  g.fill({ color: leaf.color, alpha: leafAlpha * 0.9 });
  if (leaf.variegation) {
    drawCmds(g, leaf.variegation.cmds, scale);
    g.fill({ color: leaf.variegation.color, alpha: leafAlpha * 0.8 });
  }
  drawCmds(g, leaf.cmds, scale);
  g.stroke({
    color: darkenColor(leaf.color, 0.45),
    width: Math.max(0.3, scale * 0.006),
    alpha: leafAlpha * 0.4,
  });
  drawCmds(g, leaf.veins, scale);
  g.stroke({
    color: leaf.veinColor,
    width: Math.max(0.4, scale * 0.012),
    alpha: leafAlpha * 0.65,
  });
}

/** A side bud: its pedicel, the sepal shell with two seams, and any petal showing at the tip. */
function drawBud(g: Graphics, bud: BudPlan, scale: number, alpha: number) {
  drawStalk(g, bud.pedicel, bud.pedicelColor, scale, alpha);
  drawCmds(g, bud.shell, scale);
  g.fill({ color: bud.shellColor, alpha: alpha * 0.95 });
  drawCmds(g, bud.shell, scale);
  g.stroke({
    color: darkenColor(bud.shellColor, 0.5),
    width: Math.max(0.3, scale * 0.005),
    alpha: alpha * 0.45,
  });
  drawCmds(g, bud.seams, scale);
  g.stroke({
    color: darkenColor(bud.shellColor, 0.6),
    width: Math.max(0.3, scale * 0.004),
    alpha: alpha * 0.4,
  });
  if (bud.petal.length > 0) {
    drawCmds(g, bud.petal, scale);
    g.fill({ color: bud.petalColor, alpha: alpha * 0.9 });
  }
}

/** The stem fill and edge, then its branches, surface detail and thorns. */
function drawStem(g: Graphics, stem: StemPlan, scale: number, alpha: number) {
  drawStalk(g, stem.cmds, stem.color, scale, alpha);
  if (stem.branches.length > 0) {
    drawStalk(g, stem.branches, stem.color, scale, alpha);
  }
  for (const layer of stem.surface) {
    if (layer.strokes.length > 0) {
      drawCmds(g, layer.strokes, scale);
      g.stroke({
        color: layer.color,
        width: Math.max(0.4, scale * 0.007),
        alpha: alpha * 0.55,
      });
    }
    if (layer.fills.length > 0) {
      drawCmds(g, layer.fills, scale);
      g.fill({ color: layer.color, alpha: alpha * 0.55 });
    }
  }
  for (const thorn of stem.thorns) {
    drawCmds(g, thorn.cmds, scale);
    g.fill({ color: thorn.color, alpha: alpha * 0.85 });
    drawCmds(g, thorn.cmds, scale);
    g.stroke({
      color: darkenColor(thorn.color, 0.4),
      width: Math.max(0.3, scale * 0.005),
      alpha: alpha * 0.5,
    });
  }
}

/**
 * One flower head at the current origin: bracts, sepals, petal layers,
 * dewdrops, stamens and disc. Callers place it with the graphics transform, so a floret
 * or an arrangement member is the same head moved, scaled and tilted.
 */
function drawHead(
  g: Graphics,
  plan: FlowerPlan,
  scale: number,
  alpha: number,
): void {
  drawBlades(g, plan.bracts, scale, alpha);
  drawBlades(g, plan.sepals, scale, alpha);
  drawPetals(g, plan.layers, scale, alpha);

  for (const dd of plan.dewdrops) {
    const dx = dd.x * scale;
    const dy = dd.y * scale;
    const dr = dd.radius * scale;
    g.circle(dx, dy, dr);
    g.fill({ color: 0xffffff, alpha: alpha * 0.45 });
    g.circle(dx - dr * 0.3, dy - dr * 0.3, dr * 0.4);
    g.fill({ color: 0xffffff, alpha: alpha * 0.7 });
  }

  drawStamens(g, plan.center.stamens, scale, alpha);
  drawCenterDisc(g, plan.center, scale, alpha);
}

/** drawHead translated to (x, y) and rotated by `angle`, leaving the transform as it was. */
function drawHeadAt(
  g: Graphics,
  plan: FlowerPlan,
  x: number,
  y: number,
  angle: number,
  scale: number,
  alpha: number,
): void {
  g.save();
  g.translateTransform(x, y);
  g.rotateTransform(angle);
  drawHead(g, plan, scale, alpha);
  g.restore();
}

/** Draw a flower from its pre-computed plan: stem, pedicels, leaves, buds, then every head back to front. */
export function drawFlowerFromPlan(
  g: Graphics,
  plan: FlowerPlan,
  r: number,
  alpha: number,
) {
  const scale = r;
  const now = performance.now();

  // Stem (behind everything else)
  if (plan.stem) {
    drawStem(g, plan.stem, scale, alpha);
    drawStalk(g, plan.pedicels, plan.stem.color, scale, alpha);
  }

  for (const leaf of plan.leaves) drawLeaf(g, leaf, scale, alpha);
  for (const bud of plan.buds) drawBud(g, bud, scale, alpha);

  // Heads, the highest on screen first so lower heads overlap them
  const backToFront = plan.florets.toSorted((a, b) => a.offsetY - b.offsetY);
  for (const floret of backToFront) {
    drawHeadAt(
      g,
      plan,
      floret.offsetX * scale,
      floret.offsetY * scale,
      floret.angle,
      scale * floret.scale,
      alpha,
    );
  }

  // Particles (on top of everything, time-animated)
  for (const p of plan.particles) {
    const t = now / 1000;
    const { px, py, fade } = particlePosition(p, t, scale);
    const pr = p.size * scale;
    const alphaNow = alpha * fade;

    if (p.luminosity > 0) {
      g.circle(px, py, pr * 3);
      g.fill({ color: p.color, alpha: alphaNow * p.luminosity * 0.2 });
      g.circle(px, py, pr * 1.8);
      g.fill({ color: p.color, alpha: alphaNow * p.luminosity * 0.3 });
    }

    switch (p.kind) {
      case "Firefly":
      case "Sparkle":
      case "Lightning": {
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(t * 4 + p.x * 20));
        g.circle(px, py, pr * 1.5);
        g.fill({ color: p.color, alpha: alphaNow * twinkle * 0.8 });
        g.circle(px, py, pr * 0.6);
        g.fill({ color: 0xffffff, alpha: alphaNow * twinkle * 0.5 });
        break;
      }
      case "Butterflies": {
        const wingSpread = pr * 2;
        const flapAngle = Math.sin(t * 8 + p.x * 15) * 0.3;
        g.moveTo(px, py);
        g.lineTo(
          px - wingSpread * Math.cos(flapAngle),
          py - wingSpread * Math.sin(flapAngle),
        );
        g.lineTo(px, py - pr * 0.5);
        g.lineTo(
          px + wingSpread * Math.cos(flapAngle),
          py - wingSpread * Math.sin(flapAngle),
        );
        g.fill({ color: p.color, alpha: alphaNow * 0.6 });
        break;
      }
      case "Snowflakes": {
        const fallY = py + ((t * 0.02 * scale) % (scale * 0.5));
        g.circle(px, fallY, pr);
        g.fill({ color: 0xffffff, alpha: alphaNow * 0.5 });
        break;
      }
      case "Pollen":
      case "Stardust":
      case "FallingPetals":
      case "Spores":
      case "Motes":
      case "Embers":
      case "Seeds":
      case "Bubbles":
      case "Raindrops": {
        g.circle(px, py, pr);
        g.fill({ color: p.color, alpha: alphaNow * 0.5 });
        break;
      }
      default:
        unreachable(p.kind);
    }
  }
}

/**
 * Where a particle is at time t: a slow wobble around its seed, plus one
 * cycle of steady drift and gravity that restarts every few seconds. Moving
 * particles fade out over the cycle so the restart is not a pop.
 */
function particlePosition(
  p: ParticleSeed,
  t: number,
  scale: number,
): { px: number; py: number; fade: number } {
  const wobble = p.speed * 0.15;
  const moving = p.driftX !== 0 || p.driftY !== 0 || p.gravity !== 0;
  const stagger = Math.abs(p.x * 7.1 + p.y * 13.7) % 1;
  const phase = (t * (0.06 + p.speed * 0.12) + stagger) % 1;
  const x =
    p.x + Math.sin(t * wobble * 3 + p.y * 10) * wobble + phase * p.driftX;
  const y =
    p.y +
    Math.cos(t * wobble * 2 + p.x * 8) * wobble +
    phase * p.driftY +
    p.gravity * phase * phase * 0.6;
  return { px: x * scale, py: y * scale, fade: moving ? 1 - phase : 1 };
}

/** A slow breathing pulse in [0, 1]. */
const slowPulse = (now: number, period: number): number =>
  0.5 + 0.5 * Math.sin((now / period) * Math.PI * 2);

/** Pulse patterns beat hard; every other bioluminescence breathes slowly. */
function bioWaveAt(pattern: BioPattern, now: number): number {
  if (pattern === "Pulse") return 0.3 + 0.7 * slowPulse(now, 1200);
  return 0.6 + 0.4 * slowPulse(now, 2800);
}

/** True when the plan has per-frame glow to draw over the head (see drawGlow). */
export function hasGlow(plan: FlowerPlan): boolean {
  return plan.bio !== null || plan.center.nectary?.glow?.pulse != null;
}

/**
 * Bioluminescence and the nectary's pulse, drawn every frame on a separate
 * Graphics IN FRONT of the flower with additive blending: behind the petals
 * nothing would show through their fills.
 */
export function drawGlow(
  g: Graphics,
  plan: FlowerPlan,
  r: number,
  alpha: number,
): void {
  const now = performance.now();
  const bio = plan.bio;
  const pulse = plan.center.nectary?.glow?.pulse
    ? plan.center.nectary.glow
    : null;
  if (!bio && !pulse) return;

  const bioWave = bio ? bioWaveAt(bio.pattern, now) : 0;

  for (const floret of plan.florets) {
    const scale = r * floret.scale;
    g.save();
    g.translateTransform(floret.offsetX * r, floret.offsetY * r);
    g.rotateTransform(floret.angle);

    if (pulse?.pulse) {
      const wave = slowPulse(now, 1000 / pulse.pulse.speed);
      const level =
        pulse.pulse.minIntensity + (1 - pulse.pulse.minIntensity) * wave;
      const haloR = pulse.radius * scale;
      g.circle(0, 0, haloR);
      g.fill({
        color: pulse.color,
        alpha: alpha * pulse.intensity * level * 0.3,
      });
      g.circle(0, 0, haloR * 0.55);
      g.fill({
        color: pulse.color,
        alpha: alpha * pulse.intensity * level * 0.35,
      });
    }

    if (bio) {
      const glow = alpha * bio.intensity * bioWave;
      if (bio.strokes.length > 0) {
        drawCmds(g, bio.strokes, scale);
        g.stroke({
          color: bio.color,
          width: Math.max(1.5, scale * 0.05),
          alpha: glow * 0.3,
        });
        drawCmds(g, bio.strokes, scale);
        g.stroke({
          color: bio.color,
          width: Math.max(0.6, scale * 0.016),
          alpha: glow * 0.9,
        });
      }
      if (bio.fills.length > 0) {
        drawCmds(g, bio.fills, scale);
        g.fill({ color: bio.color, alpha: glow * 0.5 });
      }
    }

    g.restore();
  }
}

/** Draw a multi-flower arrangement from its pre-computed plan. */
export function drawArrangementFromPlan(
  g: Graphics,
  plan: ArrangementPlan,
  r: number,
  alpha: number,
) {
  const scale = r;

  // Pass 1: All stems
  for (const member of plan.members) drawStem(g, member.stem, scale, alpha);

  // Pass 2: Adornment
  if (plan.adornment) {
    const ad = plan.adornment;
    drawCmds(g, ad.cmds, scale);
    g.fill({ color: ad.color, alpha: alpha * ad.opacity });
    if (ad.accent) {
      drawCmds(g, ad.accent.cmds, scale);
      g.fill({ color: ad.accent.color, alpha: alpha * ad.accent.opacity });
    }
    if (ad.detail) {
      drawCmds(g, ad.detail.cmds, scale);
      g.fill({ color: ad.detail.color, alpha: alpha * ad.detail.opacity });
    }
  }

  // Pass 3: All leaves
  for (const member of plan.members) {
    for (const leaf of member.leaves) drawLeaf(g, leaf, scale, alpha);
  }

  // Pass 4: Flower heads (back to front — hero last so it's on top)
  for (const member of plan.members.toReversed()) {
    drawHeadAt(
      g,
      member.flowerPlan,
      member.offsetX * scale,
      member.offsetY * scale,
      0,
      scale * member.scale,
      alpha,
    );
  }
}
