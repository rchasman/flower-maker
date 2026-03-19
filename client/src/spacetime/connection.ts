import type { DbConnection } from "./types.ts";

const SPACETIMEDB_URI =
  import.meta.env.VITE_SPACETIMEDB_URI ?? "ws://localhost:9300";
const SPACETIMEDB_MODULE =
  import.meta.env.VITE_SPACETIMEDB_MODULE ?? "flower-picker";

let connection: DbConnection | null = null;
let myIdentity: unknown = null;
let connectPromise: Promise<DbConnection> | null = null;

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/** Get the current user's SpacetimeDB identity (available after connect). */
export function getMyIdentity(): unknown {
  return myIdentity;
}

export type ConnectionListener = (
  state: ConnectionState,
  conn: DbConnection | null,
) => void;

const listeners = new Set<ConnectionListener>();

export function onConnectionChange(listener: ConnectionListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(state: ConnectionState, conn: DbConnection | null) {
  listeners.forEach(l => l(state, conn));
}

export function getConnection(): DbConnection | null {
  return connection;
}

const ANON_TOKEN_KEY = "spacetimedb_token";
const ANON_IDENTITY_KEY = "spacetimedb_anon_identity";

/** Get the saved anonymous identity hex (for claiming after OIDC sign-in). */
export function getSavedAnonIdentityHex(): string | null {
  return localStorage.getItem(ANON_IDENTITY_KEY);
}

/** Clear the saved anonymous identity after a successful claim. */
export function clearSavedAnonIdentity(): void {
  localStorage.removeItem(ANON_IDENTITY_KEY);
  localStorage.removeItem(ANON_TOKEN_KEY);
}

/** Disconnect the current connection so we can reconnect with a different token. */
export function disconnect(): void {
  if (connection) {
    connection.disconnect();
    connection = null;
    connectPromise = null;
    myIdentity = null;
    notify("disconnected", null);
  }
}

export async function connect(oidcToken?: string): Promise<DbConnection> {
  if (connection) return connection;
  if (connectPromise) return connectPromise;

  notify("connecting", null);

  // Dynamic import so the app doesn't crash if bindings aren't generated yet
  connectPromise = (async () => {
    try {
      const mod = await import("./module_bindings/index.ts");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK builder API varies by version
      const builder = mod.DbConnection.builder() as any
      // Use OIDC token if signed in, otherwise fall back to saved anonymous token
      const token = oidcToken ?? localStorage.getItem(ANON_TOKEN_KEY) ?? undefined;

      const conn = builder
        .withUri(SPACETIMEDB_URI)
        .withDatabaseName(SPACETIMEDB_MODULE)
        .withToken(token)
        .onConnect((...args: unknown[]) => {
          myIdentity = args[1]; // SpacetimeDB identity (args: ctx, identity, token)
          if (!oidcToken) {
            // Persist anonymous token + identity for session continuity and future claim
            const newToken = args[2] as string | undefined;
            if (newToken) localStorage.setItem(ANON_TOKEN_KEY, newToken);
            const identityHex = String(myIdentity);
            if (identityHex && !identityHex.startsWith("[object")) {
              localStorage.setItem(ANON_IDENTITY_KEY, identityHex);
            }
          }
          connection = conn as DbConnection;

          // Subscribe to all tables — defer "connected" until cache is populated
          (conn as DbConnection)
            .subscriptionBuilder()
            .onApplied(() => {
              console.log("[spacetimedb] subscription applied — client cache ready");
              notify("connected", conn as DbConnection);
            })
            .subscribeToAllTables();
        })
        .onConnectError((...args: unknown[]) => {
          console.error("[spacetimedb] connection error:", args[1]);
          connectPromise = null;
          notify("error", null);
        })
        .onDisconnect((...args: unknown[]) => {
          if (args[1]) console.warn("[spacetimedb] disconnected:", args[1]);
          connection = null;
          connectPromise = null;
          notify("disconnected", null);
        })
        .build() as DbConnection;

      return conn;
    } catch (err) {
      console.warn(
        "[spacetimedb] bindings not generated yet — run `spacetime generate`",
        err,
      );
      connectPromise = null;
      notify("error", null);
      throw err;
    }
  })();

  return connectPromise;
}
