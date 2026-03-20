import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
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
          { role: "assistant", content: `[err] ${res.statusText}` },
        ]);
        return;
      }

      setMessages(prev => {
        msgIdx.current = prev.length;
        return [...prev, { role: "assistant", content: "" }];
      });
      genId = onGenerationStart?.(text) ?? "";

      const raw = await readStreamWithProgress(res, accumulated => {
        const specJson = tryParseYamlToJson(accumulated);
        if (specJson) onSpecProgress?.(genId, specJson);
      });

      const { specJson, name } = yamlToJson(raw);

      setMessages(prev =>
        prev.map((m, i) => i === msgIdx.current ? { ...m, content: `[ok] created: ${name}` } : m),
      );

      onFlowerGenerated?.(genId, specJson);
    } catch (err) {
      if (genId) onGenerationFailed?.(genId);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `[err] ${String(err)}` },
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
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div className="tui-section-header">
        <span>── AI PROMPT</span>
        {activeCount > 0 && (
          <span className="tui-badge tui-badge-amber">
            GEN×{activeCount}
          </span>
        )}
      </div>

      {/* Message log */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "0.5rem 1ch",
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              color: "var(--tui-fg-4)",
              fontSize: "var(--tui-font-size-sm)",
              padding: "1rem 0",
            }}
          >
            describe the flower you want.
            <br />
            the AI will generate a full botanical spec.
            <br />
            <br />
            <span style={{ color: "var(--tui-fg-3)" }}>
              try: "a bioluminescent orchid with frost aura"
            </span>
          </div>
        )}
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.12 }}
              className="tui-log-entry"
            >
              {msg.role === "user" ? (
                <>
                  <span style={{ color: "var(--tui-purple)" }}>$ </span>
                  <span className="msg">{msg.content}</span>
                </>
              ) : (
                <>
                  <span style={{ color: msg.content.startsWith("[err]") ? "var(--tui-red)" : "var(--tui-green)" }}>
                    {msg.content.startsWith("[err]") ? "✗ " : msg.content.startsWith("[ok]") ? "✓ " : "⋯ "}
                  </span>
                  <span
                    className="msg"
                    style={{
                      color: msg.content.startsWith("[err]")
                        ? "var(--tui-red)"
                        : msg.content.startsWith("[ok]")
                        ? "var(--tui-green)"
                        : "var(--tui-fg-2)",
                    }}
                  >
                    {msg.content || (
                      <span>
                        generating<span className="tui-generating" />
                      </span>
                    )}
                  </span>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div
        style={{
          padding: "0.375rem 0.5ch",
          borderTop: "1px solid var(--tui-border)",
          display: "flex",
          gap: "0.5ch",
        }}
      >
        <div className="tui-input-wrap" style={{ flex: 1 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="describe a flower..."
            className="tui-input"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className={`tui-btn ${input.trim() ? "tui-btn-primary" : ""}`}
        >
          {activeCount > 0 ? `GEN(${activeCount})` : "GEN"}
        </button>
      </div>
    </div>
  );
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}
