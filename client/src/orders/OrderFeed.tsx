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
          padding: "0.5rem 1ch",
          color: "var(--tui-fg-4)",
          fontSize: "var(--tui-font-size-sm)",
        }}
      >
        no orders yet.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
      }}
    >
      {recentOrders.map(order => (
        <div
          key={Number(order.id)}
          className="tui-log-entry"
          style={{
            padding: "0.25rem 1ch",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "var(--tui-fg-3)" }}>
            #{Number(order.sessionId)}
            {isVariant(order.source, "Agent") && (
              <span className="tui-badge tui-badge-purple" style={{ marginLeft: "0.5ch" }}>
                AI
              </span>
            )}
          </span>
          <span style={{ color: "var(--tui-fg-4)" }}>{order.note ?? "ordered"}</span>
        </div>
      ))}
    </div>
  );
}
