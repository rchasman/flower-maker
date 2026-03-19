import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "react-oidc-context";
import { useSpacetimeDB, useUsers } from "../spacetime/hooks.ts";
import {
  getMyIdentity,
  getSavedAnonIdentityHex,
  clearSavedAnonIdentity,
  disconnect,
} from "../spacetime/connection.ts";
import type { ConnectionState } from "../spacetime/connection.ts";
import type { DbConnection, User } from "../spacetime/types.ts";

interface SessionContext {
  state: ConnectionState;
  conn: DbConnection | null;
  identityHex: string | null;
  myUser: User | null;
  isSignedIn: boolean;
}

const Ctx = createContext<SessionContext>({
  state: "disconnected",
  conn: null,
  identityHex: null,
  myUser: null,
  isSignedIn: false,
});

function identityStr(id: unknown): string | null {
  if (!id) return null;
  const s = String(id);
  return s.startsWith("[object") ? null : s;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const oidcToken = auth.user?.id_token;
  const claimAttempted = useRef(false);

  // If user just signed in via OIDC, disconnect the anonymous connection
  // so useSpacetimeDB reconnects with the OIDC token
  useEffect(() => {
    if (oidcToken) {
      disconnect();
    }
  }, [oidcToken]);

  const { state, conn } = useSpacetimeDB(oidcToken);
  const users = useUsers(conn);

  // After connecting with OIDC, claim the anonymous identity if one was saved
  useEffect(() => {
    if (!conn || !oidcToken || state !== "connected" || claimAttempted.current) return;

    const anonHex = getSavedAnonIdentityHex();
    if (!anonHex) return;

    claimAttempted.current = true;
    console.log("[auth] claiming anonymous identity:", anonHex);
    conn.reducers.claimAnonymousIdentity({ anonToken: anonHex });
    clearSavedAnonIdentity();
  }, [conn, oidcToken, state]);

  const identityHex = state === "connected" ? identityStr(getMyIdentity()) : null;

  const myUser = identityHex
    ? users.find(u => identityStr(u.identity) === identityHex) ?? null
    : null;

  return (
    <Ctx.Provider value={{ state, conn, identityHex, myUser, isSignedIn: auth.isAuthenticated }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  return useContext(Ctx);
}
