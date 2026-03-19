import { useState, useRef, useEffect } from "react";
import { readStreamWithProgress } from "../lib/utils.ts";
import { parse as parseYaml } from "yaml";

interface FlowerChatProps {
  model: string;
  onGenerationStart?: (prompt: string) => string;
  onSpecProgress?: (genId: string, specJson: string) => void;
  onFlowerGenerated?: (genId: string, specJson: string) => void;
  onGenerationFailed?: (genId: string) => void;
}

function yamlToJson(raw: string): { specJson: string; name: string } {
  try {
    const parsed = parseYaml(raw) as { name?: string };
    return { specJson: JSON.stringify(parsed), name: parsed.name ?? "your flower" };
  } catch {
    try {
      const parsed = JSON.parse(raw) as { name?: string };
      return { specJson: raw, name: parsed.name ?? "your flower" };
    } catch {
      return { specJson: raw, name: "your flower" };
    }
  }
}

function tryParseYamlToJson(raw: string): string | null {
  try {
    const parsed = parseYaml(raw);
    return parsed && typeof parsed === "object" ? JSON.stringify(parsed) : null;
  } catch {
    return null;
  }
}

export function FlowerChat({ model, onGenerationStart, onSpecProgress, onFlowerGenerated, onGenerationFailed }: FlowerChatProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setActiveCount(c => c + 1);
    // Capture the message index for this generation's status line
    const msgIdx = { current: -1 };

    let genId = "";
    try {
      const res = await fetch("/api/flower/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, model }),
      });

      if (!res.ok || !res.body) {
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: `Error: ${res.statusText}` },
        ]);
        return;
      }

      setMessages(prev => {
        msgIdx.current = prev.length;
        return [...prev, { role: "assistant", content: "Generating..." }];
      });
      genId = onGenerationStart?.(text) ?? "";

      const raw = await readStreamWithProgress(res, accumulated => {
        const specJson = tryParseYamlToJson(accumulated);
        if (specJson) onSpecProgress?.(genId, specJson);
      });

      const { specJson, name } = yamlToJson(raw);

      setMessages(prev =>
        prev.map((m, i) => i === msgIdx.current ? { ...m, content: `Created ${name}` } : m),
      );

      onFlowerGenerated?.(genId, specJson);
    } catch (err) {
      if (genId) onGenerationFailed?.(genId);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `Error: ${String(err)}` },
      ]);
    } finally {
      setActiveCount(c => c - 1);
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
            {msg.content || (activeCount > 0 ? "..." : "")}
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
          disabled={!input.trim()}
          style={{
            padding: "0.5rem 1rem",
            background: "#262626",
            border: "none",
            borderRadius: "0.25rem",
            color: "#e5e5e5",
            cursor: "pointer",
            fontSize: "0.8125rem",
          }}
        >
          {activeCount > 0 ? `Generate (${activeCount})` : "Generate"}
        </button>
      </div>
    </div>
  );
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}
