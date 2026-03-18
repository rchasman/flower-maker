import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { Application, Graphics, Container, Circle } from "pixi.js";
import type { FlowerRenderData } from "../wasm/loop.ts";

export interface FlowerCanvasHandle {
  /** Push new render data each frame from the WASM loop. */
  updateFlowers(data: FlowerRenderData[]): void;
}

interface FlowerCanvasProps {
  onFlowerClick?: (sid: number) => void;
  onFlowerDrag?: (sid: number, x: number, y: number) => void;
  onFlowerDragEnd?: (sid: number) => void;
  selectedId?: number | null;
}

/** Deterministic hash from sid — yields a float in [0, 1). */
function sidHash(sid: number, salt: number): number {
  const n = Math.sin(sid * 9301 + salt * 4973) * 49297;
  return n - Math.floor(n);
}

/** Convert 0.0–1.0 RGB floats to a PixiJS hex color number. */
function colorFromSpec(r: number, g: number, b: number): number {
  const ri = Math.round(Math.max(0, Math.min(1, r)) * 255);
  const gi = Math.round(Math.max(0, Math.min(1, g)) * 255);
  const bi = Math.round(Math.max(0, Math.min(1, b)) * 255);
  return (ri << 16) | (gi << 8) | bi;
}

/** Fallback palette when spec colors are default/zero. */
function fallbackColor(sid: number): number {
  const hues = [0xff6b9d, 0xc084fc, 0x67e8f9, 0xfbbf24, 0x4ade80, 0xf87171, 0xa78bfa, 0x38bdf8];
  return hues[sid % hues.length]!;
}

/** Resolve flower color — use spec data if available, fallback to sid hash. */
function resolveColor(flower: FlowerRenderData): number {
  const { petal_color_r: r, petal_color_g: g, petal_color_b: b } = flower;
  // Treat all-zero or very dark as "no color data"
  if (r + g + b < 0.05) return fallbackColor(flower.sid);
  return colorFromSpec(r, g, b);
}

