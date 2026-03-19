// Models available via Vercel AI Gateway
// Source: https://ai-gateway.vercel.sh/v1/models

export interface ModelConfig {
  id: string;
  fullName: string;
  provider: string;
}

export const MODELS = [
  // Anthropic
  { id: "claude-haiku-4.5", fullName: "anthropic/claude-haiku-4.5", provider: "anthropic" },
  { id: "claude-sonnet-4.5", fullName: "anthropic/claude-sonnet-4.5", provider: "anthropic" },
  { id: "claude-sonnet-4.6", fullName: "anthropic/claude-sonnet-4.6", provider: "anthropic" },

  // OpenAI
  { id: "gpt-5-nano", fullName: "openai/gpt-5-nano", provider: "openai" },
  { id: "gpt-5-mini", fullName: "openai/gpt-5-mini", provider: "openai" },
  { id: "gpt-5.4-nano", fullName: "openai/gpt-5.4-nano", provider: "openai" },
  { id: "gpt-5.4-mini", fullName: "openai/gpt-5.4-mini", provider: "openai" },

  // Google
  { id: "gemini-2.5-flash-lite", fullName: "google/gemini-2.5-flash-lite", provider: "google" },
  { id: "gemini-3-flash", fullName: "google/gemini-3-flash", provider: "google" },
  { id: "gemini-3.1-flash-lite", fullName: "google/gemini-3.1-flash-lite-preview", provider: "google" },

  // xAI
  { id: "grok-4.1-fast", fullName: "xai/grok-4.1-fast-non-reasoning", provider: "xai" },

  // DeepSeek
  { id: "deepseek-v3.2", fullName: "deepseek/deepseek-v3.2", provider: "deepseek" },

  // Mistral
  { id: "mistral-small", fullName: "mistral/mistral-small", provider: "mistral" },
  { id: "ministral-8b", fullName: "mistral/ministral-8b", provider: "mistral" },

  // Meta (via gateway)
  { id: "llama-4-maverick", fullName: "meta/llama-4-maverick", provider: "meta" },

  // Moonshot
  { id: "kimi-k2-turbo", fullName: "moonshotai/kimi-k2-turbo", provider: "moonshot" },

  // Zhipu
  { id: "glm-5-turbo", fullName: "zai/glm-5-turbo", provider: "zhipu" },
] as const satisfies readonly ModelConfig[];

export type ModelId = (typeof MODELS)[number]["id"];
export const MODEL_IDS: ModelId[] = MODELS.map(m => m.id);

export const MODEL_MAP: Record<string, string> = Object.fromEntries(
  MODELS.map(m => [m.id, m.fullName]),
);

export const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";
