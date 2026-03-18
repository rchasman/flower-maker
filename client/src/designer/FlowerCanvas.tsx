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
  selectedId?: number | null;
}

/** Resolve flower color — use spec data if available, fallback to sid hash. */
function resolveColor(flower: FlowerRenderData): number {
  const { petal_color_r: r, petal_color_g: g, petal_color_b: b } = flower;
  if (r + g + b < 0.05) return fallbackColor(flower.sid);
  return colorFromSpec(r, g, b);
}

/** Execute DrawCmd[] on a PixiJS Graphics context, scaled around (0,0). */
function drawCmds(g: Graphics, cmds: readonly DrawCmd[], scale: number): void {
  for (const cmd of cmds) {
    switch (cmd.op) {
      case "M":
        g.moveTo(cmd.x * scale, cmd.y * scale);
        break;
      case "L":
        g.lineTo(cmd.x * scale, cmd.y * scale);
        break;
      case "C":
        g.bezierCurveTo(
          cmd.c1x * scale,
          cmd.c1y * scale,
          cmd.c2x * scale,
          cmd.c2y * scale,
          cmd.x * scale,
          cmd.y * scale,
        );
        break;
      case "Z":
        g.closePath();
        break;
    }
  }
}

/** Draw a flower from its pre-computed plan. */
function drawFlowerFromPlan(
  g: Graphics,
  plan: FlowerPlan,
  r: number,
  alpha: number,
) {
  const scale = r;

  // Sepals (behind everything)
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
    // Filament line
    g.moveTo(0, 0);
    g.lineTo(sx, sy);
    g.stroke({
      color: s.filamentColor,
      width: Math.max(0.3, scale * 0.02),
      alpha: alpha * 0.7,
    });
    // Anther dot
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

  // Pass 2: All leaves
  plan.members.map((member) => {
    member.leaves.map((leaf) => {
      drawCmds(g, leaf.cmds, scale);
      g.fill({ color: leaf.color, alpha: alpha * 0.85 });
      return null;
    });
    return null;
  });

  // Pass 3: Flower heads (back to front — hero last so it's on top)
  [...plan.members].reverse().map((member) => {
    const flowerScale = scale * member.scale;
    const ox = member.offsetX * scale;
    const oy = member.offsetY * scale;

    // Translate to flower head position for drawing
    // Save current transform by offsetting all draw commands
    const offsetPlan: FlowerPlan = {
      sepals: member.flowerPlan.sepals.map((s) => ({
        cmds: s.cmds.map((cmd) => offsetCmd(cmd, ox, oy)),
        color: s.color,
      })),
      layers: member.flowerPlan.layers.map((l) => ({
        petals: l.petals.map((p) => ({
          cmds: p.cmds.map((cmd) => offsetCmd(cmd, ox, oy)),
        })),
        color: l.color,
        opacity: l.opacity,
      })),
      center: {
        ...member.flowerPlan.center,
        stamens: member.flowerPlan.center.stamens.map((s) => ({ ...s })),
      },
    };

    // Draw sepals
    offsetPlan.sepals.map((sepal) => {
      drawCmds(g, sepal.cmds, flowerScale);
      g.fill({ color: sepal.color, alpha: alpha * 0.85 });
      return null;
    });

    // Petal layers
    offsetPlan.layers.map((layer) => {
      layer.petals.map((petal) => {
        drawCmds(g, petal.cmds, flowerScale);
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

const FLOWER_BASE_RADIUS = 14;
const SELECTION_RING_PAD = 6;

export const FlowerCanvas = forwardRef<FlowerCanvasHandle, FlowerCanvasProps>(
  function FlowerCanvas(
    { onFlowerClick, onFlowerDrag, onFlowerDragEnd, selectedId },
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

    // Spec map, constituent map, and cached plans
    const specMapRef = useRef<Map<number, string>>(new Map());
    const constituentMapRef = useRef<Map<number, ConstituentEntry[]>>(new Map());
    const planCacheRef = useRef<Map<number, { key: string; plan: FlowerPlan | ArrangementPlan; isArrangement: boolean }>>(new Map());

    // Keep refs in sync without re-running effects
    selectedIdRef.current = selectedId;
    onFlowerDragRef.current = onFlowerDrag;
    onFlowerDragEndRef.current = onFlowerDragEnd;

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

          // Arrangements need a bigger hit area
          const hitRadius = isArrangement ? r * 2.5 : r * 1.3;
          g.hitArea = new Circle(0, 0, hitRadius);

          g.clear();

          // Selection ring
          const isSelected = selectedIdRef.current === flower.sid;
          if (isSelected) {
            const ringR = isArrangement ? r * 2.0 + SELECTION_RING_PAD : r * 1.1 + SELECTION_RING_PAD;
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

          app.stage.on("pointerup", () => {
            const drag = dragRef.current;
            if (drag) {
              const g = flowerGraphicsRef.current.get(drag.sid);
              if (g) {
                g.cursor = "grab";
                onFlowerDragEndRef.current?.(drag.sid, g.position.x, g.position.y);
              }
              dragRef.current = null;
            }
          });

          app.stage.on("pointerupoutside", () => {
            const drag = dragRef.current;
            if (drag) {
              const g = flowerGraphicsRef.current.get(drag.sid);
              if (g) {
                g.cursor = "grab";
                onFlowerDragEndRef.current?.(drag.sid, g.position.x, g.position.y);
              }
              dragRef.current = null;
            }
          });
        });

      return () => {
        destroyed = true;
        stageContainerRef.current = null;
        flowerGraphicsRef.current.clear();
        planCacheRef.current.clear();
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
