import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "../session/SessionProvider.tsx";
import { useFlowerSessions, useFlowerSpecs, usePartOverrides } from "../spacetime/hooks.ts";
import { PanelPopout } from "../ui/PanelPopout.tsx";
import { TemplatePicker } from "./TemplatePicker.tsx";
import { FlowerChat } from "../ai/FlowerChat.tsx";
import { OrderFlow } from "../orders/OrderFlow.tsx";
import { ActivityFeed } from "../orders/ActivityFeed.tsx";
import { PartEditor } from "./PartEditor.tsx";
import { ModelPicker, DEFAULT_MODEL } from "../settings/ModelPicker.tsx";
import { FlowerCanvas } from "./FlowerCanvas.tsx";
import type { FlowerCanvasHandle } from "./FlowerCanvas.tsx";
import { loadWasm, type GardenSim } from "../wasm/loader.ts";
import { startLoop, stopLoop } from "../wasm/loop.ts";
import { wireToWasm, handleMerge, getCanvasViewport } from "../spacetime/bridge.ts";
import type { FlowerSession, FlowerPartOverride } from "../spacetime/types.ts";
import { isVariant } from "../spacetime/types.ts";
import { parseArrangementMeta } from "../flower/render.ts";
import { groupBy, setNestedValue, parseSpec } from "../lib/utils.ts";
import { stringify } from "yaml";

/** Merge field-level part overrides into a spec YAML string. */
function applyFieldOverrides(specYaml: string, overrides: FlowerPartOverride[]): string {
  const fieldOverrides = overrides.filter(
    o => !o.partPath.startsWith("constituent:") && o.partPath !== "arrangement",
  );
  if (fieldOverrides.length === 0) return specYaml;

  const spec = parseSpec(specYaml) ?? {};
  for (const o of fieldOverrides) {
    const num = Number(o.overrideJson);
    setNestedValue(spec, o.partPath, Number.isNaN(num) ? o.overrideJson : num);
  }
  return stringify(spec);
}

interface DesignerViewProps {
  onBackToGrid: () => void;
}

type RightPanel = "order" | "parts";

