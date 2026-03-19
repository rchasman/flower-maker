import { useState } from "react";

export interface ModelConfig {
  id: string;
  fullName: string;
  provider: string;
}

// Mirrored from api/config/models.ts — kept client-side to avoid cross-workspace import
const MODELS: ModelConfig[] = [
  { id: "claude-haiku-4.5", fullName: "anthropic/claude-haiku-4.5", provider: "anthropic" },
  { id: "claude-sonnet-4.6", fullName: "anthropic/claude-sonnet-4.6", provider: "anthropic" },
  { id: "claude-opus-4.6", fullName: "anthropic/claude-opus-4.6", provider: "anthropic" },
  { id: "gpt-oss-20b", fullName: "openai/gpt-oss-20b", provider: "openai" },
  { id: "gpt-5.4-nano", fullName: "openai/gpt-5.4-nano", provider: "openai" },
  { id: "gpt-5.4-mini", fullName: "openai/gpt-5.4-mini", provider: "openai" },
  { id: "gpt-5.4", fullName: "openai/gpt-5.4", provider: "openai" },
  { id: "gemini-3.1-flash-lite", fullName: "google/gemini-3.1-flash-lite-preview", provider: "google" },
  { id: "gemini-3-flash", fullName: "google/gemini-3-flash", provider: "google" },
  { id: "gemini-3.1-pro", fullName: "google/gemini-3.1-pro-preview", provider: "google" },
  { id: "grok-4.20-agent", fullName: "xai/grok-4.20-multi-agent-beta", provider: "xai" },
  { id: "grok-4.20", fullName: "xai/grok-4.20-non-reasoning-beta", provider: "xai" },
  { id: "grok-4.1-fast", fullName: "xai/grok-4.1-fast-non-reasoning", provider: "xai" },
  { id: "deepseek-v3.2", fullName: "deepseek/deepseek-v3.2", provider: "deepseek" },
  { id: "mistral-large-3", fullName: "mistral/mistral-large-3", provider: "mistral" },
  { id: "minimax-m2.7", fullName: "minimax/minimax-m2.7-highspeed", provider: "minimax" },
  { id: "kimi-k2.5", fullName: "moonshotai/kimi-k2.5", provider: "moonshot" },
  { id: "glm-5-turbo", fullName: "zai/glm-5-turbo", provider: "zhipu" },
  { id: "qwen-3.5-flash", fullName: "alibaba/qwen3.5-flash", provider: "alibaba" },
];

export const DEFAULT_MODEL = "openai/gpt-5.4-nano";

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#a78bfa",
  openai: "#86efac",
  google: "#93c5fd",
  xai: "#fbbf24",
  deepseek: "#60a5fa",
  mistral: "#f97316",
  minimax: "#f472b6",
  moonshot: "#e879f9",
  zhipu: "#34d399",
  alibaba: "#fb923c",
};

// Group models by provider, preserving order
function groupByProvider(models: ModelConfig[]): Array<{ provider: string; models: ModelConfig[] }> {
  const groups: Array<{ provider: string; models: ModelConfig[] }> = [];
  const seen = new Set<string>();
  for (const m of models) {
    if (!seen.has(m.provider)) {
      seen.add(m.provider);
      groups.push({ provider: m.provider, models: [] });
    }
    groups.find(g => g.provider === m.provider)!.models.push(m);
  }
  return groups;
}

interface ModelPickerProps {
  value: string; // fullName
  onChange: (fullName: string) => void;
}

export function ModelPicker({ value, onChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const groups = groupByProvider(MODELS);
  const current = MODELS.find(m => m.fullName === value);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "0.375rem 0.5rem",
          background: "#141414",
          border: "1px solid #262626",
          borderRadius: "0.25rem",
          color: "#a3a3a3",
          cursor: "pointer",
          fontSize: "0.6875rem",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: current ? PROVIDER_COLORS[current.provider] ?? "#525252" : "#525252",
            flexShrink: 0,
          }}
        />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current?.fullName ?? value}
        </span>
        <span style={{ color: "#525252", fontSize: "0.625rem" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 2,
            background: "#0d0d0d",
            border: "1px solid #262626",
            borderRadius: "0.375rem",
            maxHeight: "280px",
            overflow: "auto",
            zIndex: 100,
          }}
        >
          {groups.map(g => (
            <div key={g.provider}>
              <div
                style={{
                  padding: "0.375rem 0.5rem 0.25rem",
                  fontSize: "0.5625rem",
                  fontWeight: 600,
                  color: PROVIDER_COLORS[g.provider] ?? "#525252",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {g.provider}
              </div>
              {g.models.map(m => (
                <button
                  key={m.fullName}
                  onClick={() => {
                    onChange(m.fullName);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "0.375rem 0.5rem 0.375rem 1rem",
                    background: m.fullName === value ? "#1a1a1a" : "transparent",
                    border: "none",
                    color: m.fullName === value ? "#e5e5e5" : "#737373",
                    cursor: "pointer",
                    fontSize: "0.6875rem",
                    textAlign: "left",
                    display: "block",
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = "#1a1a1a"; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = m.fullName === value ? "#1a1a1a" : "transparent"; }}
                >
                  {m.id}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
