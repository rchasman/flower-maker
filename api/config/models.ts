// Models available via Vercel AI Gateway
// Source: https://ai-gateway.vercel.sh/v1/models (latest generation only)

export interface ModelConfig {
  id: string;
  fullName: string;
  provider: string;
}

export const MODELS = [
  // Anthropic
  { id: "claude-sonnet-4.6", fullName: "anthropic/claude-sonnet-4.6", provider: "anthropic" },
  { id: "claude-opus-4.6", fullName: "anthropic/claude-opus-4.6", provider: "anthropic" },

  // OpenAI
  { id: "gpt-5.4-nano", fullName: "openai/gpt-5.4-nano", provider: "openai" },
  { id: "gpt-5.4-mini", fullName: "openai/gpt-5.4-mini", provider: "openai" },
  { id: "gpt-5.4", fullName: "openai/gpt-5.4", provider: "openai" },

  // Google
  { id: "gemini-3.1-flash-lite", fullName: "google/gemini-3.1-flash-lite-preview", provider: "google" },
  { id: "gemini-3-flash", fullName: "google/gemini-3-flash", provider: "google" },
  { id: "gemini-3.1-pro", fullName: "google/gemini-3.1-pro-preview", provider: "google" },

  // xAI
  { id: "grok-4.20-agent", fullName: "xai/grok-4.20-multi-agent-beta", provider: "xai" },
  { id: "grok-4.20", fullName: "xai/grok-4.20-non-reasoning-beta", provider: "xai" },
  { id: "grok-4.1-fast", fullName: "xai/grok-4.1-fast-non-reasoning", provider: "xai" },

  // DeepSeek
  { id: "deepseek-v3.2", fullName: "deepseek/deepseek-v3.2", provider: "deepseek" },

  // Mistral
  { id: "mistral-large-3", fullName: "mistral/mistral-large-3", provider: "mistral" },

  // MiniMax
  { id: "minimax-m2.7", fullName: "minimax/minimax-m2.7-highspeed", provider: "minimax" },

  // Moonshot
  { id: "kimi-k2.5", fullName: "moonshotai/kimi-k2.5", provider: "moonshot" },

  // Zhipu
  { id: "glm-5-turbo", fullName: "zai/glm-5-turbo", provider: "zhipu" },

  // Alibaba
  { id: "qwen-3.5-flash", fullName: "alibaba/qwen3.5-flash", provider: "alibaba" },
] as const satisfies readonly ModelConfig[];

export type ModelId = (typeof MODELS)[number]["id"];
export const MODEL_IDS: ModelId[] = MODELS.map(m => m.id);

export const MODEL_MAP: Record<string, string> = Object.fromEntries(
  MODELS.map(m => [m.id, m.fullName]),
);

export const DEFAULT_MODEL = "openai/gpt-5.4-nano";
