import { useSession } from "../session/SessionProvider.tsx";
import { useOrders } from "../spacetime/hooks.ts";
import { isVariant } from "../spacetime/types.ts";

export function OrderFeed() {
  const { conn } = useSession();
  const orders = useOrders(conn);

  const recentOrders = [...orders]
    .sort((a, b) => Number(b.orderedAt) - Number(a.orderedAt))
    .slice(0, 20);

  if (recentOrders.length === 0) {
    return (
      <div
        style={{
          padding: "0.75rem",
          color: "#404040",
          fontSize: "0.6875rem",
          textAlign: "center",
        }}
      >
        No orders yet. Be the first.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
        overflow: "auto",
      }}
    >
      {recentOrders.map(order => (
        <div
          key={Number(order.id)}
          style={{
            padding: "0.5rem 0.75rem",
            background: "#141414",
            borderRadius: "0.25rem",
            fontSize: "0.6875rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#737373",
          }}
        >
          <span>
            #{Number(order.sessionId)}
            {isVariant(order.source, "Agent") && (
              <span style={{ color: "#8b5cf6", marginLeft: "0.25rem" }}>
                AI
              </span>
            )}
          </span>
          <span style={{ color: "#404040" }}>{order.note ?? "ordered"}</span>
        </div>
      ))}
    </div>
  );
}
