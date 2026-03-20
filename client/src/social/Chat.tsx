import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSession } from "../session/SessionProvider.tsx";
import { useChatMessages, useUsers } from "../spacetime/hooks.ts";
import type { User } from "../spacetime/types.ts";

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
          padding: "0.25rem 0.5ch",
          display: "flex",
          flexDirection: "column",
          gap: "0.125rem",
        }}
      >
        <AnimatePresence>
          {sorted.map(msg => (
            <motion.div
              key={Number(msg.id)}
              initial={{ opacity: 0, x: -3 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.1 }}
              className="tui-log-entry"
            >
              <span
                className="nick"
                style={{ color: colorForIdentity(colorMap, String(msg.sender)) }}
              >
                &lt;{userNameMap.get(String(msg.sender)) ?? String(msg.sender).slice(0, 8)}&gt;
              </span>{" "}
              <span className="msg">{msg.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {sorted.length === 0 && (
          <div
            style={{
              color: "var(--tui-fg-4)",
              fontSize: "var(--tui-font-size-sm)",
              textAlign: "center",
              padding: "1rem 0",
            }}
          >
            no messages. type to chat.
          </div>
        )}
      </div>

      <div
        style={{
          padding: "0.25rem 0.5ch",
          borderTop: "1px solid var(--tui-border-dim)",
          display: "flex",
          gap: "0.5ch",
        }}
      >
        <div className="tui-input-wrap" style={{ flex: 1 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="say something..."
            className="tui-input"
          />
        </div>
      </div>
    </div>
  );
}
