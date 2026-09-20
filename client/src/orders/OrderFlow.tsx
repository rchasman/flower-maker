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
      <div
        style={{
          color: "var(--text-quaternary)",
          fontSize: "var(--font-size-sm)",
        }}
      >
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
        className="panel"
        data-label="Session"
        style={{ padding: "1rem 1ch 0.75rem" }}
      >
        <div
          style={{
            color: "var(--text-secondary)",
            marginBottom: "0.5rem",
            fontSize: "var(--font-size-sm)",
          }}
        >
          {session.prompt}
        </div>
        <div
          style={{
            display: "flex",
            gap: "1.5ch",
            fontSize: "var(--font-size-xs)",
            color: "var(--text-tertiary)",
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
        className="btn btn-primary"
        style={{ width: "100%", padding: "0.5rem" }}
      >
        {isOrdering ? (
          <span>
            PLACING ORDER
            <span className="generating" />
          </span>
        ) : (
          "PLACE ORDER →"
        )}
      </button>

      {/* JSON payload preview */}
      {orderPayload && (
        <div
          className="panel"
          data-label="Order payload"
          style={{ padding: "1rem 0 0" }}
        >
          <pre
            style={{
              padding: "0.5rem 1ch",
              margin: 0,
              fontSize: "var(--font-size-xs)",
              lineHeight: 1.6,
              color: "var(--positive)",
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
