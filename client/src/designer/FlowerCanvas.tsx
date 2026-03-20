import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { Application, Graphics, Container, Circle, Filter, GraphicsContextSystem } from "pixi.js";
import type { FlowerRenderData } from "../wasm/loop.ts";
import {
  sidHash,
  fallbackColor,
  colorFromSpec,
  darkenColor,
  lightenColor,
  createFlowerPlan,
  createArrangementPlan,
  type FlowerPlan,
  type ArrangementPlan,
  type ArrangementMeta,
  type AdornmentPlan,
  type DrawCmd,
} from "../flower/render.ts";
import { setCanvasViewport, getCanvasViewport } from "../spacetime/bridge.ts";
import { createMergeGlowFilter, createDarkFantasyDitherFilter } from "../canvas/shaders.ts";
import { createMergeEffect, tickMergeEffect, type MergeEffectState } from "../canvas/MergeEffect.ts";

export type ConstituentEntry = { specJson: string; sid: number };

export interface FlowerCanvasHandle {
  /** Push new render data each frame from the WASM loop. */
  updateFlowers(data: FlowerRenderData[]): void;
  /** Update the spec map (sid → specJson) — call when specs change. */
  setSpecMap(specs: Map<number, string>): void;
  /** Update the constituent map (sid → array of constituent specs) for arrangements. */
  setConstituentMap(constituents: Map<number, ConstituentEntry[]>): void;
  /** Update the arrangement metadata map (sid → AI-generated arrangement meta). */
  setArrangementMetaMap(meta: Map<number, ArrangementMeta>): void;
}

interface FlowerCanvasProps {
  onFlowerClick?: (sid: number) => void;
  onFlowerDrag?: (sid: number, x: number, y: number) => void;
  onFlowerDragEnd?: (sid: number, x: number, y: number) => void;
  onMergeDrop?: (dragSid: number, targetSid: number) => void;
  selectedId?: number | null;
}

/** Resolve flower color — use spec data if available, fallback to sid hash. */
function resolveColor(flower: FlowerRenderData): number {
  const { petal_color_r: r, petal_color_g: g, petal_color_b: b } = flower;
  if (r + g + b < 0.05) return fallbackColor(flower.sid);
  return colorFromSpec(r, g, b);
}

