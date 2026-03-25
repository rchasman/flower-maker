import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { Application, Graphics, Container, Circle, Filter, GraphicsContextSystem } from "pixi.js";
import type { FlowerRenderData } from "../wasm/loop.ts";
import {
  fallbackColor,
  colorFromSpec,
  createFlowerPlan,
  createArrangementPlan,
  type FlowerPlan,
  type ArrangementPlan,
  type ArrangementMeta,
} from "../flower/render.ts";
import {
  drawAura,
  drawFlowerFromPlan,
  drawArrangementFromPlan,
} from "../flower/pixi-draw.ts";
import { setCanvasViewport, getCanvasViewport } from "../spacetime/bridge.ts";
import { createMergeGlowFilter, createDarkFantasyDitherFilter } from "../canvas/shaders.ts";
import { createMergeEffect, tickMergeEffect, type MergeEffectState } from "../canvas/MergeEffect.ts";

export type ConstituentEntry = { specJson: string; sid: number };

export interface FlowerCanvasHandle {
  /** Push new render data each frame from the WASM loop. Pool is reused; only first `count` entries are valid. */
  updateFlowers(pool: FlowerRenderData[], count: number): void;
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

// ── Module-scope constants (hoisted from hot loops) ──
const MERGE_GLOW_DURATION = 2000;


const FRAME_DT = 1 / 60;
const FLOWER_BASE_RADIUS = 70;
const SELECTION_RING_PAD = 6;
const MERGE_RANGE = FLOWER_BASE_RADIUS * 3;
const DRAG_THRESHOLD = 8; // px movement before click becomes drag
const BLOOM_DURATION = 500;
const BLOOM_SENTINEL_WINDOW = 2000;
const SHAKE_DURATION = 200;
const CONNECTOR_SEGMENTS = 8;
const CONNECTOR_DASH_INDICES = Array.from({ length: CONNECTOR_SEGMENTS / 2 }, (_, i) => i * 2);

// ── Module-level reusable Set for hot-path sid tracking (zero per-frame allocation) ──
const _activeSids = new Set<number>();

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
    const dragRef = useRef<{ sid: number; started: boolean; originX: number; originY: number } | null>(null);
    const onFlowerClickRef = useRef(onFlowerClick);
    const onFlowerDragRef = useRef(onFlowerDrag);
    const onFlowerDragEndRef = useRef(onFlowerDragEnd);
    const onMergeDropRef = useRef(onMergeDrop);
    const mergeTargetRef = useRef<{ dragSid: number; targetSid: number; distance: number } | null>(null);
    const mergeOverlayRef = useRef<Graphics | null>(null);
    const mergeOverlayOpacityRef = useRef(0);
    const mergeBloomRef = useRef<Map<number, number>>(new Map()); // sid → startTime

    // Aura graphics — separate from flower graphics to avoid bounding-box artifacts
    const auraGraphicsRef = useRef<Map<number, Graphics>>(new Map());

    // Shader filter refs
    const mergeGlowFiltersRef = useRef<Map<number, { filter: Filter; startTime: number }>>(new Map());
    const mergeEffectsRef = useRef<MergeEffectState[]>([]);
    const mergeParticleGfxRef = useRef<Graphics | null>(null);
    const resizeObsRef = useRef<ResizeObserver | null>(null);

    // Spec map, constituent map, arrangement meta, and cached plans
    const specMapRef = useRef<Map<number, string>>(new Map());
    const constituentMapRef = useRef<Map<number, ConstituentEntry[]>>(new Map());
    const arrangementMetaMapRef = useRef<Map<number, ArrangementMeta>>(new Map());
    const planCacheRef = useRef<Map<number, { key: string; plan: FlowerPlan | ArrangementPlan; isArrangement: boolean }>>(new Map());

