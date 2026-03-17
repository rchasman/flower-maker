import { createContext, useContext, type ReactNode } from "react";
import { useSpacetimeDB } from "../spacetime/hooks.ts";
import type { ConnectionState } from "../spacetime/connection.ts";
import type { DbConnection } from "../spacetime/types.ts";

interface SessionContext {
  state: ConnectionState;
  conn: DbConnection | null;
}

const Ctx = createContext<SessionContext>({
  state: "disconnected",
  conn: null,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const { state, conn } = useSpacetimeDB();

  return <Ctx.Provider value={{ state, conn }}>{children}</Ctx.Provider>;
}

export function useSession() {
  return useContext(Ctx);
}
