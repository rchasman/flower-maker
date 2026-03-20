import { useState } from "react";
import type { FlowerSession } from "../spacetime/types.ts";

interface OrderFlowProps {
  session: FlowerSession | null;
  onOrder?: (payload: unknown) => void;
}

export function OrderFlow({ session, onOrder }: OrderFlowProps) {
  const [orderPayload, setOrderPayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);

  if (!session) {
    return (
      <div style={{ color: "var(--tui-fg-4)", fontSize: "var(--tui-font-size-sm)" }}>
        select a flower to place an order.
      </div>
    );
  }

  const handleOrder = async () => {
    setIsOrdering(true);
    try {
      const res = await fetch("/api/flower/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: Number(session.id),
          spec: {},
          arrangement_level: levelName(Number(session.arrangementLevel)),
          flower_count: Number(session.flowerCount),
          generation: Number(session.generation),
          prompt: session.prompt,
        }),
      });
      const payload = (await res.json()) as Record<string, unknown>;
      setOrderPayload(payload);
      onOrder?.(payload);
    } catch (err) {
      console.error("Order failed:", err);
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Session info */}
      <div
        className="tui-panel"
        data-label="SESSION"
        style={{ padding: "1rem 1ch 0.75rem" }}
      >
        <div style={{ color: "var(--tui-fg-1)", marginBottom: "0.5rem", fontSize: "var(--tui-font-size-sm)" }}>
          {session.prompt}
        </div>
        <div
          style={{
            display: "flex",
            gap: "1.5ch",
            fontSize: "var(--tui-font-size-xs)",
            color: "var(--tui-fg-3)",
          }}
        >
          <span>lvl: {levelName(Number(session.arrangementLevel))}</span>
          <span>{Number(session.flowerCount)} flowers</span>
          <span>gen {Number(session.generation)}</span>
        </div>
      </div>

      {/* Order button */}
      <button
        onClick={handleOrder}
        disabled={isOrdering}
        className="tui-btn tui-btn-primary"
        style={{ width: "100%", padding: "0.5rem" }}
      >
        {isOrdering ? (
          <span>PLACING ORDER<span className="tui-generating" /></span>
        ) : (
          "PLACE ORDER →"
        )}
      </button>

      {/* JSON payload preview */}
      {orderPayload && (
        <div
          className="tui-panel accent-cyan"
          data-label="ORDER PAYLOAD"
          style={{ padding: "1rem 0 0" }}
        >
          <pre
            style={{
              padding: "0.5rem 1ch",
              margin: 0,
              fontSize: "var(--tui-font-size-xs)",
              lineHeight: 1.6,
              color: "var(--tui-green)",
              overflow: "auto",
              maxHeight: "300px",
            }}
          >
            {JSON.stringify(orderPayload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function levelName(level: number): string {
  return (
    [
      "",
      "stem",
      "group",
      "bunch",
      "arrangement",
      "bouquet",
      "centerpiece",
      "installation",
    ][level] ?? "unknown"
  );
}
