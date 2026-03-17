import { useState, useRef, useEffect } from "react";
import { useSession } from "../session/SessionProvider.tsx";
import { useChatMessages } from "../spacetime/hooks.ts";
import { variantTag } from "../spacetime/types.ts";

export function Chat() {
  const { conn } = useSession();
  const messages = useChatMessages(conn);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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
        {sorted.map(msg => {
          const emoteTag = variantTag(msg.emote);
          return (
            <div
              key={Number(msg.id)}
              style={{ fontSize: "0.6875rem", lineHeight: 1.4 }}
            >
              {emoteTag ? (
                <span style={{ color: "#8b5cf6" }}>
                  {emoteEmoji(emoteTag)} {emoteTag}
                </span>
              ) : (
                <>
                  <span style={{ color: "#525252" }}>
                    {String(msg.sender).slice(0, 8)}:
                  </span>{" "}
                  <span style={{ color: "#a3a3a3" }}>{msg.text}</span>
                </>
              )}
            </div>
          );
        })}
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

function emoteEmoji(emote: string): string {
  const map: Record<string, string> = {
    Wave: "👋",
    Sparkle: "✨",
    Rain: "🌧️",
    Bloom: "🌸",
    Wilt: "🥀",
    Dance: "💃",
    Pollinate: "🐝",
  };
  return map[emote] ?? "✦";
}