/** Execute DrawCmd[] on a PixiJS Graphics context, scaled around (0,0). */
function drawCmds(g: Graphics, cmds: readonly DrawCmd[], scale: number, ox = 0, oy = 0): void {
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

// ── Module-scope constants (hoisted from hot loops) ──
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MERGE_GLOW_DURATION = 2000;

// ── Shared drawing helpers (used by both single-flower and arrangement paths) ──

/** Draw petal layers with 4-pass rendering: fill, highlight, outline, vein. */
function drawPetals(
  g: Graphics, layers: FlowerPlan["layers"],
  scale: number, alpha: number, ox = 0, oy = 0,
) {
  layers.map((layer) => {
    layer.petals.map((petal) => {
      drawCmds(g, petal.cmds, scale, ox, oy);
      g.fill({ color: petal.color, alpha: alpha * layer.opacity });

      drawCmds(g, petal.cmds, scale, ox, oy);
      g.fill({ color: petal.highlightColor, alpha: alpha * 0.15 });

      drawCmds(g, petal.cmds, scale, ox, oy);
      g.stroke({ color: petal.outlineColor, width: Math.max(0.3, scale * 0.006), alpha: alpha * layer.opacity * 0.4 });

      if (petal.veinCmds.length > 0) {
        drawCmds(g, petal.veinCmds, scale, ox, oy);
        g.stroke({ color: petal.veinColor, width: Math.max(0.3, scale * 0.008), alpha: alpha * 0.25 });
      }
      return null;
    });
    return null;
  });
}

/** Draw stamens with curved filaments and anther highlights. */
function drawStamens(
  g: Graphics, stamens: FlowerPlan["center"]["stamens"],
  scale: number, alpha: number, ox = 0, oy = 0,
) {
  stamens.map((s, i) => {
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
    return null;
  });
}

/** Draw center disc with outline, radial depth, stippling, and pistil highlight. */
function drawCenterDisc(
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
  Array.from({ length: stippleCount }, (_, i) => {
    const t = (i + 1) / (stippleCount + 1);
    const r2 = discR * t * 0.85;
    const theta = i * GOLDEN_ANGLE;
    const dotX = ox + Math.cos(theta) * r2;
    const dotY = oy + Math.sin(theta) * r2;
    const dotR = Math.max(0.3, scale * 0.008 * (1 - t * 0.4));
    const dotColor = i % 2 === 0 ? darkenColor(discColor, 0.6) : lightenColor(discColor, 0.1);
    g.circle(dotX, dotY, dotR);
    g.fill({ color: dotColor, alpha: alpha * (0.35 + t * 0.2) });
    return null;
  });

  const hlR = center.highlightRadius * scale;
  g.circle(ox + discR * 0.08, oy - discR * 0.12, hlR);
  g.fill({ color: center.highlightColor, alpha: alpha * 0.55 });
}

/** Draw aura on a SEPARATE Graphics to avoid rectangular bounding-box artifacts. */
function drawAura(g: Graphics, plan: FlowerPlan, r: number, alpha: number) {
  if (!plan.aura) return;
  const scale = r;
  const now = performance.now();
  const auraR = plan.aura.radius * scale * 2.5;
  const pulse = 0.85 + 0.15 * Math.sin(now / 800);
  const auraAlpha = alpha * plan.aura.opacity * pulse;

  switch (plan.aura.kind) {
    case "Prismatic":
    case "Rainbow": {
      [0.6, 0.8, 1.0].map((f, i) => {
        const hueShift = [0xff6b9d, 0x67e8f9, 0xc084fc][i]!;
        g.circle(0, 0, auraR * f);
        g.fill({ color: hueShift, alpha: auraAlpha * 0.3 });
        return null;
      });
      break;
    }
    case "Crystal": {
      const sides = 6;
      Array.from({ length: sides }, (_, i) => {
        const a1 = (i / sides) * Math.PI * 2 + now / 3000;
        const a2 = ((i + 1) / sides) * Math.PI * 2 + now / 3000;
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a1) * auraR, Math.sin(a1) * auraR);
        g.lineTo(Math.cos(a2) * auraR, Math.sin(a2) * auraR);
        g.fill({ color: plan.aura!.color, alpha: auraAlpha * (0.3 + 0.1 * Math.sin(now / 400 + i)) });
        return null;
      });
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

/** Draw a flower from its pre-computed plan (stem, leaves, then head). */
function drawFlowerFromPlan(
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
    // Outline for crisp definition against dark background
    drawCmds(g, plan.stem.cmds, scale);
    g.stroke({ color: darkenColor(plan.stem.color, 0.5), width: Math.max(0.4, scale * 0.008), alpha: alpha * 0.45 });

    // Thorns
    plan.stem.thorns.map((thorn) => {
      drawCmds(g, thorn.cmds, scale);
      g.fill({ color: thorn.color, alpha: alpha * 0.85 });
      // Crisp outline for thorn definition
      drawCmds(g, thorn.cmds, scale);
      g.stroke({ color: darkenColor(thorn.color, 0.4), width: Math.max(0.3, scale * 0.005), alpha: alpha * 0.5 });
      return null;
    });
  }

  // Leaves
  plan.leaves.map((leaf) => {
    // Leaf fill
    drawCmds(g, leaf.cmds, scale);
    g.fill({ color: leaf.color, alpha: alpha * 0.9 });
    // Outline for definition
    drawCmds(g, leaf.cmds, scale);
    g.stroke({ color: darkenColor(leaf.color, 0.45), width: Math.max(0.3, scale * 0.006), alpha: alpha * 0.4 });
    // Veins — slightly more visible
    drawCmds(g, leaf.veins, scale);
    g.stroke({ color: darkenColor(leaf.color, 0.5), width: Math.max(0.4, scale * 0.012), alpha: alpha * 0.65 });
    return null;
  });

  // Sepals
  plan.sepals.map((sepal) => {
    drawCmds(g, sepal.cmds, scale);
    g.fill({ color: sepal.color, alpha: alpha * 0.85 });
    // Outline for definition
    drawCmds(g, sepal.cmds, scale);
    g.stroke({ color: darkenColor(sepal.color, 0.5), width: Math.max(0.3, scale * 0.005), alpha: alpha * 0.35 });
    return null;
  });

  // Petal layers, dewdrops, stamens, center disc
  drawPetals(g, plan.layers, scale, alpha);

  plan.dewdrops.map((dd) => {
    const dx = dd.x * scale;
    const dy = dd.y * scale;
    const dr = dd.radius * scale;
    g.circle(dx, dy, dr);
    g.fill({ color: 0xffffff, alpha: alpha * 0.45 });
    g.circle(dx - dr * 0.3, dy - dr * 0.3, dr * 0.4);
    g.fill({ color: 0xffffff, alpha: alpha * 0.7 });
    return null;
  });

  drawStamens(g, plan.center.stamens, scale, alpha);
  drawCenterDisc(g, plan.center, scale, alpha);

  // Particles (on top of everything, time-animated)
  plan.particles.map((p) => {
    const t = now / 1000;
    // Gentle drift based on particle speed
    const drift = p.speed * 0.15;
    const px = (p.x + Math.sin(t * drift * 3 + p.y * 10) * drift) * scale;
    const py = (p.y + Math.cos(t * drift * 2 + p.x * 8) * drift) * scale;
    const pr = p.size * scale;

    switch (p.kind) {
      case "Firefly":
      case "Sparkle":
      case "Lightning": {
        // Twinkling point
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(t * 4 + p.x * 20));
        g.circle(px, py, pr * 1.5);
        g.fill({ color: p.color, alpha: alpha * twinkle * 0.8 });
        g.circle(px, py, pr * 0.6);
        g.fill({ color: 0xffffff, alpha: alpha * twinkle * 0.5 });
        break;
      }
      case "Butterflies": {
        // Tiny V-shape
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
        // Slowly falling, rotating dot
        const fallY = py + (t * 0.02 * scale) % (scale * 0.5);
        g.circle(px, fallY, pr);
        g.fill({ color: 0xffffff, alpha: alpha * 0.5 });
        break;
      }
      default: {
        // Pollen, Seeds, Spores, Motes, etc. — simple drifting dot
        g.circle(px, py, pr);
        g.fill({ color: p.color, alpha: alpha * 0.5 });
      }
    }
    return null;
  });
}

