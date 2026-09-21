import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "react-oidc-context";
import { hasStoredOidcSession } from "../auth/oidcConfig.ts";
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
  /** A visitor with a stored OIDC session, which auth has yet to rehydrate. */
  authRestoring: boolean;
  /** A signed-in visitor whose anonymous flowers are still being claimed. */
  claimPending: boolean;
}

const Ctx = createContext<SessionContext>({
  state: "disconnected",
  conn: null,
  identityHex: null,
  myUser: null,
  authRestoring: false,
  claimPending: false,
});

const CLAIM_TIMEOUT_MS = 6000;

function identityStr(id: unknown): string | null {
  if (!id) return null;
  const s = String(id);
  return s.startsWith("[object") ? null : s;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const oidcToken = auth.user?.id_token;
  const claimAttempted = useRef(false);
  // Read before the claim clears it, so the loading screen knows a claim is due.
  const claimDue = useRef(getSavedAnonIdentityHex() !== null);
  const [claimGaveUp, setClaimGaveUp] = useState(false);

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
    if (!conn || !oidcToken || state !== "connected" || claimAttempted.current)
      return;

    const anonHex = getSavedAnonIdentityHex();
    if (!anonHex) return;

    claimAttempted.current = true;
    console.log("[auth] claiming anonymous identity:", anonHex);
    void conn.reducers.claimAnonymousIdentity({ anonToken: anonHex });
    clearSavedAnonIdentity();
  }, [conn, oidcToken, state]);

  const identityHex =
    state === "connected" ? identityStr(getMyIdentity()) : null;

  const myUser = identityHex
    ? (users.find(u => identityStr(u.identity) === identityHex) ?? null)
    : null;

  const claimPending =
    auth.isAuthenticated && claimDue.current && !myUser && !claimGaveUp;

  // A claim that never lands must fall through to the name gate, not hang.
  useEffect(() => {
    if (!claimPending) return;
    const timer = setTimeout(() => setClaimGaveUp(true), CLAIM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [claimPending]);

  return (
    <Ctx.Provider
      value={{
        state,
        conn,
        identityHex,
        myUser,
        authRestoring: auth.isLoading && hasStoredOidcSession(),
        claimPending,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  return useContext(Ctx);
}
