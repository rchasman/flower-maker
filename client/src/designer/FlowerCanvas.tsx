import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { Application, Graphics, Container } from "pixi.js";
import type { FlowerRenderData } from "../wasm/loop.ts";

export interface FlowerCanvasHandle {
  /** Push new render data each frame from the WASM loop. */
  updateFlowers(data: FlowerRenderData[]): void;
}

interface FlowerCanvasProps {
  onFlowerClick?: (sid: number) => void;
  selectedId?: number | null;
}

/** Petal color per session id — deterministic from sid. */
function flowerColor(sid: number): number {
  const hues = [0xff6b9d, 0xc084fc, 0x67e8f9, 0xfbbf24, 0x4ade80, 0xf87171, 0xa78bfa, 0x38bdf8];
  return hues[sid % hues.length]!;
}

const FLOWER_BASE_RADIUS = 14;
const SELECTION_RING_PAD = 6;

export const FlowerCanvas = forwardRef<FlowerCanvasHandle, FlowerCanvasProps>(
  function FlowerCanvas({ onFlowerClick, selectedId }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<Application | null>(null);
    const flowerGraphicsRef = useRef<Map<number, Graphics>>(new Map());
    const stageContainerRef = useRef<Container | null>(null);
    const selectedIdRef = useRef(selectedId);

    // Keep selectedId ref in sync without re-running effects
    selectedIdRef.current = selectedId;

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
          g.cursor = "pointer";
          const sid = flower.sid;
          g.on("pointerdown", () => onFlowerClick?.(sid));
          graphics.set(flower.sid, g);
          stage.addChild(g);
        }

        const color = flowerColor(flower.sid);
        const r = FLOWER_BASE_RADIUS * flower.scale;
        const isSelected = selectedIdRef.current === flower.sid;

        g.clear();

        // Selection ring
        if (isSelected) {
          g.circle(0, 0, r + SELECTION_RING_PAD);
          g.stroke({ color: 0xffffff, width: 2, alpha: 0.7 });
        }

        // Aura glow
        if (flower.has_glow || flower.has_aura) {
          g.circle(0, 0, r + 4);
          g.fill({ color, alpha: 0.15 * flower.alpha });
        }

        // Flower body
        g.circle(0, 0, r);
        g.fill({ color, alpha: flower.alpha });

        // Center dot
        g.circle(0, 0, r * 0.3);
        g.fill({ color: 0xfefce8, alpha: flower.alpha * 0.9 });

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