/** Draw a multi-flower arrangement from its pre-computed plan. */
function drawArrangementFromPlan(
  g: Graphics,
  plan: ArrangementPlan,
  r: number,
  alpha: number,
) {
  const scale = r;

  // Draw back-to-front: stems first, then leaves, then flower heads
  // Pass 1: All stems
  plan.members.map((member) => {
    drawCmds(g, member.stem.cmds, scale);
    g.fill({ color: member.stem.color, alpha: alpha * 0.9 });
    // Outline for crisp definition
    drawCmds(g, member.stem.cmds, scale);
    g.stroke({ color: darkenColor(member.stem.color, 0.5), width: Math.max(0.4, scale * 0.008), alpha: alpha * 0.45 });
    return null;
  });

  // Pass 2: Adornment (wrap, vase, pedestal — sits on top of stems, behind leaves/heads)
  if (plan.adornment) {
    const ad = plan.adornment;
    // Main body — may contain merged shapes (e.g. pedestal + vase)
    drawCmds(g, ad.cmds, scale);
    g.fill({ color: ad.color, alpha: alpha * ad.opacity });
    // Accent detail (ribbon, rim highlight)
    if (ad.accent) {
      drawCmds(g, ad.accent.cmds, scale);
      g.fill({ color: ad.accent.color, alpha: alpha * ad.accent.opacity });
    }
    // Secondary detail (foot, platform edge)
    if (ad.detail) {
      drawCmds(g, ad.detail.cmds, scale);
      g.fill({ color: ad.detail.color, alpha: alpha * ad.detail.opacity });
    }
  }

  // Pass 3: All leaves
  plan.members.map((member) => {
    member.leaves.map((leaf) => {
      drawCmds(g, leaf.cmds, scale);
      g.fill({ color: leaf.color, alpha: alpha * 0.85 });
      // Outline for definition
      drawCmds(g, leaf.cmds, scale);
      g.stroke({ color: darkenColor(leaf.color, 0.45), width: Math.max(0.3, scale * 0.006), alpha: alpha * 0.4 });
      return null;
    });
    return null;
  });

  // Pass 4: Flower heads (back to front — hero last so it's on top)
  plan.members.toReversed().map((member) => {
    const flowerScale = scale * member.scale;
    const ox = member.offsetX * scale;
    const oy = member.offsetY * scale;

    // Sepals
    member.flowerPlan.sepals.map((sepal) => {
      drawCmds(g, sepal.cmds, flowerScale, ox, oy);
      g.fill({ color: sepal.color, alpha: alpha * 0.85 });
      drawCmds(g, sepal.cmds, flowerScale, ox, oy);
      g.stroke({ color: darkenColor(sepal.color, 0.5), width: Math.max(0.3, flowerScale * 0.005), alpha: alpha * 0.35 });
      return null;
    });

    drawPetals(g, member.flowerPlan.layers, flowerScale, alpha, ox, oy);
    drawStamens(g, member.flowerPlan.center.stamens, flowerScale, alpha, ox, oy);
    drawCenterDisc(g, member.flowerPlan.center, flowerScale, alpha, ox, oy);

    return null;
  });
}

