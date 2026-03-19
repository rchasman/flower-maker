import { useState, useRef, useEffect, useMemo } from "react";
import { useSession } from "../session/SessionProvider.tsx";
import { useChatMessages, useUsers } from "../spacetime/hooks.ts";
import type { User } from "../spacetime/module_bindings/user_table.ts";

const CHATTER_COLORS = [
  "#f87171", "#fb923c", "#fbbf24", "#a3e635",
  "#34d399", "#22d3ee", "#60a5fa", "#a78bfa",
  "#e879f9", "#fb7185", "#4ade80", "#2dd4bf",
];

/** Stable map: each online user gets a unique color by sorted index. */
export function buildColorMap(users: User[]): Map<string, string> {
  const sorted = [...users]
    .filter(u => u.online)
    .sort((a, b) => String(a.identity).localeCompare(String(b.identity)));
  return new Map(
    sorted.map((u, i) => [String(u.identity), CHATTER_COLORS[i % CHATTER_COLORS.length]!]),
  );
}

/** Hash fallback for identities not in the color map (offline senders). */
function hashColor(identity: string): string {
  let hash = 0;
  for (let i = 0; i < identity.length; i++) {
    hash = hash * 31 + identity.charCodeAt(i);
  }
  return CHATTER_COLORS[Math.abs(hash) % CHATTER_COLORS.length]!;
}

export function colorForIdentity(colorMap: Map<string, string>, identity: string): string {
  return colorMap.get(identity) ?? hashColor(identity);
}

export function Chat() {
  const { conn } = useSession();
  const messages = useChatMessages(conn);
  const users = useUsers(conn);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const userNameMap = useMemo(
    () => new Map(users.map(u => [String(u.identity), u.name])),
    [users],
  );

  const colorMap = useMemo(() => buildColorMap(users), [users]);

  const sorted = [...messages]
    .sort((a, b) => Number(a.sentAt) - Number(b.sentAt))
    .slice(-50);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [sorted.length]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !conn) return;
    conn.reducers.sendChat({ text });
    setInput("");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "0.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
        }}
      >
        {sorted.map(msg => (
          <div
            key={Number(msg.id)}
            style={{ fontSize: "0.6875rem", lineHeight: 1.4 }}
          >
            <span style={{ color: colorForIdentity(colorMap, String(msg.sender)), fontWeight: 500 }}>
              {userNameMap.get(String(msg.sender)) ?? String(msg.sender).slice(0, 8)}:
            </span>{" "}
            <span style={{ color: "#a3a3a3" }}>{msg.text}</span>
          </div>
        ))}
        {sorted.length === 0 && (
          <div
            style={{
              color: "#404040",
              fontSize: "0.6875rem",
              textAlign: "center",
              padding: "1rem",
            }}
          >
            No messages yet.
          </div>
        )}
      </div>

      <div
        style={{
          padding: "0.375rem",
          borderTop: "1px solid #1a1a1a",
          display: "flex",
          gap: "0.375rem",
        }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Say something..."
          style={{
            flex: 1,
            padding: "0.375rem 0.5rem",
            background: "#0d0d0d",
            border: "1px solid #1a1a1a",
            borderRadius: "0.25rem",
            color: "#e5e5e5",
            fontSize: "0.6875rem",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}