    // Keep refs in sync without re-running effects
    selectedIdRef.current = selectedId;
    onFlowerClickRef.current = onFlowerClick;
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
      (pool: FlowerRenderData[], count: number) => {
        const stage = stageContainerRef.current;
        if (!stage) return;

        const graphics = flowerGraphicsRef.current;

        _activeSids.clear();
        for (let i = 0; i < count; i++) _activeSids.add(pool[i]!.sid);

        // Remove flowers no longer present — direct Map iteration, no intermediate array
        const auras = auraGraphicsRef.current;
        graphics.forEach((g, sid) => {
          if (_activeSids.has(sid)) return;
          stage.removeChild(g);
          g.destroy();
          graphics.delete(sid);
          planCacheRef.current.delete(sid);
          const ag = auras.get(sid);
          if (ag) { stage.removeChild(ag); ag.destroy(); auras.delete(sid); }
        });

        // Update or create flower graphics
        for (let fi = 0; fi < count; fi++) {
          const flower = pool[fi]!;
          let g = graphics.get(flower.sid);
          if (!g) {
            g = new Graphics();
            g.eventMode = "static";
            g.cursor = "grab";
            const sid = flower.sid;
            g.on("pointerdown", (e) => {
              dragRef.current = { sid, started: false, originX: e.global.x, originY: e.global.y };
              e.stopPropagation();
            });
            g.on("pointerup", () => {
              g!.cursor = "grab";
            });
            graphics.set(flower.sid, g);
            stage.addChild(g);

            const bloomSentinel = mergeBloomRef.current.get(-1);
            if (bloomSentinel && performance.now() - bloomSentinel < BLOOM_SENTINEL_WINDOW) {
              mergeBloomRef.current.delete(-1);
              mergeBloomRef.current.set(flower.sid, performance.now());
            }
          }

          // Enforce minimums so specless/new flowers are visible and clickable
          const r = FLOWER_BASE_RADIUS * Math.max(flower.scale, 0.5);
          const alpha = Math.max(flower.alpha, 0.6);
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
              drawAura(ag, flowerPlan, r, alpha);
            } else {
              // Fallback glow
              ag.circle(0, 0, r + 4);
              ag.fill({ color: liveColor, alpha: 0.15 * alpha });
            }
            ag.position.set(flower.x, flower.y);
            ag.rotation = flower.rotation;
          } else if (ag) {
            ag.clear();
          }

          // Draw the flower or arrangement from its spec-driven plan
          if (isArrangement) {
            drawArrangementFromPlan(g, plan as ArrangementPlan, r, alpha);
          } else {
            drawFlowerFromPlan(g, plan as FlowerPlan, r, alpha);
          }

          g.position.set(flower.x, flower.y);
          g.rotation = flower.rotation;

