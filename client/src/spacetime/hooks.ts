import { useState, useEffect, useRef } from "react";
import { connect, getConnection, onConnectionChange } from "./connection.ts";
import type { ConnectionState } from "./connection.ts";
import type {
  DbConnection,
  FlowerSession,
  FlowerSpec,
  FlowerPartOverride,
  User,
  FlowerOrder,
  ChatMessage,
} from "./types.ts";

export function useSpacetimeDB(oidcToken?: string) {
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [conn, setConn] = useState<DbConnection | null>(getConnection());

  useEffect(() => {
    const unsub = onConnectionChange((s, c) => {
      setState(s);
      setConn(c);
    });
    connect(oidcToken).catch(() => {});
    return () => {
      unsub();
    };
  }, [oidcToken]);

  return { state, conn };
}

// Generic hook for subscribing to a SpacetimeDB table.
// Batches rapid-fire DB events into a single microtask flush
// and skips setState when row identity hasn't changed.
function useTable<T>(
  conn: DbConnection | null,
  tableName: keyof DbConnection["db"],
): T[] {
  const [rows, setRows] = useState<T[]>([]);
  const dirtyRef = useRef(false);
  const tableRef = useRef<{
    iter(): Iterable<T>;
    onInsert(cb: (ctx: unknown, row: T) => void): void;
    onUpdate(cb: (ctx: unknown, old: T, next: T) => void): void;
    onDelete(cb: (ctx: unknown, row: T) => void): void;
  } | null>(null);

  useEffect(() => {
    if (!conn) return;
    const table = conn.db[tableName] as unknown as typeof tableRef.current & {};
    tableRef.current = table;

    const flush = () => {
      dirtyRef.current = false;
      const t = tableRef.current;
      if (!t) return;
      setRows(prev => {
        const next = [...t.iter()];
        if (prev.length === next.length && prev.every((r, i) => r === next[i])) return prev;
        return next;
      });
    };

    const markDirty = () => {
      if (!dirtyRef.current) {
        dirtyRef.current = true;
        queueMicrotask(flush);
      }
    };

    table.onInsert(markDirty);
    table.onUpdate(markDirty);
    table.onDelete(markDirty);

    // Initial load
    flush();

    return () => {
      tableRef.current = null;
      dirtyRef.current = false;
    };
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

export function usePartOverrides(conn: DbConnection | null) {
  return useTable<FlowerPartOverride>(conn, "part_override");
}


