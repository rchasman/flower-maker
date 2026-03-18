import { useState, useRef, useEffect } from "react";
import { readStreamWithProgress } from "../lib/utils.ts";

interface FlowerChatProps {
  onFlowerGenerated?: (specJson: string) => void;
}

export function FlowerChat({ onFlowerGenerated }: FlowerChatProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/flower/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });

      if (!res.ok || !res.body) {
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: `Error: ${res.statusText}` },
        ]);
        return;
      }

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      const final = await readStreamWithProgress(res, accumulated => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last)
            updated[updated.length - 1] = { ...last, content: accumulated };
          return updated;
        });
      });

      onFlowerGenerated?.(final);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `Error: ${String(err)}` },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#0d0d0d",
        borderRadius: "0.5rem",
        border: "1px solid #262626",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "0.75rem 1rem",
          borderBottom: "1px solid #262626",
          fontSize: "0.8125rem",
          fontWeight: 500,
        }}
      >
        Describe your flower
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {messages.length === 0 && (
          <p
            style={{
              color: "#404040",
              fontSize: "0.75rem",
              padding: "1rem",
              textAlign: "center",
            }}
          >
            Describe the flower you want and AI will generate a full botanical
            spec.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              background: msg.role === "user" ? "#1a1a2e" : "#141414",
              border: `1px solid ${msg.role === "user" ? "#2d2d5e" : "#1a1a1a"}`,
              fontSize: "0.75rem",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "200px",
              overflow: "auto",
              color: msg.role === "user" ? "#c4c4f0" : "#a3a3a3",
            }}
          >
            {msg.content || (isStreaming ? "..." : "")}
          </div>
        ))}
      </div>

      <div
        style={{
          padding: "0.5rem",
          borderTop: "1px solid #262626",
          display: "flex",
          gap: "0.5rem",
        }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="A bioluminescent orchid with frost aura..."
          disabled={isStreaming}
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            background: "#141414",
            border: "1px solid #262626",
            borderRadius: "0.25rem",
            color: "#e5e5e5",
            fontSize: "0.8125rem",
            outline: "none",
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={isStreaming || !input.trim()}
          style={{
            padding: "0.5rem 1rem",
            background: isStreaming ? "#1a1a1a" : "#262626",
            border: "none",
            borderRadius: "0.25rem",
            color: "#e5e5e5",
            cursor: isStreaming ? "wait" : "pointer",
            fontSize: "0.8125rem",
          }}
        >
          {isStreaming ? "..." : "Generate"}
        </button>
      </div>
    </div>
  );
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}
