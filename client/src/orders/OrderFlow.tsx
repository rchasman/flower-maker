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
      <div style={{ padding: "1rem", color: "#404040", fontSize: "0.75rem" }}>
        Select a flower to place an order.
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
        style={{
          padding: "0.75rem",
          background: "#141414",
          borderRadius: "0.375rem",
          border: "1px solid #1a1a1a",
          fontSize: "0.75rem",
        }}
      >
        <div style={{ color: "#a3a3a3", marginBottom: "0.5rem" }}>
          {session.prompt}
        </div>
        <div style={{ display: "flex", gap: "1rem", color: "#525252" }}>
          <span>Level: {levelName(Number(session.arrangementLevel))}</span>
          <span>{Number(session.flowerCount)} flowers</span>
          <span>Gen {Number(session.generation)}</span>
        </div>
      </div>

      {/* Order button */}
      <button
        onClick={handleOrder}
        disabled={isOrdering}
        style={{
          padding: "0.625rem",
          background: "#166534",
          color: "#e5e5e5",
          border: "none",
          borderRadius: "0.375rem",
          cursor: isOrdering ? "wait" : "pointer",
          fontSize: "0.8125rem",
          fontWeight: 500,
        }}
      >
        {isOrdering ? "Placing order..." : "Place Order →"}
      </button>

      {/* JSON payload preview */}
      {orderPayload && (
        <div
          style={{
            background: "#0a0a0a",
            border: "1px solid #262626",
            borderRadius: "0.375rem",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "0.5rem 0.75rem",
              borderBottom: "1px solid #262626",
              fontSize: "0.6875rem",
              color: "#737373",
              fontWeight: 500,
            }}
          >
            JSON Order Payload
          </div>
          <pre
            style={{
              padding: "0.75rem",
              margin: 0,
              fontSize: "0.625rem",
              lineHeight: 1.6,
              color: "#22c55e",
              overflow: "auto",
              maxHeight: "300px",
              fontFamily: "'Geist Mono', monospace",
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
