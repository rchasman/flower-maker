import { parse as parseYaml } from "yaml";

/** Execute a block and return its value. Use instead of IIFEs. */
export const run = <T>(f: () => T): T => f();

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Parse a spec string (YAML or JSON) to an object. Returns null on failure. */
export function parseSpec(
  raw: string | undefined,
): Record<string, unknown> | null {
  if (!raw || raw === "{}" || raw.trim() === "") return null;
  try {
    const parsed: unknown = parseYaml(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** The message of a thrown value, whatever its type. */
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Group array elements by a key function. */
export function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key);
    if (group) group.push(item);
    else map.set(key, [item]);
  }
  return map;
}

/** Get a nested value from an object by dot-separated path. */
export function getNestedValue(
  obj: Record<string, unknown>,
  path: string,
): unknown {
  return path.split(".").reduce<unknown>((o, k) => {
    if (o && typeof o === "object" && k in (o as Record<string, unknown>)) {
      return (o as Record<string, unknown>)[k];
    }
    return null;
  }, obj);
}

const isIndexKey = (key: string): boolean => /^\d+$/.test(key);

const emptyObjects = (count: number): Record<string, unknown>[] =>
  Array.from({ length: Math.max(0, count) }, () => ({}));

function setAt(
  container: unknown,
  keys: readonly string[],
  value: unknown,
): unknown {
  const [key, ...rest] = keys;
  if (key === undefined) return value;
  if (isIndexKey(key)) {
    const list: unknown[] = Array.isArray(container) ? container : [];
    const index = Number(key);
    const filled = [...list, ...emptyObjects(index + 1 - list.length)];
    return filled.map((item, i) =>
      i === index ? setAt(item, rest, value) : item,
    );
  }
  // A named key cannot address an array element, so the array is left as it is.
  if (Array.isArray(container)) return container;
  const record = isRecord(container) ? container : {};
  return { ...record, [key]: setAt(record[key], rest, value) };
}

/**
 * Return a copy of `obj` with `value` set at the dot-separated `path`.
 * Numeric keys address array elements and create the array and the element
 * when missing; missing objects on the way are created.
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const result = setAt(obj, path.split("."), value);
  return isRecord(result) && !Array.isArray(result) ? result : obj;
}

/** Color a fitness score: green (>70), yellow (>40), red. */
export function scoreColor(score: number): string {
  if (score > 70) return "#22c55e";
  if (score > 40) return "#eab308";
  return "#ef4444";
}

/** Read a Response body stream to a string. */
export async function readStream(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

const parseNdjsonLines = <T>(text: string): T[] =>
  text
    .split("\n")
    .filter(line => line.trim() !== "")
    .map((line): T => JSON.parse(line));

async function readNdjsonFrom<T>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  onLine: (line: T) => void,
  carry: string,
  collected: readonly T[],
): Promise<T[]> {
  const { done, value } = await reader.read();
  const text = carry + decoder.decode(value, { stream: !done });
  const boundary = done ? text.length : text.lastIndexOf("\n") + 1;
  const lines = parseNdjsonLines<T>(text.slice(0, boundary));
  for (const line of lines) onLine(line);
  const all = [...collected, ...lines];
  if (done) return all;
  return readNdjsonFrom(reader, decoder, onLine, text.slice(boundary), all);
}

/**
 * Read an NDJSON response, calling onLine with each parsed line as soon as
 * its newline arrives (a trailing line without one is parsed at the end).
 * Resolves with every parsed line in order.
 */
export async function readNdjson<T>(
  res: Response,
  onLine: (line: T) => void,
): Promise<T[]> {
  const reader = res.body?.getReader();
  if (!reader) return [];
  return readNdjsonFrom(reader, new TextDecoder(), onLine, "", []);
}