const FLOWER_BASE_RADIUS = 70;
const SELECTION_RING_PAD = 6;
const MERGE_RANGE = FLOWER_BASE_RADIUS * 3;

export const FlowerCanvas = forwardRef<FlowerCanvasHandle, FlowerCanvasProps>(
  function FlowerCanvas(
    { onFlowerClick, onFlowerDrag, onFlowerDragEnd, onMergeDrop, selectedId },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const flowerGraphicsRef = useRef<Map<number, Graphics>>(new Map());
    const stageContainerRef = useRef<Container | null>(null);
    const selectedIdRef = useRef(selectedId);
    const dragRef = useRef<{ sid: number } | null>(null);
    const onFlowerDragRef = useRef(onFlowerDrag);
    const onFlowerDragEndRef = useRef(onFlowerDragEnd);
    const onMergeDropRef = useRef(onMergeDrop);
    const mergeTargetRef = useRef<{ dragSid: number; targetSid: number; distance: number } | null>(null);
    const mergeOverlayRef = useRef<Graphics | null>(null);

    // Aura graphics — separate from flower graphics to avoid bounding-box artifacts
    const auraGraphicsRef = useRef<Map<number, Graphics>>(new Map());

    // Shader filter refs
    const mergeGlowFiltersRef = useRef<Map<number, { filter: Filter; startTime: number }>>(new Map());
    const mergeEffectsRef = useRef<MergeEffectState[]>([]);
    const mergeParticleGfxRef = useRef<Graphics | null>(null);

    // Spec map, constituent map, arrangement meta, and cached plans
    const specMapRef = useRef<Map<number, string>>(new Map());
    const constituentMapRef = useRef<Map<number, ConstituentEntry[]>>(new Map());
    const arrangementMetaMapRef = useRef<Map<number, ArrangementMeta>>(new Map());
    const planCacheRef = useRef<Map<number, { key: string; plan: FlowerPlan | ArrangementPlan; isArrangement: boolean }>>(new Map());

    // Keep refs in sync without re-running effects
    selectedIdRef.current = selectedId;
    onFlowerDragRef.current = onFlowerDrag;
    onFlowerDragEndRef.current = onFlowerDragEnd;
    onMergeDropRef.current = onMergeDrop;

    /** Get or create the cached plan (FlowerPlan or ArrangementPlan) for a given sid. */
    const getPlan = useCallback((sid: number): { plan: FlowerPlan | ArrangementPlan; isArrangement: boolean } => {
      const specJson = specMapRef.current.get(sid) ?? "";
      const constituents = constituentMapRef.current.get(sid);
      const meta = arrangementMetaMapRef.current.get(sid);
      const isArrangement = !!constituents && constituents.length > 1;

      // Cache key includes constituent count + meta so arrangement changes invalidate
      const metaKey = meta ? JSON.stringify(meta) : "";
      const cacheKey = isArrangement
        ? `arr:${constituents.length}:${constituents.map(c => c.specJson).join("|")}:${metaKey}`
        : specJson;

      const cached = planCacheRef.current.get(sid);
      if (cached && cached.key === cacheKey) {
        return { plan: cached.plan, isArrangement: cached.isArrangement };
      }

      // Cache miss — recompute
      if (isArrangement) {
        const plan = createArrangementPlan(constituents, Math.min(7, Math.ceil(constituents.length / 3)), meta);
        planCacheRef.current.set(sid, { key: cacheKey, plan, isArrangement: true });
        return { plan, isArrangement: true };
      }

      const plan = createFlowerPlan(specJson || undefined, sid);
      planCacheRef.current.set(sid, { key: cacheKey, plan, isArrangement: false });
      return { plan, isArrangement: false };
    }, []);

    const setSpecMap = useCallback((specs: Map<number, string>) => {
      specMapRef.current = specs;
    }, []);

    const setConstituentMap = useCallback((constituents: Map<number, ConstituentEntry[]>) => {
      constituentMapRef.current = constituents;
    }, []);

    const setArrangementMetaMap = useCallback((meta: Map<number, ArrangementMeta>) => {
      arrangementMetaMapRef.current = meta;
      // Invalidate cached arrangement plans so they pick up new meta
      planCacheRef.current.forEach((_, sid) => {
        if (constituentMapRef.current.has(sid)) planCacheRef.current.delete(sid);
      });
    }, []);

    const updateFlowers = useCallback(
      (data: FlowerRenderData[]) => {
        const stage = stageContainerRef.current;
        if (!stage) return;

        const graphics = flowerGraphicsRef.current;
        const activeSids = new Set(data.map((d) => d.sid));

        // Remove flowers no longer present
        const auras = auraGraphicsRef.current;
        [...graphics.entries()]
          .filter(([sid]) => !activeSids.has(sid))
          .map(([sid, g]) => {
            stage.removeChild(g);
            g.destroy();
            graphics.delete(sid);
            planCacheRef.current.delete(sid);
            const ag = auras.get(sid);
            if (ag) { stage.removeChild(ag); ag.destroy(); auras.delete(sid); }
            return sid;
          });

        // Update or create flower graphics
        data.map((flower) => {
          let g = graphics.get(flower.sid);
          if (!g) {
            g = new Graphics();
            g.eventMode = "static";
            g.cursor = "grab";
            const sid = flower.sid;
            g.on("pointerdown", (e) => {
              onFlowerClick?.(sid);
              dragRef.current = { sid };
              g!.cursor = "grabbing";
              e.stopPropagation();
            });
            g.on("pointerup", () => {
              g!.cursor = "grab";
            });
            graphics.set(flower.sid, g);
            stage.addChild(g);
          }

          const r = FLOWER_BASE_RADIUS * flower.scale;
          const { plan, isArrangement } = getPlan(flower.sid);

          // Override plan layer colors with live WASM color data
          // (WASM extracts petal_color from spec and passes it in the render buffer)
          const liveColor = resolveColor(flower);

          // Expand hit area to cover stem + head
          const hitRadius = isArrangement ? r * 2.5 : r * 1.8;
          g.hitArea = new Circle(0, 0, hitRadius);

          g.clear();

          // Selection ring
          const isSelected = selectedIdRef.current === flower.sid;
          if (isSelected) {
            const ringR = isArrangement ? r * 1.2 + SELECTION_RING_PAD : r * 0.55 + SELECTION_RING_PAD;
            g.circle(0, 0, ringR);
            g.stroke({ color: 0xffffff, width: 2, alpha: 0.7 });
          }

          // Aura — drawn on a separate Graphics to avoid rectangular bounding-box clipping
          const flowerPlan = !isArrangement ? (plan as FlowerPlan) : null;
          const hasAura = flowerPlan?.aura || flower.has_glow || flower.has_aura;
          let ag = auras.get(flower.sid);
          if (hasAura) {
            if (!ag) {
              ag = new Graphics();
              auras.set(flower.sid, ag);
              // Insert aura BEHIND the flower in the stage
              const flowerIdx = stage.getChildIndex(g);
              stage.addChildAt(ag, flowerIdx);
            }
            ag.clear();
            if (flowerPlan?.aura) {
              drawAura(ag, flowerPlan, r, flower.alpha);
            } else {
              // Fallback glow
              ag.circle(0, 0, r + 4);
              ag.fill({ color: liveColor, alpha: 0.15 * flower.alpha });
            }
            ag.position.set(flower.x, flower.y);
            ag.rotation = flower.rotation;
          } else if (ag) {
            ag.clear();
          }

          // Draw the flower or arrangement from its spec-driven plan
          if (isArrangement) {
            drawArrangementFromPlan(g, plan as ArrangementPlan, r, flower.alpha);
          } else {
            drawFlowerFromPlan(g, plan as FlowerPlan, r, flower.alpha);
          }

          g.position.set(flower.x, flower.y);
          g.rotation = flower.rotation;

          return flower.sid;
        });

        // ── Merge proximity detection ──
        const drag = dragRef.current;
        if (drag) {
          const dragged = data.find(f => f.sid === drag.sid);
          if (dragged) {
            const nearest = data
              .filter(f => f.sid !== dragged.sid)
              .map(f => ({ sid: f.sid, dist: Math.hypot(f.x - dragged.x, f.y - dragged.y), x: f.x, y: f.y }))
              .filter(f => f.dist < MERGE_RANGE)
              .sort((a, b) => a.dist - b.dist)[0] ?? null;

            mergeTargetRef.current = nearest
              ? { dragSid: dragged.sid, targetSid: nearest.sid, distance: nearest.dist }
              : null;
          }
        } else {
          mergeTargetRef.current = null;
        }

        // ── Merge overlay ring ──
        if (!mergeOverlayRef.current && stage) {
          mergeOverlayRef.current = new Graphics();
          stage.addChild(mergeOverlayRef.current);
        }
        const overlay = mergeOverlayRef.current;
        if (overlay) {
          overlay.clear();
          const mt = mergeTargetRef.current;
          if (mt) {
            const targetFlower = data.find(f => f.sid === mt.targetSid);
            if (targetFlower) {
              const proximity = 1 - mt.distance / MERGE_RANGE;
              const pulse = 0.3 + 0.2 * Math.sin(performance.now() / 200);
              const alpha = proximity * pulse;
              const ringR = FLOWER_BASE_RADIUS * targetFlower.scale * 0.6 + 12;
              overlay.circle(targetFlower.x, targetFlower.y, ringR);
              overlay.stroke({ color: 0xffffff, width: 2.5, alpha });
              overlay.circle(targetFlower.x, targetFlower.y, ringR + 6);
              overlay.stroke({ color: 0xffffff, width: 1, alpha: alpha * 0.4 });
            }
          }
        }

        // ── Merge glow filter animation (fade intensity 1.0 → 0.0) ──
        const now = performance.now();
        [...mergeGlowFiltersRef.current.entries()].map(([sid, { filter, startTime }]) => {
          const elapsed = now - startTime;
          if (elapsed >= MERGE_GLOW_DURATION) {
            // Remove expired glow filter
            const g = graphics.get(sid);
            if (g) {
              g.filters = ((g.filters ?? []) as Filter[]).filter(f => f !== filter);
            }
            mergeGlowFiltersRef.current.delete(sid);
          } else {
            // Animate intensity down
            const intensity = 1.0 - elapsed / MERGE_GLOW_DURATION;
            filter.resources.mergeGlowUniforms.uniforms.uIntensity = intensity;
          }
          return null;
        });

        // ── Merge particle burst rendering ──
        if (!mergeParticleGfxRef.current && stage) {
          mergeParticleGfxRef.current = new Graphics();
          stage.addChild(mergeParticleGfxRef.current);
        }
        const particleGfx = mergeParticleGfxRef.current;
        if (particleGfx) {
          particleGfx.clear();
          const dt = 1 / 60; // approximate frame delta
          mergeEffectsRef.current = mergeEffectsRef.current
            .filter(effect => effect.active)
            .map(effect => {
              tickMergeEffect(effect, dt);
              effect.particles
                .filter(p => p.life > 0)
                .map(p => {
                  particleGfx.circle(p.x, p.y, 3 * p.scale);
                  particleGfx.fill({ color: p.color, alpha: p.life * 0.8 });
                  return null;
                });
              return effect;
            });
        }
      },
      [onFlowerClick, getPlan],
    );

    useImperativeHandle(ref, () => ({ updateFlowers, setSpecMap, setConstituentMap, setArrangementMetaMap }), [
      updateFlowers,
      setSpecMap,
      setConstituentMap,
      setArrangementMetaMap,
    ]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      // Increase bezier tessellation quality — default 0.5 produces jagged
      // curves at the 70px base radius with dense botanical detail
      GraphicsContextSystem.defaultOptions.bezierSmoothness = 0.85;

      const app = new Application();
      let destroyed = false;

      app
        .init({
          background: 0x0d0d0d,
          resizeTo: el,
          antialias: true,
          resolution: window.devicePixelRatio,
          autoDensity: true,
        })
        .then(() => {
          if (destroyed) {
            app.destroy(true);
            return;
          }
          el.appendChild(app.canvas as HTMLCanvasElement);
          appRef.current = app;
          setCanvasViewport(el.clientWidth, el.clientHeight);

          const flowerContainer = new Container();
          app.stage.addChild(flowerContainer);
          stageContainerRef.current = flowerContainer;

          // Dark fantasy dither on flower layer only — keeps background clean black
          flowerContainer.filters = [createDarkFantasyDitherFilter()];

          // Stage-level drag handlers
          app.stage.eventMode = "static";
          app.stage.hitArea = app.screen;

          app.stage.on("pointermove", (e) => {
            const drag = dragRef.current;
            if (!drag) return;
            const pos = e.global;
            onFlowerDragRef.current?.(drag.sid, pos.x, pos.y);
          });

          const handlePointerUp = () => {
            const drag = dragRef.current;
            if (drag) {
              const g = flowerGraphicsRef.current.get(drag.sid);
              if (g) g.cursor = "grab";

              const mt = mergeTargetRef.current;
              if (mt && mt.dragSid === drag.sid) {
                // Trigger merge glow on target flower
                const targetG = flowerGraphicsRef.current.get(mt.targetSid);
                if (targetG) {
                  const glowFilter = createMergeGlowFilter();
                  const existing = (targetG.filters ?? []) as Filter[];
                  targetG.filters = [...existing, glowFilter];
                  mergeGlowFiltersRef.current.set(mt.targetSid, {
                    filter: glowFilter,
                    startTime: performance.now(),
                  });
                }
                // Spawn merge particle burst at target position
                const targetPos = targetG?.position;
                if (targetPos) {
                  const colorA = fallbackColor(drag.sid);
                  const colorB = fallbackColor(mt.targetSid);
                  mergeEffectsRef.current = [
                    ...mergeEffectsRef.current,
                    createMergeEffect(targetPos.x, targetPos.y, colorA, colorB),
                  ];
                }
                onMergeDropRef.current?.(drag.sid, mt.targetSid);
              } else if (g) {
                onFlowerDragEndRef.current?.(drag.sid, g.position.x, g.position.y);
              }

              dragRef.current = null;
              mergeTargetRef.current = null;
            }
          };

          app.stage.on("pointerup", handlePointerUp);
          app.stage.on("pointerupoutside", handlePointerUp);
        });

      return () => {
        destroyed = true;
        stageContainerRef.current = null;
        flowerGraphicsRef.current.clear();
        auraGraphicsRef.current.clear();
        planCacheRef.current.clear();
        mergeOverlayRef.current = null;
        mergeParticleGfxRef.current = null;
        mergeGlowFiltersRef.current.clear();
        mergeEffectsRef.current = [];
        if (appRef.current) {
          appRef.current.destroy(true);
          appRef.current = null;
        }
      };
    }, []);

    return (
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", overflow: "hidden" }}
      />
    );
  },
);
