import { createContext, useContext, type ReactNode } from "react";
import { useSpacetimeDB, useUsers } from "../spacetime/hooks.ts";
import { getMyIdentity } from "../spacetime/connection.ts";
import type { ConnectionState } from "../spacetime/connection.ts";
import type { DbConnection, User } from "../spacetime/types.ts";

interface SessionContext {
  state: ConnectionState;
  conn: DbConnection | null;
  /** Hex string of the current user's SpacetimeDB identity, or null before connect. */
  identityHex: string | null;
  /** The current user's User row from the database, or null if not found yet. */
  myUser: User | null;
}

const Ctx = createContext<SessionContext>({
  state: "disconnected",
  conn: null,
  identityHex: null,
  myUser: null,
});

/** Normalize a SpacetimeDB identity to a comparable string.
 *  Uses String() for consistency with how table row identities stringify. */
function identityStr(id: unknown): string | null {
  if (!id) return null;
  const s = String(id);
  return s.startsWith("[object") ? null : s;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { state, conn } = useSpacetimeDB();
  const users = useUsers(conn);

  const identityHex = state === "connected" ? identityStr(getMyIdentity()) : null;

  // Reactively find current user from the subscribed User table
  const myUser = identityHex
    ? users.find(u => identityStr(u.identity) === identityHex) ?? null
    : null;

  return (
    <Ctx.Provider value={{ state, conn, identityHex, myUser }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  return useContext(Ctx);
}
