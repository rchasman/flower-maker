// Re-export all types from generated SpacetimeDB bindings.
// This file is the single import point for all SpacetimeDB types across the client.

export type {
  ChatMessage,
  FlowerOrder,
  FlowerPartOverride,
  FlowerSession,
  FlowerSpec,
  OrderSource,
  SessionStatus,
  User,
} from "./module_bindings/types.ts";

export type {
  DbConnection,
  EventContext,
  ReducerEventContext,
  SubscriptionEventContext,
  ErrorContext,
  SubscriptionHandle,
} from "./module_bindings/index.ts";

// --- Enum helpers ---
// SpacetimeDB v2 enums are tagged unions: { tag: "VariantName" }
// These helpers provide ergonomic comparison.

interface Tagged {
  tag: string;
}

/** Check if a SpacetimeDB enum value matches a variant name. */
export function isVariant<T extends Tagged>(
  value: T | null | undefined,
  tag: string,
): boolean {
  return value?.tag === tag;
}

/** Extract the tag name from a SpacetimeDB enum value. */
export function variantTag<T extends Tagged>(
  value: T | null | undefined,
): string | null {
  return value?.tag ?? null;
}
