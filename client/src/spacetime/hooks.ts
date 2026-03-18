import { useState, useEffect } from "react";
import { connect, getConnection, onConnectionChange } from "./connection.ts";
import type { ConnectionState } from "./connection.ts";
import type {
  DbConnection,
  FlowerSession,
  FlowerSpec,
  User,
  FlowerOrder,
  ChatMessage,
} from "./types.ts";

export function useSpacetimeDB() {
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [conn, setConn] = useState<DbConnection | null>(getConnection());

  useEffect(() => {
    const unsub = onConnectionChange((s, c) => {
      setState(s);
      setConn(c);
    });
    connect().catch(() => {});
    return () => {
      unsub();
    };
  }, []);

  return { state, conn };
}

// Generic hook for subscribing to a SpacetimeDB table
function useTable<T>(
  conn: DbConnection | null,
  tableName: keyof DbConnection["db"],
): T[] {
  const [rows, setRows] = useState<T[]>([]);

  useEffect(() => {
    if (!conn) return;
    const table = conn.db[tableName] as unknown as {
      iter(): Iterable<T>;
      onInsert(cb: (ctx: unknown, row: T) => void): void;
      onUpdate(cb: (ctx: unknown, old: T, next: T) => void): void;
      onDelete(cb: (ctx: unknown, row: T) => void): void;
    };

    setRows([...table.iter()]);

    const refresh = () => setRows([...table.iter()]);
    table.onInsert(refresh);
    table.onUpdate(refresh);
    table.onDelete(refresh);
  }, [conn, tableName]);

  return rows;
}

export function useFlowerSessions(conn: DbConnection | null) {
  return useTable<FlowerSession>(conn, "flower_session");
}

export function useFlowerSpecs(conn: DbConnection | null) {
  return useTable<FlowerSpec>(conn, "flower_spec");
}

export function useUsers(conn: DbConnection | null) {
  return useTable<User>(conn, "user");
}

export function useOrders(conn: DbConnection | null) {
  return useTable<FlowerOrder>(conn, "flower_order");
}

export function useChatMessages(conn: DbConnection | null) {
  return useTable<ChatMessage>(conn, "chat_message");
}


export function useMyIdentity(_conn: DbConnection | null): string | null {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("spacetimedb_token")
      : null;
  return token ? "self" : null;
}
