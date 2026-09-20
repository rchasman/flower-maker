import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { errorMessage, parseSpec } from "../lib/utils.ts";
import { generateFlower, type Answer } from "./generateFlower.ts";

interface FlowerChatProps {
  model: string;
  onGenerationStart?: (prompt: string) => string;
  onSpecProgress?: (genId: string, specYaml: string) => void;
  onFlowerGenerated?: (genId: string, specYaml: string) => void;
  onGenerationFailed?: (genId: string) => void;
  compact?: boolean;
}

type AssistantMsg =
  | { role: "assistant"; state: "generating"; answers: Answer[] }
  | { role: "assistant"; state: "ok"; text: string }
  | { role: "assistant"; state: "err"; text: string };

type ChatMsg = { id: string } & ({ role: "user"; text: string } | AssistantMsg);

const STATUS_STYLE = {
  generating: { mark: "⋯ ", color: "var(--text-tertiary)" },
  ok: { mark: "✓ ", color: "var(--positive)" },
  err: { mark: "✗ ", color: "var(--negative)" },
} as const;

function extractName(raw: string): string {
  const name = parseSpec(raw)?.name;
  return typeof name === "string" ? name : "your flower";
}

const formatValue = (value: string | boolean): string => {
  if (value === true) return "yes";
  if (value === false) return "no";
  return value;
};

const describeAnswer = (answer: Answer): string =>
  `${answer.id.replaceAll("_", " ")}: ${formatValue(answer.value)}`;

export function FlowerChat({
  model,
  onGenerationStart,
  onSpecProgress,
  onFlowerGenerated,
  onGenerationFailed,
  compact,
}: FlowerChatProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextMsgId = useRef(0);

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
    const userId = `msg-${++nextMsgId.current}`;
    const replyId = `msg-${++nextMsgId.current}`;
    setMessages(prev => [
      ...prev,
      { id: userId, role: "user", text },
      { id: replyId, role: "assistant", state: "generating", answers: [] },
    ]);
    setActiveCount(c => c + 1);
    const setReply = (reply: AssistantMsg) =>
      setMessages(prev =>
        prev.map(m => (m.id === replyId ? { id: replyId, ...reply } : m)),
      );

    const genId = onGenerationStart?.(text) ?? "";
    try {
      const result = await generateFlower({
        prompt: text,
        model,
        onSnapshot: snapshot => {
          setReply({
            role: "assistant",
            state: "generating",
            answers: snapshot.answers,
          });
          if (!snapshot.done) onSpecProgress?.(genId, snapshot.spec);
        },
      });
      setReply({
        role: "assistant",
        state: "ok",
        text: `Created ${extractName(result.spec)}`,
      });
      onFlowerGenerated?.(genId, result.spec);
    } catch (err) {
      if (genId) onGenerationFailed?.(genId);
      setReply({
        role: "assistant",
        state: "err",
        text: errorMessage(err),
      });
    } finally {
      setActiveCount(c => c - 1);
    }
  };

  if (compact) {
    return (
      <div
        style={{
          padding: "0.375rem 0.5ch",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: "0.5ch",
          alignItems: "center",
        }}
      >
        <span
          style={{
            color: "var(--text-quaternary)",
            fontSize: "var(--font-size-2xs)",
            whiteSpace: "nowrap",
          }}
        >
          AI
        </span>
        <div className="input-wrap" style={{ flex: 1 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Describe a flower"
            className="input"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className={`btn ${input.trim() ? "btn-primary" : ""}`}
        >
          {activeCount > 0 ? `GEN(${activeCount})` : "GEN"}
        </button>
      </div>
    );
  }

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
      <div className="section-header">
        <span>── AI PROMPT</span>
        {activeCount > 0 && (
          <span className="badge badge-muted">GEN×{activeCount}</span>
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
              color: "var(--text-quaternary)",
              fontSize: "var(--font-size-sm)",
              padding: "1rem 0",
            }}
          >
            describe the flower you want.
            <br />
            the AI will generate a full botanical spec.
            <br />
            <br />
            <span style={{ color: "var(--text-tertiary)" }}>
              try: "a bioluminescent orchid with frost aura"
            </span>
          </div>
        )}
        <AnimatePresence>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.12 }}
              className="log-entry"
            >
              {msg.role === "user" ? (
                <>
                  <span style={{ color: "var(--accent)" }}>$ </span>
                  <span className="msg">{msg.text}</span>
                </>
              ) : (
                <AssistantEntry msg={msg} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div
        style={{
          padding: "0.375rem 0.5ch",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: "0.5ch",
        }}
      >
        <div className="input-wrap" style={{ flex: 1 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Describe a flower"
            className="input"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className={`btn ${input.trim() ? "btn-primary" : ""}`}
        >
          {activeCount > 0 ? `GEN(${activeCount})` : "GEN"}
        </button>
      </div>
    </div>
  );
}

function AssistantEntry({ msg }: { msg: AssistantMsg }) {
  const { mark, color } = STATUS_STYLE[msg.state];
  if (msg.state !== "generating") {
    return (
      <>
        <span style={{ color }}>{mark}</span>
        <span className="msg" style={{ color }}>
          {msg.text}
        </span>
      </>
    );
  }
  if (msg.answers.length === 0) {
    return (
      <>
        <span style={{ color }}>{mark}</span>
        <span className="msg" style={{ color }}>
          generating
          <span className="generating" />
        </span>
      </>
    );
  }
  return <AnswerTrace answers={msg.answers} mark={mark} />;
}

function AnswerTrace({ answers, mark }: { answers: Answer[]; mark: string }) {
  const lastIndex = answers.length - 1;
  return (
    <div className="answer-trace">
      {answers.map((answer, i) => (
        <div key={answer.id} className="answer-trace__line">
          <span className="answer-trace__mark">
            {i === lastIndex ? mark : "  "}
          </span>
          {describeAnswer(answer)}
        </div>
      ))}
    </div>
  );
}
