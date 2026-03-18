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
import { FlowerCanvas } from "./FlowerCanvas.tsx";
import type { FlowerCanvasHandle } from "./FlowerCanvas.tsx";
import { loadWasm, type GardenSim } from "../wasm/loader.ts";
import { startLoop, stopLoop } from "../wasm/loop.ts";
import { wireToWasm, handleMerge, getCanvasViewport } from "../spacetime/bridge.ts";
import type { FlowerSession } from "../spacetime/types.ts";
import { isVariant } from "../spacetime/types.ts";

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

  // Streaming state: SID of the flower currently being generated
  const streamingSidRef = useRef<number | null>(null);
  const streamingSpecRef = useRef<string | null>(null);
  const preStreamSessionCountRef = useRef(0);

  // Push spec data to canvas whenever specs update, merging any streaming spec
  useEffect(() => {
    const specMap = specs.reduce<Map<number, string>>(
      (acc, s) => acc.set(Number(s.sessionId), s.specJson),
      new Map(),
    );
    // Overlay streaming spec so it isn't clobbered by the empty "{}" from SpacetimeDB
    if (streamingSidRef.current !== null && streamingSpecRef.current) {
      specMap.set(streamingSidRef.current, streamingSpecRef.current);
    }
    canvasRef.current?.setSpecMap(specMap);
  }, [specs]);

  // Push constituent data to canvas for arrangement rendering
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

  // ── Streaming generation handlers ──

  // Phase 1: Create session immediately so the flower body appears on canvas
  const handleGenerationStart = useCallback((prompt: string) => {
    preStreamSessionCountRef.current = sessionsRef.current.length;
    streamingSidRef.current = null;
    streamingSpecRef.current = null;
    conn?.reducers.createSession({ prompt });
  }, [conn]);

  // Phase 2: Push partial spec to canvas as YAML streams in
  const handleSpecProgress = useCallback((specJson: string) => {
    // Detect the new session (appears after createSession round-trip)
    if (streamingSidRef.current === null) {
      if (sessionsRef.current.length <= preStreamSessionCountRef.current) return;
      const newest = sessionsRef.current[sessionsRef.current.length - 1]!;
      streamingSidRef.current = Number(newest.id);
    }

    streamingSpecRef.current = specJson;

    // Push directly to canvas for immediate visual feedback
    const specMap = specsRef.current.reduce<Map<number, string>>(
      (acc, s) => acc.set(Number(s.sessionId), s.specJson),
      new Map(),
    );
    specMap.set(streamingSidRef.current, specJson);
    canvasRef.current?.setSpecMap(specMap);
  }, []);

  // Phase 3: Persist final spec to SpacetimeDB
  const handleFlowerGenerated = useCallback((specJson: string) => {
    const sid = streamingSidRef.current;
    if (sid !== null) {
      conn?.reducers.updateFlowerSpec({ sessionId: BigInt(sid), specJson });
    }
    streamingSidRef.current = null;
    streamingSpecRef.current = null;
  }, [conn]);

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

        {/* Templates section */}
        <div style={{ flex: "0 0 auto", maxHeight: "40%", overflow: "auto" }}>
          <TemplatePicker conn={conn} onGenerationStart={handleGenerationStart} onSpecProgress={handleSpecProgress} onFlowerGenerated={handleFlowerGenerated} />
        </div>

        {/* AI chat section */}
        <div style={{ flex: 1, minHeight: 0, borderTop: "1px solid #262626" }}>
          <FlowerChat onGenerationStart={handleGenerationStart} onSpecProgress={handleSpecProgress} onFlowerGenerated={handleFlowerGenerated} />
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
