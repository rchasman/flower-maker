/**
 * Shared PixiJS drawing functions for flowers and arrangements.
 *
 * Used by both the interactive designer canvas (FlowerCanvas) and the
 * read-only grid previews (MiniCanvas) so they produce identical visuals.
 */

import { Graphics } from "pixi.js";
import {
  darkenColor,
  lightenColor,
  type FlowerPlan,
  type ArrangementPlan,
  type DrawCmd,
} from "./render.ts";

// ── Constants ──

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// ── Low-level path helper ──

/** Execute DrawCmd[] on a PixiJS Graphics context, scaled around (ox, oy). */
export function drawCmds(g: Graphics, cmds: readonly DrawCmd[], scale: number, ox = 0, oy = 0): void {
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

const LIGHT_ANGLE = -Math.PI / 4;
const LIGHT_COS = Math.cos(LIGHT_ANGLE);
const LIGHT_SIN = Math.sin(LIGHT_ANGLE);

/** Draw petal layers with 7-pass rendering per petal. */
export function drawPetals(
  g: Graphics, layers: FlowerPlan["layers"],
  scale: number, alpha: number, ox = 0, oy = 0,
) {
  const lightOffsetX = LIGHT_COS * scale * 0.012;
  const lightOffsetY = LIGHT_SIN * scale * 0.012;
  const shadowOffX = -lightOffsetX * 1.5;
  const shadowOffY = -lightOffsetY * 1.5;

  for (const [layerIdx, layer] of layers.entries()) {
    // Pass 1: petal overlap depth shadows (inner layers cast onto outer)
    if (layerIdx > 0) {
      for (const petal of layer.petals) {
        drawCmds(g, petal.cmds, scale * 1.02, ox + shadowOffX, oy + shadowOffY);
        g.fill({ color: 0x000000, alpha: alpha * 0.06 });
      }
    }

    // Pass 2: normal petal rendering
    for (const petal of layer.petals) {
      drawCmds(g, petal.cmds, scale, ox, oy);
      g.fill({ color: petal.color, alpha: alpha * layer.opacity });

      for (let si = 1; si < petal.gradientStops.length; si++) {
        const stop = petal.gradientStops[si]!;
        if (stop.cmds.length === 0) continue;
        const stopAlpha = alpha * layer.opacity * (0.65 - (si - 1) * 0.1);
        drawCmds(g, stop.cmds, scale, ox, oy);
        g.fill({ color: stop.blendedColor, alpha: Math.max(0.15, stopAlpha) });
      }

      drawCmds(g, petal.cmds, scale, ox + lightOffsetX, oy + lightOffsetY);
      g.fill({ color: petal.lightColor, alpha: alpha * layer.opacity * 0.18 });

      drawCmds(g, petal.cmds, scale, ox - lightOffsetX * 0.7, oy - lightOffsetY * 0.7);
      g.fill({ color: petal.shadowColor, alpha: alpha * layer.opacity * 0.1 });

      drawCmds(g, petal.cmds, scale, ox, oy);
      g.fill({ color: petal.highlightColor, alpha: alpha * 0.15 });

      // Texture pass — material-specific visual treatment
      switch (petal.texture) {
        case "Velvet": {
          // Edge darkening — thick inner stroke for soft absorbed-light look
          drawCmds(g, petal.cmds, scale, ox, oy);
          g.stroke({ color: petal.textureEdge, width: Math.max(1.5, scale * 0.025), alpha: alpha * 0.2 });
          break;
        }
        case "Silk": {
          // Bright specular band — thin highlight stripe across petal center
          drawCmds(g, petal.cmds, scale, ox + lightOffsetX * 2, oy + lightOffsetY * 2);
          g.fill({ color: petal.textureHighlight, alpha: alpha * 0.12 });
          break;
        }
        case "Waxy": {
          // Sharp specular — bright highlight near petal base
          drawCmds(g, petal.cmds, scale, ox + lightOffsetX * 1.5, oy + lightOffsetY * 1.5);
          g.fill({ color: petal.textureHighlight, alpha: alpha * 0.15 });
          break;
        }
        case "Metallic": {
          // Color-shift: warm/cool offset fills for metallic sheen
          drawCmds(g, petal.cmds, scale, ox + lightOffsetX, oy + lightOffsetY);
          g.fill({ color: petal.textureHighlight, alpha: alpha * 0.2 });
          drawCmds(g, petal.cmds, scale, ox - lightOffsetX, oy - lightOffsetY);
          g.fill({ color: petal.textureEdge, alpha: alpha * 0.12 });
          break;
        }
        case "Papery": {
          // Desaturated overlay — muted, translucent look
          drawCmds(g, petal.cmds, scale, ox, oy);
          g.fill({ color: petal.textureHighlight, alpha: alpha * 0.08 });
          break;
        }
        case "Glassy":
        case "Crystalline": {
          // Sharp specular point — bright white highlight
          drawCmds(g, petal.cmds, scale, ox + lightOffsetX * 2.5, oy + lightOffsetY * 2.5);
          g.fill({ color: 0xffffff, alpha: alpha * 0.18 });
          break;
        }
        case "Pearlescent": {
          // Warm and cool offset fills for rainbow sheen
          drawCmds(g, petal.cmds, scale, ox + lightOffsetX * 0.8, oy + lightOffsetY * 0.8);
          g.fill({ color: petal.textureHighlight, alpha: alpha * 0.1 });
          drawCmds(g, petal.cmds, scale, ox - lightOffsetX * 0.5, oy - lightOffsetY * 0.5);
          g.fill({ color: petal.textureEdge, alpha: alpha * 0.08 });
          break;
        }
        case "Frosted": {
          // White edge frost
          drawCmds(g, petal.cmds, scale, ox, oy);
          g.stroke({ color: 0xffffff, width: Math.max(1, scale * 0.02), alpha: alpha * 0.15 });
          break;
        }
        // Smooth, Rough, Hairy, Fuzzy, Scaled, Leathery, Powdery — no extra pass
      }

      if (petal.veinCmds.length > 0) {
        drawCmds(g, petal.veinCmds, scale, ox, oy);
        g.stroke({ color: petal.midribGlowColor, width: Math.max(0.8, scale * 0.018), alpha: alpha * 0.12 });

        drawCmds(g, petal.veinCmds, scale, ox, oy);
        g.stroke({ color: petal.veinColor, width: Math.max(0.3, scale * 0.008), alpha: alpha * 0.25 });
      }

      drawCmds(g, petal.cmds, scale, ox, oy);
      g.stroke({ color: petal.outlineColor, width: Math.max(0.3, scale * 0.006), alpha: alpha * layer.opacity * 0.4 });
    }
  }
}

/** Draw stamens with curved filaments and anther highlights. */
export function drawStamens(
  g: Graphics, stamens: FlowerPlan["center"]["stamens"],
  scale: number, alpha: number, ox = 0, oy = 0,
) {
  for (const [i, s] of stamens.entries()) {
    const sx = ox + Math.cos(s.angle) * s.length * scale;
    const sy = oy + Math.sin(s.angle) * s.length * scale;
    const midX = ox + (sx - ox) * 0.5;
    const midY = oy + (sy - oy) * 0.5;
    const perpX = -(sy - oy) * 0.12;
    const perpY = (sx - ox) * 0.12;
    const bendDir = i % 2 === 0 ? 1 : -1;

    g.moveTo(ox, oy);
    g.bezierCurveTo(
      midX + perpX * bendDir, midY + perpY * bendDir,
      midX + perpX * bendDir * 0.5, midY + perpY * bendDir * 0.5,
      sx, sy,
    );
    g.stroke({ color: s.filamentColor, width: Math.max(0.4, scale * 0.022), alpha: alpha * 0.75 });

    const ar = s.antherRadius * scale;
    g.circle(sx, sy, ar);
    g.fill({ color: s.antherColor, alpha });
    g.circle(sx, sy, ar);
    g.stroke({ color: darkenColor(s.antherColor, 0.5), width: Math.max(0.2, scale * 0.004), alpha: alpha * 0.4 });
    g.circle(sx - ar * 0.25, sy - ar * 0.25, ar * 0.35);
    g.fill({ color: 0xffffff, alpha: alpha * 0.25 });
  }
}

/** Draw center disc with outline, radial depth, stippling, and pistil highlight. */
export function drawCenterDisc(
  g: Graphics, center: FlowerPlan["center"],
  scale: number, alpha: number, ox = 0, oy = 0,
) {
  const discR = center.discRadius * scale;
  const discColor = center.discColor;

  g.circle(ox, oy, discR);
  g.fill({ color: discColor, alpha });
  g.circle(ox, oy, discR);
  g.stroke({ color: darkenColor(discColor, 0.45), width: Math.max(0.3, scale * 0.006), alpha: alpha * 0.4 });

  g.circle(ox, oy, discR * 0.75);
  g.fill({ color: lightenColor(discColor, 0.08), alpha: alpha * 0.3 });
  g.circle(ox, oy, discR * 0.5);
  g.fill({ color: lightenColor(discColor, 0.15), alpha: alpha * 0.25 });

  const stippleCount = Math.max(5, Math.min(16, Math.round(discR * 4)));
  for (let i = 0; i < stippleCount; i++) {
    const t = (i + 1) / (stippleCount + 1);
    const r2 = discR * t * 0.85;
    const theta = i * GOLDEN_ANGLE;
    const dotX = ox + Math.cos(theta) * r2;
    const dotY = oy + Math.sin(theta) * r2;
    const dotR = Math.max(0.3, scale * 0.008 * (1 - t * 0.4));
    const dotColor = i % 2 === 0 ? darkenColor(discColor, 0.6) : lightenColor(discColor, 0.1);
    g.circle(dotX, dotY, dotR);
    g.fill({ color: dotColor, alpha: alpha * (0.35 + t * 0.2) });
  }

  const hlR = center.highlightRadius * scale;
  g.circle(ox + discR * 0.08, oy - discR * 0.12, hlR);
  g.fill({ color: center.highlightColor, alpha: alpha * 0.55 });
}

/** Draw aura on a SEPARATE Graphics to avoid rectangular bounding-box artifacts. */
export function drawAura(g: Graphics, plan: FlowerPlan, r: number, alpha: number) {
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
        g.fill({ color: plan.aura!.color, alpha: auraAlpha * (0.3 + 0.1 * Math.sin(now / 400 + i)) });
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
    default: {
      g.circle(0, 0, auraR);
      g.fill({ color: plan.aura.color, alpha: auraAlpha * 0.35 });
      g.circle(0, 0, auraR * 0.6);
      g.fill({ color: plan.aura.color, alpha: auraAlpha * 0.2 });
    }
  }
}

