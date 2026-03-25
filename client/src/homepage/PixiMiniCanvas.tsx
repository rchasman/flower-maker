/**
 * Static snapshot renderer for zone preview cards.
 *
 * Instead of creating a separate WebGL context per card (which crashes Chrome
 * at ~8-16 contexts), we use a single shared offscreen PixiJS Application to
 * render each zone's flowers into a RenderTexture, extract it as a data URL,
 * and display a plain <img>. The dither shader is omitted — it's invisible
 * at card thumbnail size.
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { Application, Graphics, Container, RenderTexture, GraphicsContextSystem } from "pixi.js";
import {
  createFlowerPlan,
  createArrangementPlan,
  type ArrangementMeta,
} from "../flower/render.ts";
import {
  drawFlowerFromPlan,
  drawArrangementFromPlan,
} from "../flower/pixi-draw.ts";
import type { FlowerSession, FlowerSpec } from "../spacetime/types.ts";

interface PixiMiniCanvasProps {
  sessions: readonly FlowerSession[];
  specBySessionId: Map<string, FlowerSpec>;
  constituentMap: Map<string, Array<{ specJson: string; sid: number }>>;
  arrangementMetaMap: Map<string, ArrangementMeta>;
}

const GOLDEN_ANGLE = 2.399963; // radians
const SNAPSHOT_SIZE = 400; // render at 400x400, display scaled down

// ── Shared offscreen renderer (singleton) ────────────────────────────────

let sharedAppReady: Promise<Application> | null = null;

function getSharedApp(): Promise<Application> {
  if (sharedAppReady) return sharedAppReady;

  GraphicsContextSystem.defaultOptions.bezierSmoothness = 0.85;

  const app = new Application();
  sharedAppReady = app
    .init({
      background: 0x0d0d0d,
      width: SNAPSHOT_SIZE,
      height: SNAPSHOT_SIZE,
      antialias: true,
      resolution: 1,
      autoDensity: false,
    })
    .then(() => app);

  return sharedAppReady;
}

// ── Layout helpers ───────────────────────────────────────────────────────

function previewRadius(count: number): number {
  return Math.max(18, 55 / Math.sqrt(Math.max(1, count)));
}

function resolvePositions(
  sessions: readonly FlowerSession[],
  radius: number,
): Array<{ sid: number; sessionKey: string; x: number; y: number }> {
  const positions = sessions.map(s => ({
    sid: Number(s.id),
    sessionKey: String(s.id),
    x: Number(s.canvasX) || 0,
    y: Number(s.canvasY) || 0,
  }));

  const allZero = positions.every(p => p.x === 0 && p.y === 0);
  const resolved = allZero
    ? positions.map((p, i) => {
        const spacing = radius * 3;
        const angle = i * GOLDEN_ANGLE;
        const r = spacing * Math.sqrt(i + 1);
        return { ...p, x: r * Math.cos(angle), y: r * Math.sin(angle) };
      })
    : [...positions];

  // Repel overlapping flowers
  const minSpacing = radius * 2.5;
  for (let iter = 0; iter < 5; iter++) {
    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        const a = resolved[i]!;
        const b = resolved[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist < minSpacing && dist > 0.01) {
          const push = (minSpacing - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          resolved[i] = { ...a, x: a.x - nx * push, y: a.y - ny * push };
          resolved[j] = { ...b, x: b.x + nx * push, y: b.y + ny * push };
        }
      }
    }
  }

  return resolved;
}

// ── Render a zone to a data URL ──────────────────────────────────────────

async function renderZoneSnapshot(
  sessions: readonly FlowerSession[],
  specBySessionId: Map<string, FlowerSpec>,
  constituentMap: Map<string, Array<{ specJson: string; sid: number }>>,
  arrangementMetaMap: Map<string, ArrangementMeta>,
): Promise<string> {
  const app = await getSharedApp();
  const size = SNAPSHOT_SIZE;

  const container = new Container();
  const radius = previewRadius(sessions.length);
  const resolved = resolvePositions(sessions, radius);

  for (const p of resolved) {
    const g = new Graphics();
    const constituents = constituentMap.get(p.sessionKey);
    const isArrangement = !!constituents && constituents.length > 1;

    if (isArrangement) {
      const level = Math.min(7, Math.ceil(constituents.length / 3));
      const meta = arrangementMetaMap.get(p.sessionKey);
      const plan = createArrangementPlan(constituents, level, meta);
      drawArrangementFromPlan(g, plan, radius, 1.0);
    } else {
      const specJson = specBySessionId.get(p.sessionKey)?.specJson;
      const plan = createFlowerPlan(specJson, p.sid);
      drawFlowerFromPlan(g, plan, radius, 1.0);
    }

    g.position.set(p.x, p.y);
    container.addChild(g);
  }

  const bounds = resolved.reduce(
    (acc, p) => ({
      minX: Math.min(acc.minX, p.x),
      maxX: Math.max(acc.maxX, p.x),
      minY: Math.min(acc.minY, p.y),
      maxY: Math.max(acc.maxY, p.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
  const { minX, maxX, minY, maxY } = bounds;

  const pad = radius * 3.5;
  const worldW = Math.max(maxX - minX, 1) + pad * 2;
  const worldH = Math.max(maxY - minY, 1) + pad * 2;
  const worldCenterX = (minX + maxX) / 2;
  const worldCenterY = (minY + maxY) / 2;

  const scale = Math.min(size / worldW, size / worldH);
  container.scale.set(scale);
  container.position.set(
    size / 2 - worldCenterX * scale,
    size / 2 - worldCenterY * scale,
  );

  // Render to texture and extract
  const renderTexture = RenderTexture.create({ width: size, height: size });
  app.renderer.render({ container, target: renderTexture });

  const canvas = app.renderer.texture.generateCanvas(renderTexture) as HTMLCanvasElement;

  // Async blob encode — avoids blocking the main thread with synchronous PNG encoding.
  // toBlob is async (callback-based) unlike toDataURL which blocks.
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob(b => resolve(b!), "image/webp", 0.8),
  );

  const url = URL.createObjectURL(blob);

  renderTexture.destroy(true);
  container.destroy({ children: true });

  return url;
}

// ── React component ──────────────────────────────────────────────────────

export function PixiMiniCanvas({
  sessions,
  specBySessionId,
  constituentMap,
  arrangementMetaMap,
}: PixiMiniCanvasProps) {
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const renderIdRef = useRef(0);
  const prevUrlRef = useRef<string | null>(null);

  // Stable key for data changes — triggers re-render
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

  useEffect(() => {
    if (sessions.length === 0) {
      if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; }
      setSnapshot(null);
      return;
    }

    const renderId = ++renderIdRef.current;

    renderZoneSnapshot(sessions, specBySessionId, constituentMap, arrangementMetaMap)
      .then(url => {
        if (renderIdRef.current !== renderId) {
          URL.revokeObjectURL(url);
          return;
        }
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = url;
        setSnapshot(url);
      })
      .catch(() => {});

    return () => {
      if (prevUrlRef.current) { URL.revokeObjectURL(prevUrlRef.current); prevUrlRef.current = null; }
    };
  }, [dataKey]);

  if (!snapshot) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          background: "#0d0d0d",
        }}
      />
    );
  }

  return (
    <img
      src={snapshot}
      alt=""
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "contain",
        background: "#0d0d0d",
      }}
    />
  );
}
