import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "../session/SessionProvider.tsx";
import { useFlowerSessions, useFlowerSpecs, usePartOverrides } from "../spacetime/hooks.ts";
import { TemplatePicker } from "./TemplatePicker.tsx";
import { FlowerChat } from "../ai/FlowerChat.tsx";
import { OrderFlow } from "../orders/OrderFlow.tsx";
import { OrderFeed } from "../orders/OrderFeed.tsx";
import { Chat } from "../social/Chat.tsx";
import { ConnectedUsers } from "../social/ConnectedUsers.tsx";
import { PartEditor } from "./PartEditor.tsx";
import { ModelPicker, DEFAULT_MODEL } from "../settings/ModelPicker.tsx";
import { FlowerCanvas } from "./FlowerCanvas.tsx";
import type { FlowerCanvasHandle } from "./FlowerCanvas.tsx";
import { loadWasm, type GardenSim } from "../wasm/loader.ts";
import { startLoop, stopLoop } from "../wasm/loop.ts";
import { wireToWasm, handleMerge, getCanvasViewport } from "../spacetime/bridge.ts";
import type { FlowerSession } from "../spacetime/types.ts";
import { isVariant } from "../spacetime/types.ts";
import { parseArrangementMeta } from "../flower/render.ts";

interface DesignerViewProps {
  onBackToGrid: () => void;
}

type RightPanel = "order" | "parts" | "chat";

