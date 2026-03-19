/** Execute a block and return its value. Use instead of IIFEs. */
export const run = <T>(f: () => T): T => f();

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
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => {
    if (o && typeof o === "object" && k in (o as Record<string, unknown>)) {
      return (o as Record<string, unknown>)[k];
    }
    return null;
  }, obj);
}

/** Set a nested value on an object by dot-separated path, creating intermediates. */
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let target = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]!;
    if (target[k] == null || typeof target[k] !== "object") {
      target[k] = {};
    }
    target = target[k] as Record<string, unknown>;
  }
  target[keys[keys.length - 1]!] = value;
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

/** Read a stream, calling onChunk with the accumulated text after each chunk. */
export async function readStreamWithProgress(
  res: Response,
  onChunk: (accumulated: string) => void,
): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
    onChunk(result);
  }
  return result;
}
