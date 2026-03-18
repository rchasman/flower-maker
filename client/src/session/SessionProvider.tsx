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

function resolveIdentityHex(): string | null {
  const id = getMyIdentity();
  if (!id) return null;
  if (typeof (id as { toHexString?: () => string }).toHexString === "function") {
    return (id as { toHexString: () => string }).toHexString();
  }
  const s = String(id);
  return s.startsWith("[object") ? null : s;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { state, conn } = useSpacetimeDB();
  const users = useUsers(conn);

  const identityHex = state === "connected" ? resolveIdentityHex() : null;

  // Reactively find current user from the subscribed User table
  const myUser = identityHex
    ? users.find(u => String(u.identity) === identityHex) ?? null
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