export function DesignerView({ onBackToGrid }: DesignerViewProps) {
  const { conn } = useSession();
  const sessions = useFlowerSessions(conn);
  const specs = useFlowerSpecs(conn);
  const partOverrides = usePartOverrides(conn);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>("order");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [flowerCount, setFlowerCount] = useState(0);
  const [composeOpen, setComposeOpen] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const wasmInitialized = useRef(false);
  const canvasRef = useRef<FlowerCanvasHandle>(null);
  const simRef = useRef<GardenSim | null>(null);

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedId(null);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIdRef.current !== null) {
        if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
        conn?.reducers.deleteSession({ sessionId: BigInt(selectedIdRef.current) });
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [conn]);

  const mySessions = sessions.filter(s => isVariant(s.status, "Designing"));
  const selected: FlowerSession | null =
    mySessions.find(s => Number(s.id) === selectedId) ?? null;

  const selectedSpec = selected
    ? specs.find(s => s.sessionId === selected.id)
    : null;

  // Refs for stable access in callbacks (avoids stale closures)
  const specsRef = useRef(specs);
  specsRef.current = specs;
  const sessionsRef = useRef(mySessions);
  sessionsRef.current = mySessions;

  // Streaming state: track multiple concurrent generations by genId
  const streamingRef = useRef<Map<string, { sid: number | null; spec: string | null; preCount: number; lastPushedSpec: string | null }>>(new Map());
  const genCounter = useRef(0);

  // Push spec data to canvas whenever specs update, merging any streaming specs.
  // Also persist specs to DB when SIDs are resolved here (fixes race condition).
  useEffect(() => {
    const currentSessions = sessionsRef.current;
    for (const entry of streamingRef.current.values()) {
      if (entry.sid === null && entry.spec) {
        if (currentSessions.length > entry.preCount) {
          const claimedSids = new Set(
            [...streamingRef.current.values()]
              .filter(e => e.sid !== null)
              .map(e => e.sid!),
          );
          const unclaimed = currentSessions.filter(
            s => Number(s.id) > 0 && !claimedSids.has(Number(s.id)),
          );
          if (unclaimed.length > 0) {
            const resolvedSid = Number(unclaimed[unclaimed.length - 1]!.id);
            entry.sid = resolvedSid;
            // SID just resolved — persist the spec to DB
            if (entry.spec && entry.spec !== entry.lastPushedSpec) {
              entry.lastPushedSpec = entry.spec;
              conn?.reducers.updateFlowerSpec({ sessionId: BigInt(resolvedSid), spec: entry.spec });
            }
          }
        }
      }
    }

    const specMap = specs.reduce<Map<number, string>>(
      (acc, s) => acc.set(Number(s.sessionId), s.spec),
      new Map(),
    );
    for (const entry of streamingRef.current.values()) {
      if (entry.sid !== null && entry.spec) {
        specMap.set(entry.sid, entry.spec);
      }
    }
    const overridesBySid = groupBy(partOverrides, o => Number(o.sessionId));
    for (const [sid, sidOverrides] of overridesBySid) {
      const spec = specMap.get(sid);
      if (spec) {
        specMap.set(sid, applyFieldOverrides(spec, sidOverrides));
      }
    }
    canvasRef.current?.setSpecMap(specMap);
  }, [specs, mySessions.length, partOverrides, conn]);

  // Push constituent data and arrangement metadata to canvas
  useEffect(() => {
    const constituentMap = partOverrides
      .filter(o => o.partPath.startsWith("constituent:"))
      .reduce<Map<number, Array<{ spec: string; sid: number }>>>((acc, o) => {
        const sid = Number(o.sessionId);
        const idx = parseInt(o.partPath.split(":")[1] ?? "0", 10);
        const existing = acc.get(sid) ?? [];
        existing[idx] = { spec: o.overrideJson, sid: idx };
        acc.set(sid, existing);
        return acc;
      }, new Map());
    canvasRef.current?.setConstituentMap(constituentMap);

    const arrangementMetaMap = partOverrides
      .filter(o => o.partPath === "arrangement")
      .reduce<Map<number, import("../flower/render.ts").ArrangementMeta>>((acc, o) => {
        const meta = parseArrangementMeta(o.overrideJson);
        if (meta) acc.set(Number(o.sessionId), meta);
        return acc;
      }, new Map());
    canvasRef.current?.setArrangementMetaMap(arrangementMetaMap);
  }, [partOverrides]);

  useEffect(() => {
    if (!conn || wasmInitialized.current) return;
    wasmInitialized.current = true;

    loadWasm().then(sim => {
      simRef.current = sim;
      wireToWasm(conn, sim);
      startLoop(
        sim,
        () => {},
        (pool, count) => {
          setFlowerCount(count);
          canvasRef.current?.updateFlowers(pool, count);
        },
      );
    });

    return () => {
      stopLoop();
    };
  }, [conn]);

  const pendingMergesRef = useRef<Set<string>>(new Set());

  const handleMergeDrop = useCallback((dragSid: number, targetSid: number) => {
    const key = [Math.min(dragSid, targetSid), Math.max(dragSid, targetSid)].join("+");
    if (pendingMergesRef.current.has(key)) return;
    pendingMergesRef.current.add(key);
    handleMerge(conn!, dragSid, targetSid).finally(() => {
      pendingMergesRef.current.delete(key);
    });
  }, [conn]);

  const handleFlowerDrag = useCallback((sid: number, x: number, y: number) => {
    simRef.current?.set_body_position(BigInt(sid), x, y);
  }, []);

  const handleFlowerDragEnd = useCallback((sid: number, x: number, y: number) => {
    const { w, h, pad } = getCanvasViewport();
    const nx = Math.max(0, Math.min(100, ((x - pad) / (w - pad * 2)) * 100));
    const ny = Math.max(0, Math.min(100, ((y - pad) / (h - pad * 2)) * 100));
    conn?.reducers.updatePosition({ sessionId: BigInt(sid), x: nx, y: ny });
  }, [conn]);

  // ── Streaming generation handlers ──

  const handleGenerationStart = useCallback((prompt: string): string => {
    const genId = `gen-${++genCounter.current}-${Date.now()}`;
    streamingRef.current.set(genId, {
      sid: null,
      spec: null,
      preCount: sessionsRef.current.length,
      lastPushedSpec: null,
    });
    conn?.reducers.createSession({ prompt });
    return genId;
  }, [conn]);

  const resolveStreamingSid = useCallback((entry: { sid: number | null; preCount: number }) => {
    if (entry.sid !== null) return entry.sid;
    const claimedSids = new Set(
      [...streamingRef.current.values()]
        .filter(e => e.sid !== null)
        .map(e => e.sid!),
    );
    const unclaimed = sessionsRef.current.filter(
      s => !claimedSids.has(Number(s.id)),
    );
    if (unclaimed.length > 0 && sessionsRef.current.length > entry.preCount) {
      const sid = Number(unclaimed[unclaimed.length - 1]!.id);
      entry.sid = sid;
      return sid;
    }
    return null;
  }, []);

  const handleSpecProgress = useCallback((genId: string, spec: string) => {
    const entry = streamingRef.current.get(genId);
    if (!entry) return;

    entry.spec = spec;
    resolveStreamingSid(entry);

    if (entry.sid === null) return;

    const specMap = specsRef.current.reduce<Map<number, string>>(
      (acc, s) => acc.set(Number(s.sessionId), s.spec),
      new Map(),
    );
    for (const e of streamingRef.current.values()) {
      if (e.sid !== null && e.spec) specMap.set(e.sid, e.spec);
    }
    canvasRef.current?.setSpecMap(specMap);

    if (spec !== entry.lastPushedSpec) {
      entry.lastPushedSpec = spec;
      conn?.reducers.updateFlowerSpec({ sessionId: BigInt(entry.sid), spec });
    }
  }, [resolveStreamingSid, conn]);

  const handleFlowerGenerated = useCallback((genId: string, spec: string) => {
    const entry = streamingRef.current.get(genId);
    if (entry) {
      // Final SID resolution attempt
      resolveStreamingSid(entry);

      // Persist the completed spec to DB — this is the authoritative save
      if (entry.sid !== null) {
        conn?.reducers.updateFlowerSpec({ sessionId: BigInt(entry.sid), spec });

        // Update canvas immediately with the final spec — don't wait for
        // the DB round-trip, otherwise the flower reverts to the last partial
        // streaming spec between delete and subscription update.
        entry.spec = spec;
        const specMap = specsRef.current.reduce<Map<number, string>>(
          (acc, s) => acc.set(Number(s.sessionId), s.spec),
          new Map(),
        );
        for (const e of streamingRef.current.values()) {
          if (e.sid !== null && e.spec) specMap.set(e.sid, e.spec);
        }
        canvasRef.current?.setSpecMap(specMap);
      } else {
        // SID still unresolved — defer until session appears in subscription
        entry.spec = spec;
        setTimeout(() => {
          resolveStreamingSid(entry);
          if (entry.sid !== null) {
            conn?.reducers.updateFlowerSpec({ sessionId: BigInt(entry.sid), spec });
          }
          streamingRef.current.delete(genId);
        }, 3000);
        return;
      }
    }
    streamingRef.current.delete(genId);
  }, [resolveStreamingSid, conn]);

  const handleGenerationFailed = useCallback((genId: string) => {
    const entry = streamingRef.current.get(genId);
    if (!entry) return;
    resolveStreamingSid(entry);
    if (entry.sid !== null) {
      conn?.reducers.deleteSession({ sessionId: BigInt(entry.sid) });
      streamingRef.current.delete(genId);
    } else {
      setTimeout(() => {
        resolveStreamingSid(entry);
        if (entry.sid !== null) {
          conn?.reducers.deleteSession({ sessionId: BigInt(entry.sid) });
        }
        streamingRef.current.delete(genId);
      }, 2000);
    }
  }, [conn, resolveStreamingSid]);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* ── Top status bar ── */}
      <div
        style={{
          padding: "0.25rem 1ch",
          display: "flex",
          alignItems: "center",
          gap: "1ch",
          borderBottom: "1px solid var(--tui-border)",
          background: "var(--tui-bg-0)",
          fontSize: "var(--tui-font-size-xs)",
        }}
      >
        <button
          onClick={onBackToGrid}
          className="tui-btn"
          style={{ padding: "0.125rem 0.75ch", fontSize: "var(--tui-font-size-xs)" }}
        >
          ← GRID
        </button>
        <span style={{ color: "var(--tui-border)" }}>│</span>
        <span className="tui-glow-green" style={{ color: "var(--tui-green)", fontWeight: 600 }}>
          DESIGNER
        </span>
        <span style={{ color: "var(--tui-fg-4)" }}>
          {flowerCount > 0 && `${flowerCount} flowers`}
        </span>
        <span style={{ marginLeft: "auto" }}>
          <ModelPicker value={model} onChange={setModel} />
        </span>
      </div>

      {/* ── Full-width canvas ── */}
      <div style={{ flex: 1, minHeight: 0, position: "relative", background: "var(--tui-bg-0)" }}>
        <FlowerCanvas
          ref={canvasRef}
          selectedId={selectedId}
          onFlowerClick={setSelectedId}
          onFlowerDrag={handleFlowerDrag}
          onFlowerDragEnd={handleFlowerDragEnd}
          onMergeDrop={handleMergeDrop}
        />
      </div>

      {/* ── COMPOSE popout (templates + AI generator) ── */}
      <PanelPopout
        label="COMPOSE"
        open={composeOpen}
        onToggle={() => setComposeOpen(o => !o)}
        position="bottom-left"
        panelClassName="popout-panel--tall"
      >
        <div style={{ flex: "0 0 auto", maxHeight: "40%", overflow: "auto" }}>
          <TemplatePicker conn={conn} model={model} onGenerationStart={handleGenerationStart} onSpecProgress={handleSpecProgress} onFlowerGenerated={handleFlowerGenerated} onGenerationFailed={handleGenerationFailed} />
        </div>
        <div style={{ flex: 1, minHeight: 0, borderTop: "1px solid var(--tui-border)" }}>
          <FlowerChat model={model} onGenerationStart={handleGenerationStart} onSpecProgress={handleSpecProgress} onFlowerGenerated={handleFlowerGenerated} onGenerationFailed={handleGenerationFailed} />
        </div>
      </PanelPopout>

      {/* ── CANVAS popout (activity feed + order/taxonomy) ── */}
      <PanelPopout
        label="CANVAS"
        open={canvasOpen}
        onToggle={() => setCanvasOpen(o => !o)}
        position="top-right"
        panelClassName="popout-panel--tall"
      >
        <div style={{ flex: "0 1 auto", maxHeight: "45%", overflow: "auto" }}>
          <ActivityFeed
            onMerge={handleMergeDrop}
            onSelect={setSelectedId}
            selectedId={selectedId}
          />
        </div>
        <div className="tui-tabs">
          {(
            [
              ["order", "ORDER"],
              ["parts", "TAXONOMY"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRightPanel(key)}
              className="tui-tab"
              data-active={rightPanel === key ? "true" : undefined}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="popout-body popout-body--padded">
          {rightPanel === "order" && <OrderFlow session={selected} />}
          {rightPanel === "parts" && selected && (
            <PartEditor
              sessionId={Number(selected.id)}
              spec={selectedSpec?.spec ?? ""}
              constituents={partOverrides
                .filter(o => o.sessionId === selected.id && o.partPath.startsWith("constituent:"))
                .map(o => ({
                  index: parseInt(o.partPath.split(":")[1] ?? "0", 10),
                  spec: o.overrideJson,
                  forkedFrom: o.forkedFrom,
                }))
                .sort((a, b) => a.index - b.index)
              }
            />
          )}
          {rightPanel === "parts" && !selected && (
            <div style={{ color: "var(--tui-fg-4)", fontSize: "var(--tui-font-size-sm)" }}>
              select a flower to edit parts.
            </div>
          )}
        </div>
      </PanelPopout>

    </div>
  );
}
