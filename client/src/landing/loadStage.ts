import type { ConnectionState } from "../spacetime/connection.ts";

export type LoadStage = "session" | "connecting" | "claiming" | "error";

interface LoadStageInput {
  authRestoring: boolean;
  isAuthenticated: boolean;
  state: ConnectionState;
  claimPending: boolean;
}

/**
 * The stage a signed-in visitor waits on, or null when nothing is pending and
 * the ordinary landing belongs on screen. Auth restores from storage before it
 * reports the visitor as signed in, so `authLoading` comes first: without it a
 * returning visitor sees the name gate flash on every load.
 */
export function signedInLoadStage({
  authRestoring,
  isAuthenticated,
  state,
  claimPending,
}: LoadStageInput): LoadStage | null {
  if (authRestoring) return "session";
  if (!isAuthenticated) return null;
  if (state === "error") return "error";
  if (state !== "connected") return "connecting";
  if (claimPending) return "claiming";
  return null;
}
