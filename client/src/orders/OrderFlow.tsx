import { useState } from "react";
import type { FlowerSession } from "../spacetime/types.ts";
import { run, scoreColor } from "../lib/utils.ts";

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

  const fitnessScores: Record<string, number> = run(() => {
    try {
      const parsed: unknown = JSON.parse(session.fitness_json);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, number>;
      }
      return {};
    } catch {
      return {};
    }
  });

  const handleOrder = async () => {
    setIsOrdering(true);
    try {
      const res = await fetch("/api/flower/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          spec: {}, // Would be loaded from FlowerSpec table
          arrangement_level: levelName(session.arrangement_level),
          flower_count: session.flower_count,
          generation: session.generation,
          fitness_scores: fitnessScores,
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
          <span>Level: {levelName(session.arrangement_level)}</span>
          <span>{session.flower_count} flowers</span>
          <span>Gen {session.generation}</span>
        </div>
      </div>

      {/* Fitness scores */}
      {Object.keys(fitnessScores).length > 0 && (
        <div
          style={{
            padding: "0.75rem",
            background: "#141414",
            borderRadius: "0.375rem",
            border: "1px solid #1a1a1a",
            fontSize: "0.6875rem",
          }}
        >
          <div
            style={{
              color: "#737373",
              marginBottom: "0.375rem",
              fontWeight: 500,
            }}
          >
            Fitness
          </div>
          {Object.entries(fitnessScores).map(([env, score]) => (
            <div
              key={env}
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#525252",
              }}
            >
              <span>{env}</span>
              <span
                style={{
                  color: scoreColor(score),
                }}
              >
                {score.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}

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