          const bloomStart = mergeBloomRef.current.get(flower.sid);
          if (bloomStart) {
            const elapsed = performance.now() - bloomStart;
            if (elapsed < BLOOM_DURATION) {
              const progress = elapsed / BLOOM_DURATION;
              const bloomScale = 1 + 0.15 * Math.sin(progress * Math.PI) * (1 - progress * 0.5);
              g.scale.set(bloomScale);
            } else {
              g.scale.set(1);
              mergeBloomRef.current.delete(flower.sid);
            }
          }

        }

        // ── Merge proximity detection (only when actively dragging) ──
        const drag = dragRef.current;
        let draggedFlower: FlowerRenderData | null = null;
        if (drag?.started) {
          for (let i = 0; i < count; i++) { if (pool[i]!.sid === drag.sid) { draggedFlower = pool[i]!; break; } }
        }
        if (drag?.started && draggedFlower) {
          // Single pass nearest-neighbor — no intermediate arrays
          let nearestSid = -1;
          let nearestDist = MERGE_RANGE;
          for (let i = 0; i < count; i++) {
            const f = pool[i]!;
            if (f.sid === draggedFlower.sid) continue;
            const dist = Math.hypot(f.x - draggedFlower.x, f.y - draggedFlower.y);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestSid = f.sid;
            }
          }

          mergeTargetRef.current = nearestSid >= 0
            ? { dragSid: draggedFlower.sid, targetSid: nearestSid, distance: nearestDist }
            : null;

          const g = flowerGraphicsRef.current.get(drag.sid);
          if (g) g.cursor = mergeTargetRef.current ? "cell" : "grabbing";
        } else {
          mergeTargetRef.current = null;
        }

        // ── Merge overlay ring (smooth opacity lerp) ──
        const targetOpacity = mergeTargetRef.current ? 1 : 0;
        const lerpSpeed = targetOpacity > 0 ? 8.0 : 12.0; // faster fade-out
        mergeOverlayOpacityRef.current += (targetOpacity - mergeOverlayOpacityRef.current) * Math.min(1, lerpSpeed * FRAME_DT);
        if (mergeOverlayOpacityRef.current < 0.01) mergeOverlayOpacityRef.current = 0;

        if (!mergeOverlayRef.current && stage) {
          mergeOverlayRef.current = new Graphics();
          stage.addChild(mergeOverlayRef.current);
        }
        const overlay = mergeOverlayRef.current;
        if (overlay) {
          overlay.clear();
          const mt = mergeTargetRef.current;
          if (mt && mergeOverlayOpacityRef.current > 0) {
            let targetFlower: FlowerRenderData | undefined;
            for (let i = 0; i < count; i++) { if (pool[i]!.sid === mt.targetSid) { targetFlower = pool[i]!; break; } }
            if (targetFlower) {
              const proximity = 1 - mt.distance / MERGE_RANGE;
              const pulse = 0.3 + 0.2 * Math.sin(performance.now() / 200);
              const baseAlpha = proximity * pulse;
              const alpha = baseAlpha * mergeOverlayOpacityRef.current;
              const ringR = FLOWER_BASE_RADIUS * targetFlower.scale * 0.6 + 12;
              overlay.circle(targetFlower.x, targetFlower.y, ringR);
              overlay.stroke({ color: 0xffffff, width: 2.5, alpha });
              overlay.circle(targetFlower.x, targetFlower.y, ringR + 6);
              overlay.stroke({ color: 0xffffff, width: 1, alpha: alpha * 0.4 });

              if (draggedFlower) {
                for (let ci = 0; ci < CONNECTOR_DASH_INDICES.length; ci++) {
                    const idx = CONNECTOR_DASH_INDICES[ci]!;
                    const t0 = idx / CONNECTOR_SEGMENTS;
                    const t1 = (idx + 1) / CONNECTOR_SEGMENTS;
                    const x0 = draggedFlower.x + (targetFlower.x - draggedFlower.x) * t0;
                    const y0 = draggedFlower.y + (targetFlower.y - draggedFlower.y) * t0;
                    const x1 = draggedFlower.x + (targetFlower.x - draggedFlower.x) * t1;
                    const y1 = draggedFlower.y + (targetFlower.y - draggedFlower.y) * t1;
                    overlay.moveTo(x0, y0);
                    overlay.lineTo(x1, y1);
                    overlay.stroke({ color: 0xc4b5fd, width: 1, alpha: alpha * 0.5 });
                  }
              }
            }
          }
        }

        // ── Merge glow filter animation (fade intensity 1.0 → 0.0) ──
        const now = performance.now();
        mergeGlowFiltersRef.current.forEach(({ filter, startTime }, sid) => {
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
        });

        // ── Merge particle burst rendering ──
        if (!mergeParticleGfxRef.current && stage) {
          mergeParticleGfxRef.current = new Graphics();
          stage.addChild(mergeParticleGfxRef.current);
        }
        const particleGfx = mergeParticleGfxRef.current;
        if (particleGfx) {
          particleGfx.clear();
          // In-place compaction — no intermediate arrays
          let writeIdx = 0;
          const effects = mergeEffectsRef.current;
          for (let i = 0; i < effects.length; i++) {
            const effect = effects[i]!;
            if (!effect.active) continue;
            tickMergeEffect(effect, FRAME_DT);
            const particles = effect.particles;
            for (let j = 0; j < particles.length; j++) {
              const p = particles[j]!;
              if (p.life <= 0) continue;
              particleGfx.circle(p.x, p.y, 3 * p.scale);
              particleGfx.fill({ color: p.color, alpha: p.life * 0.8 });
            }
            effects[writeIdx++] = effect!;
          }
          effects.length = writeIdx;
        }
      },
      [getPlan],
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

          // Watch for container resize (e.g., sidebar collapse)
          const resizeObs = new ResizeObserver(() => {
            const width = el.clientWidth;
            const height = el.clientHeight;
            if (width > 0 && height > 0) {
              setCanvasViewport(width, height);
              app.stage.hitArea = app.screen;
            }
          });
          resizeObs.observe(el);
          resizeObsRef.current = resizeObs;

          app.stage.on("pointermove", (e) => {
            const drag = dragRef.current;
            if (!drag) return;
            const pos = e.global;

            // Promote to real drag only after moving past threshold
            if (!drag.started) {
              const dx = pos.x - drag.originX;
              const dy = pos.y - drag.originY;
              if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
              drag.started = true;
              const g = flowerGraphicsRef.current.get(drag.sid);
              if (g) g.cursor = "grabbing";
            }

            onFlowerDragRef.current?.(drag.sid, pos.x, pos.y);
          });

          const handlePointerUp = () => {
            const drag = dragRef.current;
            if (drag) {
              const g = flowerGraphicsRef.current.get(drag.sid);
              if (g) g.cursor = "grab";

              // Click (no drag) — select the flower, don't merge
              if (!drag.started) {
                onFlowerClickRef.current?.(drag.sid);
                dragRef.current = null;
                mergeTargetRef.current = null;
                return;
              }

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

                mergeBloomRef.current.set(-1, performance.now());

                const shakeStage = stageContainerRef.current;
                if (shakeStage) {
                  const origX = shakeStage.position.x;
                  const origY = shakeStage.position.y;
                  const shakeStart = performance.now();
                  const shakeFrame = () => {
                    const elapsed = performance.now() - shakeStart;
                    if (elapsed < SHAKE_DURATION) {
                      const intensity = 2 * (1 - elapsed / SHAKE_DURATION);
                      shakeStage.position.set(
                        origX + (Math.random() - 0.5) * intensity * 2,
                        origY + (Math.random() - 0.5) * intensity * 2,
                      );
                      requestAnimationFrame(shakeFrame);
                    } else {
                      shakeStage.position.set(origX, origY);
                    }
                  };
                  requestAnimationFrame(shakeFrame);
                }
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
        resizeObsRef.current?.disconnect();
        resizeObsRef.current = null;
        stageContainerRef.current = null;
        flowerGraphicsRef.current.clear();
        auraGraphicsRef.current.clear();
        planCacheRef.current.clear();
        mergeOverlayRef.current = null;
        mergeBloomRef.current.clear();
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
