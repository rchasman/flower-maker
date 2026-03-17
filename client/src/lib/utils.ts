/** Execute a block and return its value. Use instead of IIFEs. */
export const run = <T>(f: () => T): T => f();

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