/** Darken a hex color by a factor (0–1, where 0 = black). */
function darkenColor(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

/** Flower shape parameters — uses spec petal_count, sid-hash for proportions. */
function flowerShape(sid: number, specPetalCount: number) {
  const petalCount = specPetalCount > 0 ? specPetalCount : 5 + Math.floor(sidHash(sid, 1) * 3);
  const petalLength = 0.75 + sidHash(sid, 2) * 0.35;
  const petalWidth = 0.28 + sidHash(sid, 3) * 0.18;
  const petalTaper = 0.6 + sidHash(sid, 4) * 0.3;
  const rotationOffset = sidHash(sid, 5) * Math.PI * 2;
  return { petalCount, petalLength, petalWidth, petalTaper, rotationOffset };
}

/** Draw a single flower head at (0, 0) on the graphics context. */
function drawFlowerHead(
  g: Graphics,
  color: number,
  r: number,
  alpha: number,
  shape: ReturnType<typeof flowerShape>,
) {
  const angleStep = (Math.PI * 2) / shape.petalCount;
  const petalLen = r * shape.petalLength;
  const petalW = r * shape.petalWidth;
  const petalColor = darkenColor(color, 0.88);

  Array.from({ length: shape.petalCount }, (_, i) => {
    const angle = shape.rotationOffset + i * angleStep;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const cx = cos * petalLen * 0.55;
    const cy = sin * petalLen * 0.55;
    const tx = cos * petalLen;
    const ty = sin * petalLen;
    const px = -sin * petalW;
    const py = cos * petalW;
    const tpx = -sin * petalW * shape.petalTaper;
    const tpy = cos * petalW * shape.petalTaper;

    // Outer petal
    g.moveTo(px * 0.3, py * 0.3);
    g.quadraticCurveTo(cx + px, cy + py, tx + tpx, ty + tpy);
    g.quadraticCurveTo(cx - px, cy - py, -px * 0.3, -py * 0.3);
    g.closePath();
    g.fill({ color: petalColor, alpha: alpha * 0.85 });

    // Inner petal layer
    const innerLen = petalLen * 0.7;
    const innerW = petalW * 0.6;
    const icx = cos * innerLen * 0.5;
    const icy = sin * innerLen * 0.5;
    const itx = cos * innerLen;
    const ity = sin * innerLen;
    const ipx = -sin * innerW;
    const ipy = cos * innerW;

    g.moveTo(ipx * 0.2, ipy * 0.2);
    g.quadraticCurveTo(icx + ipx, icy + ipy, itx, ity);
    g.quadraticCurveTo(icx - ipx, icy - ipy, -ipx * 0.2, -ipy * 0.2);
    g.closePath();
    g.fill({ color, alpha: alpha * 0.9 });

    return i;
  });

  // Center disc (pistil)
  const pistilColor = darkenColor(color, 0.45);
  const pistilR = r * 0.28;
  g.circle(0, 0, pistilR);
  g.fill({ color: pistilColor, alpha });

  // Pistil highlight
  g.circle(0, 0, pistilR * 0.5);
  g.fill({ color: 0xfefce8, alpha: alpha * 0.6 });
}

const FLOWER_BASE_RADIUS = 14;
const SELECTION_RING_PAD = 6;

export const FlowerCanvas = forwardRef<FlowerCanvasHandle, FlowerCanvasProps>(
  function FlowerCanvas({ onFlowerClick, onFlowerDrag, onFlowerDragEnd, selectedId }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const flowerGraphicsRef = useRef<Map<number, Graphics>>(new Map());
    const stageContainerRef = useRef<Container | null>(null);
    const selectedIdRef = useRef(selectedId);
    const dragRef = useRef<{ sid: number } | null>(null);
    const onFlowerDragRef = useRef(onFlowerDrag);
    const onFlowerDragEndRef = useRef(onFlowerDragEnd);

    // Keep refs in sync without re-running effects
    selectedIdRef.current = selectedId;
    onFlowerDragRef.current = onFlowerDrag;
    onFlowerDragEndRef.current = onFlowerDragEnd;

    const updateFlowers = useCallback((data: FlowerRenderData[]) => {
      const stage = stageContainerRef.current;
      if (!stage) return;

      const graphics = flowerGraphicsRef.current;
      const activeSids = new Set(data.map(d => d.sid));

      // Remove flowers no longer present
      [...graphics.entries()]
        .filter(([sid]) => !activeSids.has(sid))
        .map(([sid, g]) => {
          stage.removeChild(g);
          g.destroy();
          graphics.delete(sid);
          return sid;
        });

      // Update or create flower graphics
      data.map(flower => {
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

        const color = resolveColor(flower);
        const r = FLOWER_BASE_RADIUS * flower.scale;
        const isSelected = selectedIdRef.current === flower.sid;
        const shape = flowerShape(flower.sid, flower.petal_count);

        // Update hit area
        const hitRadius = r * shape.petalLength * 1.5;
        g.hitArea = new Circle(0, 0, hitRadius);

        g.clear();

        // Selection ring
        if (isSelected) {
          g.circle(0, 0, r * shape.petalLength + SELECTION_RING_PAD);
          g.stroke({ color: 0xffffff, width: 2, alpha: 0.7 });
        }

        // Aura glow
        if (flower.has_glow || flower.has_aura) {
          g.circle(0, 0, r + 4);
          g.fill({ color, alpha: 0.15 * flower.alpha });
        }

        // Draw the flower head at origin
        drawFlowerHead(g, color, r, flower.alpha, shape);

        g.position.set(flower.x, flower.y);
        g.rotation = flower.rotation;

        return flower.sid;
      });
    }, [onFlowerClick]);

    useImperativeHandle(ref, () => ({ updateFlowers }), [updateFlowers]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const app = new Application();
      let destroyed = false;

      app.init({
        background: 0x0d0d0d,
        resizeTo: el,
        antialias: true,
        resolution: window.devicePixelRatio,
        autoDensity: true,
      }).then(() => {
        if (destroyed) {
          app.destroy(true);
          return;
        }
        el.appendChild(app.canvas as HTMLCanvasElement);
        appRef.current = app;

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
            if (g) g.cursor = "grab";
            onFlowerDragEndRef.current?.(drag.sid);
            dragRef.current = null;
          }
        });

        app.stage.on("pointerupoutside", () => {
          const drag = dragRef.current;
          if (drag) {
            const g = flowerGraphicsRef.current.get(drag.sid);
            if (g) g.cursor = "grab";
            onFlowerDragEndRef.current?.(drag.sid);
            dragRef.current = null;
          }
        });
      });

      return () => {
        destroyed = true;
        stageContainerRef.current = null;
        flowerGraphicsRef.current.clear();
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