export function DesignerView({ onBackToGrid }: DesignerViewProps) {
  const { conn } = useSession();
  const sessions = useFlowerSessions(conn);
  const specs = useFlowerSpecs(conn);
  const partOverrides = usePartOverrides(conn);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rightPanel, setRightPanel] = useState<RightPanel>("order");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [flowerCount, setFlowerCount] = useState(0);
  const wasmInitialized = useRef(false);
  const canvasRef = useRef<FlowerCanvasHandle>(null);
  const simRef = useRef<GardenSim | null>(null);

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
  // Each entry: { sid: resolved session ID | null, spec: latest streamed spec, preCount: session count before creation }
  const streamingRef = useRef<Map<string, { sid: number | null; spec: string | null; preCount: number }>>(new Map());
  const genCounter = useRef(0);

  // Push spec data to canvas whenever specs update, merging any streaming specs.
  // Also resolves streaming SIDs when sessions first appear from SpacetimeDB.
  useEffect(() => {
    // Resolve unresolved streaming SIDs — match each to the Nth new session since its preCount
    const currentSessions = sessionsRef.current;
    for (const entry of streamingRef.current.values()) {
      if (entry.sid === null && entry.spec) {
        if (currentSessions.length > entry.preCount) {
          // Find the first unresolved session (not claimed by another stream)
          const claimedSids = new Set(
            [...streamingRef.current.values()]
              .filter(e => e.sid !== null)
              .map(e => e.sid!),
          );
          const unclaimed = currentSessions.filter(
            s => Number(s.id) > 0 && !claimedSids.has(Number(s.id)),
          );
          // Take the newest unclaimed session that appeared after preCount
          if (unclaimed.length > 0) {
            entry.sid = Number(unclaimed[unclaimed.length - 1]!.id);
          }
        }
      }
    }

    const specMap = specs.reduce<Map<number, string>>(
      (acc, s) => acc.set(Number(s.sessionId), s.specJson),
      new Map(),
    );
    // Overlay all streaming specs so they aren't clobbered by empty "{}" from SpacetimeDB
    for (const entry of streamingRef.current.values()) {
      if (entry.sid !== null && entry.spec) {
        specMap.set(entry.sid, entry.spec);
      }
    }
    canvasRef.current?.setSpecMap(specMap);
  }, [specs, mySessions.length]);

  // Push constituent data and arrangement metadata to canvas for arrangement rendering
  useEffect(() => {
    const constituentMap = partOverrides
      .filter(o => o.partPath.startsWith("constituent:"))
      .reduce<Map<number, Array<{ specJson: string; sid: number }>>>((acc, o) => {
        const sid = Number(o.sessionId);
        const idx = parseInt(o.partPath.split(":")[1] ?? "0", 10);
        const existing = acc.get(sid) ?? [];
        existing[idx] = { specJson: o.overrideJson, sid: idx };
        acc.set(sid, existing);
        return acc;
      }, new Map());
    canvasRef.current?.setConstituentMap(constituentMap);

    // Extract arrangement metadata (AI-generated adornment info)
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
        event => {
          const key = [Math.min(event.a, event.b), Math.max(event.a, event.b)].join("+");
          if (pendingMergesRef.current.has(key)) return;
          pendingMergesRef.current.add(key);
          handleMerge(conn, event.a, event.b).finally(() => {
            pendingMergesRef.current.delete(key);
          });
        },
        data => {
          setFlowerCount(data.length);
          canvasRef.current?.updateFlowers(data);
        },
      );
    });

    return () => {
      stopLoop();
    };
  }, [conn]);

  // Double-merge guard: prevent physics overlap + drop handler from both firing
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
    // Normalize pixel coords back to 0–100 for server storage
    const { w, h, pad } = getCanvasViewport();
    const nx = Math.max(0, Math.min(100, ((x - pad) / (w - pad * 2)) * 100));
    const ny = Math.max(0, Math.min(100, ((y - pad) / (h - pad * 2)) * 100));
    conn?.reducers.updatePosition({ sessionId: BigInt(sid), x: nx, y: ny });
  }, [conn]);

  // ── Streaming generation handlers (support concurrent generation) ──

  // Phase 1: Create session immediately, return genId for tracking
  const handleGenerationStart = useCallback((prompt: string): string => {
    const genId = `gen-${++genCounter.current}-${Date.now()}`;
    streamingRef.current.set(genId, {
      sid: null,
      spec: null,
      preCount: sessionsRef.current.length,
    });
    conn?.reducers.createSession({ prompt });
    return genId;
  }, [conn]);

  // Resolve SID for a streaming entry from the sessions list
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

  // Phase 2: Push partial spec to canvas as YAML streams in
  const handleSpecProgress = useCallback((genId: string, specJson: string) => {
    const entry = streamingRef.current.get(genId);
    if (!entry) return;

    entry.spec = specJson;
    resolveStreamingSid(entry);

    if (entry.sid === null) return; // SID not yet available, spec is buffered

    // Push directly to canvas for immediate visual feedback
    const specMap = specsRef.current.reduce<Map<number, string>>(
      (acc, s) => acc.set(Number(s.sessionId), s.specJson),
      new Map(),
    );
    for (const e of streamingRef.current.values()) {
      if (e.sid !== null && e.spec) specMap.set(e.sid, e.spec);
    }
    canvasRef.current?.setSpecMap(specMap);
  }, [resolveStreamingSid]);

  // Phase 3: Persist final spec to SpacetimeDB
  const handleFlowerGenerated = useCallback((genId: string, specJson: string) => {
    const entry = streamingRef.current.get(genId);
    if (entry?.sid !== null && entry?.sid !== undefined) {
      conn?.reducers.updateFlowerSpec({ sessionId: BigInt(entry.sid), specJson });
    }
    streamingRef.current.delete(genId);
  }, [conn]);

  // Cleanup: delete the orphaned session when streaming fails
  const handleGenerationFailed = useCallback((genId: string) => {
    const entry = streamingRef.current.get(genId);
    if (!entry) return;
    resolveStreamingSid(entry);
    if (entry.sid !== null) {
      conn?.reducers.deleteSession({ sessionId: BigInt(entry.sid) });
      streamingRef.current.delete(genId);
    } else {
      // Session hasn't arrived from SpacetimeDB yet — retry shortly
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
    <div style={{ width: "100%", height: "100%", display: "flex" }}>
      {/* Left sidebar — templates + AI chat */}
      <aside
        style={{
          width: "280px",
          borderRight: "1px solid #262626",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "0.75rem 1rem",
            borderBottom: "1px solid #262626",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ fontSize: "0.875rem", fontWeight: 500 }}>
            flower-maker
          </h2>
          <button
            onClick={onBackToGrid}
            style={{
              background: "none",
              border: "none",
              color: "#737373",
              cursor: "pointer",
              fontSize: "0.75rem",
            }}
          >
            ← Grid
          </button>
        </div>

        {/* Model picker */}
        <div style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #262626" }}>
          <ModelPicker value={model} onChange={setModel} />
        </div>

        {/* Templates section */}
        <div style={{ flex: "0 0 auto", maxHeight: "40%", overflow: "auto" }}>
          <TemplatePicker conn={conn} model={model} onGenerationStart={handleGenerationStart} onSpecProgress={handleSpecProgress} onFlowerGenerated={handleFlowerGenerated} onGenerationFailed={handleGenerationFailed} />
        </div>

        {/* AI chat section */}
        <div style={{ flex: 1, minHeight: 0, borderTop: "1px solid #262626" }}>
          <FlowerChat model={model} onGenerationStart={handleGenerationStart} onSpecProgress={handleSpecProgress} onFlowerGenerated={handleFlowerGenerated} onGenerationFailed={handleGenerationFailed} />
        </div>
      </aside>

      {/* Center — canvas area */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <div style={{ flex: 1, position: "relative" }}>
          <FlowerCanvas
            ref={canvasRef}
            selectedId={selectedId}
            onFlowerClick={setSelectedId}
            onFlowerDrag={handleFlowerDrag}
            onFlowerDragEnd={handleFlowerDragEnd}
            onMergeDrop={handleMergeDrop}
          />
          {flowerCount > 0 && (
            <div
              style={{
                position: "absolute",
                bottom: 8,
                left: 12,
                color: "#525252",
                fontSize: "0.6875rem",
                pointerEvents: "none",
              }}
            >
              {flowerCount} flowers
            </div>
          )}
        </div>

        {/* Bottom bar — my flowers */}
        {mySessions.length > 0 && (
          <div
            style={{
              padding: "0.5rem",
              borderTop: "1px solid #262626",
              display: "flex",
              gap: "0.375rem",
              overflow: "auto",
            }}
          >
            {mySessions.map(s => (
              <button
                key={Number(s.id)}
                onClick={() => setSelectedId(Number(s.id))}
                style={{
                  padding: "0.375rem 0.75rem",
                  background:
                    selectedId === Number(s.id) ? "#262626" : "#141414",
                  border: `1px solid ${selectedId === Number(s.id) ? "#404040" : "#1a1a1a"}`,
                  borderRadius: "0.25rem",
                  color:
                    selectedId === Number(s.id) ? "#e5e5e5" : "#737373",
                  cursor: "pointer",
                  fontSize: "0.6875rem",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {s.prompt.slice(0, 20)}
                {s.prompt.length > 20 ? "..." : ""}
                <span style={{ color: "#525252", marginLeft: "0.375rem" }}>
                  lvl{Number(s.arrangementLevel)}
                </span>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Right sidebar — contextual panels */}
      <aside
        style={{
          width: "280px",
          borderLeft: "1px solid #262626",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Panel tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #262626",
          }}
        >
          {(
            [
              ["order", "Order"],
              ["parts", "Parts"],
              ["chat", "Chat"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRightPanel(key)}
              style={{
                flex: 1,
                padding: "0.5rem",
                background: rightPanel === key ? "#1a1a1a" : "transparent",
                border: "none",
                borderBottom:
                  rightPanel === key
                    ? "2px solid #525252"
                    : "2px solid transparent",
                color: rightPanel === key ? "#e5e5e5" : "#525252",
                cursor: "pointer",
                fontSize: "0.6875rem",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div style={{ flex: 1, overflow: "auto", padding: "0.75rem" }}>
          {rightPanel === "order" && <OrderFlow session={selected} />}
          {rightPanel === "parts" && selected && (
            <PartEditor
              sessionId={Number(selected.id)}
              specJson={selectedSpec?.specJson ?? "{}"}
              constituents={partOverrides
                .filter(o => o.sessionId === selected.id && o.partPath.startsWith("constituent:"))
                .map(o => ({
                  index: parseInt(o.partPath.split(":")[1] ?? "0", 10),
                  specJson: o.overrideJson,
                  forkedFrom: o.forkedFrom,
                }))
                .sort((a, b) => a.index - b.index)
              }
            />
          )}
          {rightPanel === "parts" && !selected && (
            <div style={{ color: "#404040", fontSize: "0.6875rem" }}>
              Select a flower to edit parts.
            </div>
          )}
          {rightPanel === "chat" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                height: "100%",
              }}
            >
              <ConnectedUsers />
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  borderTop: "1px solid #1a1a1a",
                  paddingTop: "0.5rem",
                }}
              >
                <Chat />
              </div>
            </div>
          )}
        </div>

        {/* Order feed at bottom */}
        <div
          style={{
            borderTop: "1px solid #262626",
            maxHeight: "120px",
            overflow: "auto",
          }}
        >
          <div
            style={{
              padding: "0.375rem 0.75rem",
              fontSize: "0.625rem",
              color: "#525252",
              fontWeight: 500,
            }}
          >
            Recent Orders
          </div>
          <OrderFeed />
        </div>
      </aside>
    </div>
  );
}
