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

export const DEFAULT_MODEL = "google/gemini-3.1-flash-lite-preview";

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
    <div className="tui-select">
      <button
        onClick={() => setOpen(!open)}
        className="tui-select-trigger"
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: current ? PROVIDER_COLORS[current.provider] ?? "var(--tui-fg-3)" : "var(--tui-fg-3)",
            flexShrink: 0,
            display: "inline-block",
          }}
        />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {current?.id ?? value}
        </span>
        <span style={{ color: "var(--tui-fg-4)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="tui-select-menu">
          {groups.map(g => (
            <div key={g.provider}>
              <div
                className="tui-select-group-label"
                style={{ color: PROVIDER_COLORS[g.provider] ?? "var(--tui-fg-3)" }}
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
                  className="tui-select-option"
                  data-selected={m.fullName === value ? "true" : undefined}
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