// ── Full flower / arrangement drawing ──

/** Draw a flower from its pre-computed plan (stem, leaves, then head). */
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
    drawCmds(g, plan.stem.cmds, scale);
    g.fill({ color: plan.stem.color, alpha: alpha * 0.9 });
    drawCmds(g, plan.stem.cmds, scale);
    g.stroke({ color: darkenColor(plan.stem.color, 0.5), width: Math.max(0.4, scale * 0.008), alpha: alpha * 0.45 });

    for (const thorn of plan.stem.thorns) {
      drawCmds(g, thorn.cmds, scale);
      g.fill({ color: thorn.color, alpha: alpha * 0.85 });
      drawCmds(g, thorn.cmds, scale);
      g.stroke({ color: darkenColor(thorn.color, 0.4), width: Math.max(0.3, scale * 0.005), alpha: alpha * 0.5 });
    }
  }

  // Leaves
  for (const leaf of plan.leaves) {
    drawCmds(g, leaf.cmds, scale);
    g.fill({ color: leaf.color, alpha: alpha * 0.9 });
    drawCmds(g, leaf.cmds, scale);
    g.stroke({ color: darkenColor(leaf.color, 0.45), width: Math.max(0.3, scale * 0.006), alpha: alpha * 0.4 });
    drawCmds(g, leaf.veins, scale);
    g.stroke({ color: darkenColor(leaf.color, 0.5), width: Math.max(0.4, scale * 0.012), alpha: alpha * 0.65 });
  }

  // Sepals
  for (const sepal of plan.sepals) {
    drawCmds(g, sepal.cmds, scale);
    g.fill({ color: sepal.color, alpha: alpha * 0.85 });
    drawCmds(g, sepal.cmds, scale);
    g.stroke({ color: darkenColor(sepal.color, 0.5), width: Math.max(0.3, scale * 0.005), alpha: alpha * 0.35 });
  }

  // Petal layers, dewdrops, stamens, center disc
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

  // Particles (on top of everything, time-animated)
  for (const p of plan.particles) {
    const t = now / 1000;
    const drift = p.speed * 0.15;
    const px = (p.x + Math.sin(t * drift * 3 + p.y * 10) * drift) * scale;
    const py = (p.y + Math.cos(t * drift * 2 + p.x * 8) * drift) * scale;
    const pr = p.size * scale;

    switch (p.kind) {
      case "Firefly":
      case "Sparkle":
      case "Lightning": {
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(t * 4 + p.x * 20));
        g.circle(px, py, pr * 1.5);
        g.fill({ color: p.color, alpha: alpha * twinkle * 0.8 });
        g.circle(px, py, pr * 0.6);
        g.fill({ color: 0xffffff, alpha: alpha * twinkle * 0.5 });
        break;
      }
      case "Butterflies": {
        const wingSpread = pr * 2;
        const flapAngle = Math.sin(t * 8 + p.x * 15) * 0.3;
        g.moveTo(px, py);
        g.lineTo(px - wingSpread * Math.cos(flapAngle), py - wingSpread * Math.sin(flapAngle));
        g.lineTo(px, py - pr * 0.5);
        g.lineTo(px + wingSpread * Math.cos(flapAngle), py - wingSpread * Math.sin(flapAngle));
        g.fill({ color: p.color, alpha: alpha * 0.6 });
        break;
      }
      case "Snowflakes": {
        const fallY = py + (t * 0.02 * scale) % (scale * 0.5);
        g.circle(px, fallY, pr);
        g.fill({ color: 0xffffff, alpha: alpha * 0.5 });
        break;
      }
      default: {
        g.circle(px, py, pr);
        g.fill({ color: p.color, alpha: alpha * 0.5 });
      }
    }
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
  for (const member of plan.members) {
    drawCmds(g, member.stem.cmds, scale);
    g.fill({ color: member.stem.color, alpha: alpha * 0.9 });
    drawCmds(g, member.stem.cmds, scale);
    g.stroke({ color: darkenColor(member.stem.color, 0.5), width: Math.max(0.4, scale * 0.008), alpha: alpha * 0.45 });
  }

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
    for (const leaf of member.leaves) {
      drawCmds(g, leaf.cmds, scale);
      g.fill({ color: leaf.color, alpha: alpha * 0.85 });
      drawCmds(g, leaf.cmds, scale);
      g.stroke({ color: darkenColor(leaf.color, 0.45), width: Math.max(0.3, scale * 0.006), alpha: alpha * 0.4 });
    }
  }

  // Pass 4: Flower heads (back to front — hero last so it's on top)
  for (const member of plan.members.toReversed()) {
    const flowerScale = scale * member.scale;
    const ox = member.offsetX * scale;
    const oy = member.offsetY * scale;

    for (const sepal of member.flowerPlan.sepals) {
      drawCmds(g, sepal.cmds, flowerScale, ox, oy);
      g.fill({ color: sepal.color, alpha: alpha * 0.85 });
      drawCmds(g, sepal.cmds, flowerScale, ox, oy);
      g.stroke({ color: darkenColor(sepal.color, 0.5), width: Math.max(0.3, flowerScale * 0.005), alpha: alpha * 0.35 });
    }

    drawPetals(g, member.flowerPlan.layers, flowerScale, alpha, ox, oy);
    drawStamens(g, member.flowerPlan.center.stamens, flowerScale, alpha, ox, oy);
    drawCenterDisc(g, member.flowerPlan.center, flowerScale, alpha, ox, oy);
  }
}
