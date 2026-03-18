import type { DbConnection } from "./types.ts";

const SPACETIMEDB_URI =
  import.meta.env.VITE_SPACETIMEDB_URI ?? "ws://db.flower-maker.localhost:1355";
const SPACETIMEDB_MODULE =
  import.meta.env.VITE_SPACETIMEDB_MODULE ?? "flower-maker";
const TOKEN_KEY = "spacetimedb_token";

let connection: DbConnection | null = null;

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

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

export async function connect(): Promise<DbConnection> {
  if (connection) return connection;

  notify("connecting", null);

  // Dynamic import so the app doesn't crash if bindings aren't generated yet
  try {
    const mod = await import("./module_bindings/index.ts");
    const savedToken = localStorage.getItem(TOKEN_KEY) ?? undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK builder API varies by version
    const builder = mod.DbConnection.builder() as any
    const conn = builder
      .withUri(SPACETIMEDB_URI)
      .withDatabaseName(SPACETIMEDB_MODULE)
      .withToken(savedToken)
      .onConnect((...args: unknown[]) => {
        const token = args[2] as string | undefined;
        if (token) localStorage.setItem(TOKEN_KEY, token);
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
        notify("error", null);
      })
      .onDisconnect((...args: unknown[]) => {
        if (args[1]) console.warn("[spacetimedb] disconnected:", args[1]);
        connection = null;
        notify("disconnected", null);
      })
      .build() as DbConnection;

    return conn;
  } catch (err) {
    console.warn(
      "[spacetimedb] bindings not generated yet — run `spacetime generate`",
      err,
    );
    notify("error", null);
    throw err;
  }
}
