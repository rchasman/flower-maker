/**
 * PixiJS-based mini canvas for zone previews.
 *
 * Uses the same drawing functions and dither shader as the designer canvas
 * so previews are pixel-identical to the full editor.
 */

import { useRef, useEffect, useMemo } from "react";
import { Application, Graphics, Container, GraphicsContextSystem } from "pixi.js";
import {
  createFlowerPlan,
  createArrangementPlan,
  type ArrangementMeta,
} from "../flower/render.ts";
import {
  drawFlowerFromPlan,
  drawArrangementFromPlan,
} from "../flower/pixi-draw.ts";
import { createDarkFantasyDitherFilter } from "../canvas/shaders.ts";
import type { FlowerSession, FlowerSpec } from "../spacetime/types.ts";

interface PixiMiniCanvasProps {
  sessions: readonly FlowerSession[];
  specBySessionId: Map<string, FlowerSpec>;
  constituentMap: Map<string, Array<{ specJson: string; sid: number }>>;
  arrangementMetaMap: Map<string, ArrangementMeta>;
}

const PREVIEW_FLOWER_RADIUS = 70;

export function PixiMiniCanvas({
  sessions,
  specBySessionId,
  constituentMap,
  arrangementMetaMap,
}: PixiMiniCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const stageContainerRef = useRef<Container | null>(null);

  // Stable key for data changes — triggers redraw
  const dataKey = useMemo(() => {
    const specKeys = sessions.map(s => {
      const key = String(s.id);
      const spec = specBySessionId.get(key)?.specJson ?? "";
      const constituents = constituentMap.get(key);
      const meta = arrangementMetaMap.get(key);
      return `${key}:${spec}:${constituents?.length ?? 0}:${meta ? "m" : ""}`;
    });
    return specKeys.join("|");
  }, [sessions, specBySessionId, constituentMap, arrangementMetaMap]);

  // Initialize PixiJS app once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

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

        const flowerContainer = new Container();
        app.stage.addChild(flowerContainer);
        stageContainerRef.current = flowerContainer;

        // Same dither shader as the designer
        flowerContainer.filters = [createDarkFantasyDitherFilter()];
      });

    return () => {
      destroyed = true;
      stageContainerRef.current = null;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, []);

  // Redraw flowers when data changes
  useEffect(() => {
    const stage = stageContainerRef.current;
    if (!stage) return;

    // Clear previous content
    stage.removeChildren();

    if (sessions.length === 0) return;

    // Resolve positions
    const positions = sessions.map(s => ({
      sid: Number(s.id),
      sessionKey: String(s.id),
      x: Number(s.canvasX) || 0,
      y: Number(s.canvasY) || 0,
    }));

    const allZero = positions.every(p => p.x === 0 && p.y === 0);
    const resolved = allZero
      ? positions.map((p, i) => {
          const cols = Math.max(1, Math.ceil(Math.sqrt(positions.length)));
          const spacing = PREVIEW_FLOWER_RADIUS * 4;
          const col = i % cols;
          const row = Math.floor(i / cols);
          return { ...p, x: spacing + col * spacing, y: spacing + row * spacing };
        })
      : positions;

    // Compute bounding box in world coordinates
    const xs = resolved.map(p => p.x);
    const ys = resolved.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Pad by flower radius to avoid clipping
    const pad = PREVIEW_FLOWER_RADIUS * 2.5;
    const worldW = Math.max(maxX - minX, 1) + pad * 2;
    const worldH = Math.max(maxY - minY, 1) + pad * 2;
    const worldCenterX = (minX + maxX) / 2;
    const worldCenterY = (minY + maxY) / 2;

    // Scale to fit the container
    const el = containerRef.current;
    if (!el) return;
    const canvasW = el.clientWidth;
    const canvasH = el.clientHeight;
    const scale = Math.min(canvasW / worldW, canvasH / worldH);

    // Position the container so content is centered
    stage.scale.set(scale);
    stage.position.set(
      canvasW / 2 - worldCenterX * scale,
      canvasH / 2 - worldCenterY * scale,
    );

    // Draw each flower
    resolved.map(p => {
      const g = new Graphics();
      const constituents = constituentMap.get(p.sessionKey);
      const isArrangement = !!constituents && constituents.length > 1;

      if (isArrangement) {
        const level = Math.min(7, Math.ceil(constituents.length / 3));
        const meta = arrangementMetaMap.get(p.sessionKey);
        const plan = createArrangementPlan(constituents, level, meta);
        drawArrangementFromPlan(g, plan, PREVIEW_FLOWER_RADIUS, 1.0);
      } else {
        const specJson = specBySessionId.get(p.sessionKey)?.specJson;
        const plan = createFlowerPlan(specJson, p.sid);
        drawFlowerFromPlan(g, plan, PREVIEW_FLOWER_RADIUS, 1.0);
      }

      g.position.set(p.x, p.y);
      stage.addChild(g);
      return null;
    });
  }, [dataKey, sessions, specBySessionId, constituentMap, arrangementMetaMap]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
