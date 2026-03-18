import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { Application, Graphics, Container, Circle } from "pixi.js";
import type { FlowerRenderData } from "../wasm/loop.ts";
import {
  sidHash,
  fallbackColor,
  colorFromSpec,
  darkenColor,
  createFlowerPlan,
  createArrangementPlan,
  type FlowerPlan,
  type ArrangementPlan,
  type AdornmentPlan,
  type DrawCmd,
} from "../flower/render.ts";
import { setCanvasViewport, getCanvasViewport } from "../spacetime/bridge.ts";

export type ConstituentEntry = { specJson: string; sid: number };

export interface FlowerCanvasHandle {
  /** Push new render data each frame from the WASM loop. */
  updateFlowers(data: FlowerRenderData[]): void;
  /** Update the spec map (sid → specJson) — call when specs change. */
  setSpecMap(specs: Map<number, string>): void;
  /** Update the constituent map (sid → array of constituent specs) for arrangements. */
  setConstituentMap(constituents: Map<number, ConstituentEntry[]>): void;
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

/** Draw a flower from its pre-computed plan (stem, leaves, then head). */
function drawFlowerFromPlan(
  g: Graphics,
  plan: FlowerPlan,
  r: number,
  alpha: number,
) {
  const scale = r;

  // Stem (behind everything)
  if (plan.stem) {
    drawCmds(g, plan.stem.cmds, scale);
    g.fill({ color: plan.stem.color, alpha: alpha * 0.9 });
  }

  // Leaves
  plan.leaves.map((leaf) => {
    // Fill
    drawCmds(g, leaf.cmds, scale);
    g.fill({ color: leaf.color, alpha: alpha * 0.9 });
    // Veins (midrib + side veins)
    drawCmds(g, leaf.veins, scale);
    g.stroke({ color: darkenColor(leaf.color, 0.55), width: Math.max(0.4, scale * 0.012), alpha: alpha * 0.6 });
    return null;
  });

  // Sepals
  plan.sepals.map((sepal) => {
    drawCmds(g, sepal.cmds, scale);
    g.fill({ color: sepal.color, alpha: alpha * 0.85 });
    return null;
  });

  // Petal layers (outer first = behind, inner last = on top)
  plan.layers.map((layer) => {
    layer.petals.map((petal) => {
      drawCmds(g, petal.cmds, scale);
      g.fill({ color: layer.color, alpha: alpha * layer.opacity });
      return null;
    });
    return null;
  });

  // Stamens
  plan.center.stamens.map((s) => {
    const sx = Math.cos(s.angle) * s.length * scale;
    const sy = Math.sin(s.angle) * s.length * scale;
    g.moveTo(0, 0);
    g.lineTo(sx, sy);
    g.stroke({
      color: s.filamentColor,
      width: Math.max(0.3, scale * 0.02),
      alpha: alpha * 0.7,
    });
    g.circle(sx, sy, s.antherRadius * scale);
    g.fill({ color: s.antherColor, alpha });
    return null;
  });

  // Center disc (pistil)
  g.circle(0, 0, plan.center.discRadius * scale);
  g.fill({ color: plan.center.discColor, alpha });

  // Pistil highlight
  g.circle(0, 0, plan.center.highlightRadius * scale);
  g.fill({ color: plan.center.highlightColor, alpha: alpha * 0.6 });
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
      return null;
    });
    return null;
  });

  // Pass 3: Flower heads (back to front — hero last so it's on top)
  // Each head is drawn at scale * member.scale, offset to its pixel position.
  // offset = member.offset * scale (pixel space), applied AFTER scaling coords.
  [...plan.members].reverse().map((member) => {
    const flowerScale = scale * member.scale;
    const ox = member.offsetX * scale;
    const oy = member.offsetY * scale;

    // Sepals
    member.flowerPlan.sepals.map((sepal) => {
      drawCmds(g, sepal.cmds, flowerScale, ox, oy);
      g.fill({ color: sepal.color, alpha: alpha * 0.85 });
      return null;
    });

    // Petal layers
    member.flowerPlan.layers.map((layer) => {
      layer.petals.map((petal) => {
        drawCmds(g, petal.cmds, flowerScale, ox, oy);
        g.fill({ color: layer.color, alpha: alpha * layer.opacity });
        return null;
      });
      return null;
    });

    // Stamens
    member.flowerPlan.center.stamens.map((s) => {
      const sx = ox + Math.cos(s.angle) * s.length * flowerScale;
      const sy = oy + Math.sin(s.angle) * s.length * flowerScale;
      g.moveTo(ox, oy);
      g.lineTo(sx, sy);
      g.stroke({
        color: s.filamentColor,
        width: Math.max(0.3, flowerScale * 0.02),
        alpha: alpha * 0.7,
      });
      g.circle(sx, sy, s.antherRadius * flowerScale);
      g.fill({ color: s.antherColor, alpha });
      return null;
    });

    // Center disc
    g.circle(ox, oy, member.flowerPlan.center.discRadius * flowerScale);
    g.fill({ color: member.flowerPlan.center.discColor, alpha });
    g.circle(ox, oy, member.flowerPlan.center.highlightRadius * flowerScale);
    g.fill({ color: member.flowerPlan.center.highlightColor, alpha: alpha * 0.6 });

    return null;
  });
}

const FLOWER_BASE_RADIUS = 90;
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

    // Spec map, constituent map, and cached plans
    const specMapRef = useRef<Map<number, string>>(new Map());
    const constituentMapRef = useRef<Map<number, ConstituentEntry[]>>(new Map());
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
      const isArrangement = !!constituents && constituents.length > 1;

      // Cache key includes constituent count so arrangement changes invalidate
      const cacheKey = isArrangement
        ? `arr:${constituents.length}:${constituents.map(c => c.specJson).join("|")}`
        : specJson;

      const cached = planCacheRef.current.get(sid);
      if (cached && cached.key === cacheKey) {
        return { plan: cached.plan, isArrangement: cached.isArrangement };
      }

      // Cache miss — recompute
      if (isArrangement) {
        const plan = createArrangementPlan(constituents, Math.min(7, Math.ceil(constituents.length / 3)));
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

    const updateFlowers = useCallback(
      (data: FlowerRenderData[]) => {
        const stage = stageContainerRef.current;
        if (!stage) return;

        const graphics = flowerGraphicsRef.current;
        const activeSids = new Set(data.map((d) => d.sid));

        // Remove flowers no longer present
        [...graphics.entries()]
          .filter(([sid]) => !activeSids.has(sid))
          .map(([sid, g]) => {
            stage.removeChild(g);
            g.destroy();
            graphics.delete(sid);
            planCacheRef.current.delete(sid);
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

          // Aura glow
          if (flower.has_glow || flower.has_aura) {
            g.circle(0, 0, r + 4);
            g.fill({ color: liveColor, alpha: 0.15 * flower.alpha });
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
      },
      [onFlowerClick, getPlan],
    );

    useImperativeHandle(ref, () => ({ updateFlowers, setSpecMap, setConstituentMap }), [
      updateFlowers,
      setSpecMap,
      setConstituentMap,
    ]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

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
        planCacheRef.current.clear();
        mergeOverlayRef.current = null;
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
