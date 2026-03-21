import { useState, useMemo, useCallback } from "react";
import { useSession } from "../session/SessionProvider.tsx";
import { useOrders, useFlowerSessions, useFlowerSpecs, usePartOverrides } from "../spacetime/hooks.ts";
import { isVariant } from "../spacetime/types.ts";
import type { FlowerOrder, FlowerSession, FlowerSpec } from "../spacetime/types.ts";
import { run, getNestedValue } from "../lib/utils.ts";

// ── Types ─────────────────────────────────────────────────────────────────

type ActiveFlower = {
  kind: "active";
  session: FlowerSession;
  spec: FlowerSpec | null;
  constituents: ConstituentEntry[];
  arrangementName: string | null;
};

type OrderEvent = {
  kind: "order";
  ts: number;
  order: FlowerOrder;
  session: FlowerSession | null;
  spec: FlowerSpec | null;
};

type ConstituentEntry = {
  index: number;
  name: string;
  shape: string | null;
};

interface ActivityFeedProps {
  onMerge?: (sidA: number, sidB: number) => void;
  onSelect?: (sid: number) => void;
  selectedId?: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function specName(specJson: string): string {
  return run(() => {
    try {
      const s = JSON.parse(specJson) as Record<string, unknown>;
      return (s.common_name as string) ?? (s.species as string) ?? "unknown";
    } catch {
      return "unknown";
    }
  });
}

function specShape(specJson: string): string | null {
  return run(() => {
    try {
      const s = JSON.parse(specJson) as Record<string, unknown>;
      return (getNestedValue(s, "petals.layers.0.shape") as string) ?? null;
    } catch {
      return null;
    }
  });
}

function levelLabel(level: number): string {
  return ["", "stem", "group", "bunch", "arrangement", "bouquet", "centerpiece", "installation"][level] ?? "?";
}

function timeAgo(ts: number): string {
  const delta = Math.floor((Date.now() - ts) / 1000);
  if (delta < 60) return `${delta}s`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h`;
  return `${Math.floor(delta / 86400)}d`;
}

const actionBtnStyle: React.CSSProperties = {
  padding: "0.1875rem 0.75ch",
  fontSize: "var(--tui-font-size-2xs)",
  fontFamily: "var(--tui-font)",
  background: "var(--tui-bg-2)",
  cursor: "pointer",
  border: "1px solid var(--tui-border-dim)",
  color: "var(--tui-fg-3)",
  letterSpacing: "0.04em",
  lineHeight: 1.4,
  minWidth: "2ch",
  textAlign: "center",
};

// ── Component ──────────────────────────────────────────────────────────────

export function ActivityFeed({ onMerge, onSelect, selectedId }: ActivityFeedProps) {
  const { conn, identityHex } = useSession();
  const orders = useOrders(conn);
  const sessions = useFlowerSessions(conn);
  const specs = useFlowerSpecs(conn);
  const partOverrides = usePartOverrides(conn);

  // Merge mode: pick a second flower to merge with
  const [mergeSource, setMergeSource] = useState<number | null>(null);

  const { activeFlowers, orderEvents } = useMemo(() => {
    const specMap = new Map(specs.map(s => [Number(s.sessionId), s]));
    const sessionMap = new Map(sessions.map(s => [Number(s.id), s]));

    // Only show the current user's designing sessions
    const designing = sessions.filter(s => {
      if (!isVariant(s.status, "Designing")) return false;
      if (!identityHex) return true; // can't determine identity, show all
      const ownerStr = String(s.owner);
      return !ownerStr.startsWith("[object") && ownerStr === identityHex;
    });

    const activeFlowers: ActiveFlower[] = designing.map(session => {
      const sid = Number(session.id);
      const constituents = partOverrides
        .filter(o => o.sessionId === session.id && o.partPath.startsWith("constituent:"))
        .map(o => {
          const idx = parseInt(o.partPath.split(":")[1] ?? "0", 10);
          return {
            index: idx,
            name: specName(o.overrideJson),
            shape: specShape(o.overrideJson),
          };
        })
        .sort((a, b) => a.index - b.index);

      const arrangementOverride = partOverrides.find(
        o => o.sessionId === session.id && o.partPath === "arrangement",
      );
      const arrangementName = run(() => {
        if (!arrangementOverride) return null;
        try {
          const meta = JSON.parse(arrangementOverride.overrideJson) as Record<string, unknown>;
          return (meta.name as string) ?? null;
        } catch {
          return null;
        }
      });

      return {
        kind: "active" as const,
        session,
        spec: specMap.get(sid) ?? null,
        constituents,
        arrangementName,
      };
    });

    const orderEvents: OrderEvent[] = [...orders]
      .sort((a, b) => Number(b.orderedAt) - Number(a.orderedAt))
      .slice(0, 10)
      .map(order => ({
        kind: "order" as const,
        ts: Number(order.orderedAt),
        order,
        session: sessionMap.get(Number(order.sessionId)) ?? null,
        spec: specMap.get(Number(order.sessionId)) ?? null,
      }));

    return { activeFlowers, orderEvents };
  }, [orders, sessions, specs, partOverrides, identityHex]);

  const handleDelete = useCallback((sid: bigint) => {
    conn?.reducers.deleteSession({ sessionId: sid });
  }, [conn]);

  const handleSplit = useCallback((sid: bigint, constituentIndex: number) => {
    conn?.reducers.splitConstituent({ sessionId: sid, constituentIndex });
  }, [conn]);

  const handleRemove = useCallback((sid: bigint, constituentIndex: number) => {
    conn?.reducers.removeConstituent({ sessionId: sid, constituentIndex });
  }, [conn]);

  const startMerge = useCallback((sid: number) => {
    setMergeSource(sid);
  }, []);

  const completeMerge = useCallback((targetSid: number) => {
    if (mergeSource !== null && mergeSource !== targetSid) {
      onMerge?.(mergeSource, targetSid);
    }
    setMergeSource(null);
  }, [mergeSource, onMerge]);

  const cancelMerge = useCallback(() => {
    setMergeSource(null);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* ── Merge mode banner ── */}
      {mergeSource !== null && (
        <div style={{
          padding: "0.375rem 1ch",
          background: "var(--tui-purple-dim)",
          borderBottom: "1px solid var(--tui-purple)",
          fontSize: "var(--tui-font-size-xs)",
          display: "flex",
          alignItems: "center",
          gap: "0.5ch",
        }}>
          <span style={{ color: "var(--tui-purple)", textShadow: "0 0 4px var(--tui-purple-glow)" }}>
            MERGE
          </span>
          <span style={{ color: "var(--tui-fg-2)", flex: 1 }}>
            select target for #{mergeSource}
          </span>
          <button
            onClick={cancelMerge}
            style={{ ...actionBtnStyle, color: "var(--tui-red)", borderColor: "var(--tui-red-dim)" }}
          >
            ESC
          </button>
        </div>
      )}

      {/* ── Active flowers ── */}
      {activeFlowers.length > 0 && (
        <div>
          <div style={{
            padding: "0.25rem 1ch",
            fontSize: "var(--tui-font-size-xs)",
            color: "var(--tui-green)",
            textShadow: "0 0 6px var(--tui-green-glow)",
            borderBottom: "1px solid var(--tui-border-dim)",
          }}>
            ACTIVE ({activeFlowers.length})
          </div>
          {activeFlowers.map(flower => {
            const sid = Number(flower.session.id);
            const name = flower.spec ? specName(flower.spec.specJson) : flower.session.prompt.slice(0, 20);
            const shape = flower.spec ? specShape(flower.spec.specJson) : null;
            const level = Number(flower.session.arrangementLevel);
            const isBundle = flower.constituents.length > 0;
            const isMergeSource = mergeSource === sid;
            const isMergeTarget = mergeSource !== null && mergeSource !== sid;
            const isSelected = selectedId === sid;

            return (
              <div key={sid}>
                {/* Main flower row */}
                <div
                  onClick={() => {
                    if (isMergeTarget) {
                      completeMerge(sid);
                    } else {
                      onSelect?.(sid);
                    }
                  }}
                  style={{
                    padding: "0.375rem 1ch",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75ch",
                    borderBottom: isBundle ? "none" : "1px solid var(--tui-border-dim)",
                    cursor: isMergeTarget ? "pointer" : "default",
                    background: run(() => {
                      if (isMergeSource) return "rgba(196, 181, 253, 0.06)";
                      if (isMergeTarget) return "rgba(196, 181, 253, 0.03)";
                      if (isSelected) return "var(--tui-bg-3)";
                      return "transparent";
                    }),
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => {
                    if (isMergeTarget) (e.currentTarget.style.background = "rgba(196, 181, 253, 0.1)");
                  }}
                  onMouseLeave={e => {
                    if (isMergeTarget) (e.currentTarget.style.background = "rgba(196, 181, 253, 0.03)");
                  }}
                >
                  {/* Status indicator */}
                  <span style={{
                    width: "4px",
                    height: "4px",
                    borderRadius: "50%",
                    background: isMergeTarget ? "var(--tui-purple)" : "var(--tui-green)",
                    boxShadow: isMergeTarget
                      ? "0 0 4px var(--tui-purple-glow)"
                      : "0 0 4px var(--tui-green-glow)",
                    flexShrink: 0,
                    marginTop: "0.375rem",
                  }} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "var(--tui-font-size-xs)",
                      color: isMergeTarget ? "var(--tui-purple)" : "var(--tui-fg-1)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {isMergeTarget ? `→ merge into ${name}` : name}
                      {isBundle && (
                        <span className="tui-badge tui-badge-purple" style={{ marginLeft: "0.5ch", verticalAlign: "middle" }}>
                          {flower.constituents.length}x
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: "var(--tui-font-size-2xs)",
                      color: "var(--tui-fg-4)",
                      display: "flex",
                      gap: "0.75ch",
                    }}>
                      {shape && <span>{shape}</span>}
                      {level > 1 && <span style={{ color: "var(--tui-purple)" }}>{levelLabel(level)}</span>}
                      {flower.arrangementName && (
                        <span style={{ color: "var(--tui-fg-3)" }}>{flower.arrangementName}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {mergeSource === null && (
                    <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0, alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); e.preventDefault(); startMerge(sid); }}
                        style={{ ...actionBtnStyle, color: "var(--tui-purple)", borderColor: "var(--tui-purple-dim)" }}
                        title="Merge with another flower"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); e.preventDefault(); handleDelete(flower.session.id); }}
                        style={{ ...actionBtnStyle, color: "var(--tui-red)", borderColor: "var(--tui-red-dim)" }}
                        title={isBundle ? "Delete entire bundle" : "Delete flower"}
                      >
                        x
                      </button>
                    </div>
                  )}
                </div>

                {/* Constituent sub-rows for bundles */}
                {isBundle && (
                  <div style={{
                    borderBottom: "1px solid var(--tui-border-dim)",
                    background: "var(--tui-bg-0)",
                  }}>
                    {flower.constituents.map((c, ci) => {
                      const isLast = ci === flower.constituents.length - 1;
                      return (
                        <div
                          key={c.index}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5ch",
                            padding: "0.1875rem 1ch 0.1875rem 2ch",
                            fontSize: "var(--tui-font-size-2xs)",
                          }}
                        >
                          {/* Tree connector */}
                          <span style={{ color: "var(--tui-fg-4)", flexShrink: 0, width: "2ch" }}>
                            {isLast ? "└─" : "├─"}
                          </span>

                          {/* Name + shape */}
                          <span style={{ color: "var(--tui-fg-2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.name}
                            {c.index === 0 && (
                              <span style={{ color: "var(--tui-green)", marginLeft: "0.5ch" }}>*</span>
                            )}
                          </span>
                          {c.shape && (
                            <span style={{ color: "var(--tui-fg-4)", flexShrink: 0 }}>{c.shape}</span>
                          )}

                          {/* Per-constituent actions */}
                          <div style={{ display: "flex", gap: "0.25rem", flexShrink: 0, alignItems: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleSplit(flower.session.id, c.index)}
                              style={{ ...actionBtnStyle, color: "var(--tui-cyan)", borderColor: "rgba(103, 232, 249, 0.15)" }}
                              title="Split out as independent flower"
                            >
                              {"<>"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemove(flower.session.id, c.index)}
                              style={actionBtnStyle}
                              title="Remove from bundle"
                            >
                              x
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Order events ── */}
      {orderEvents.length > 0 && (
        <div>
          <div style={{
            padding: "0.25rem 1ch",
            fontSize: "var(--tui-font-size-xs)",
            color: "var(--tui-amber)",
            textShadow: "0 0 6px var(--tui-amber-glow)",
            borderBottom: "1px solid var(--tui-border-dim)",
          }}>
            ORDERS
          </div>
          {orderEvents.map(e => {
            const name = e.spec ? specName(e.spec.specJson) : `#${Number(e.order.sessionId)}`;
            const level = e.session ? Number(e.session.arrangementLevel) : 0;
            const count = e.session ? Number(e.session.flowerCount) : 0;
            const isAgent = isVariant(e.order.source, "Agent");

            return (
              <div
                key={`order-${Number(e.order.id)}`}
                style={{
                  padding: "0.375rem 1ch",
                  borderBottom: "1px solid var(--tui-border-dim)",
                  fontSize: "var(--tui-font-size-xs)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5ch" }}>
                  <span style={{ color: "var(--tui-green)", textShadow: "0 0 4px var(--tui-green-glow)" }}>
                    ORDER
                  </span>
                  <span style={{ color: "var(--tui-fg-1)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {name}
                  </span>
                  {isAgent && (
                    <span className="tui-badge tui-badge-purple" style={{ fontSize: "var(--tui-font-size-2xs)" }}>AI</span>
                  )}
                  <span style={{ color: "var(--tui-fg-4)", fontSize: "var(--tui-font-size-2xs)", flexShrink: 0 }}>
                    {timeAgo(e.ts)}
                  </span>
                </div>
                <div style={{
                  display: "flex",
                  gap: "1ch",
                  marginTop: "0.1875rem",
                  fontSize: "var(--tui-font-size-2xs)",
                  color: "var(--tui-fg-4)",
                }}>
                  {level > 0 && <span>{levelLabel(level)}</span>}
                  {count > 1 && <span>{count} flowers</span>}
                  {e.order.note && <span style={{ color: "var(--tui-fg-3)" }}>{e.order.note}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeFlowers.length === 0 && orderEvents.length === 0 && (
        <div style={{
          padding: "0.5rem 1ch",
          color: "var(--tui-fg-4)",
          fontSize: "var(--tui-font-size-xs)",
        }}>
          no activity yet.
        </div>
      )}
    </div>
  );
}
