// The one client for POST /api/flower/generate. The server answers with
// NDJSON: one spec snapshot per line as the answers land, the last line with
// done true, or an error line when generation fails after it started.
import { readNdjson } from "../lib/utils.ts";

export type Answer = { id: string; value: string | boolean };

export type Snapshot = {
  stage: 1 | 2;
  answers: Answer[];
  spec: string;
  done: boolean;
};

type GenerationLine = Snapshot | { error: string };

export type GenerationResult = { spec: string; answers: Answer[] };

export type GenerateFlowerInput = {
  prompt: string;
  templateName?: string;
  model: string;
  onSnapshot: (snapshot: Snapshot) => void;
  signal?: AbortSignal;
};

const isSnapshot = (line: GenerationLine): line is Snapshot =>
  !("error" in line);

async function failureMessage(res: Response): Promise<string> {
  const body: unknown = await res.json().catch(() => null);
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return res.statusText || `HTTP ${res.status}`;
}

export async function generateFlower({
  prompt,
  templateName,
  model,
  onSnapshot,
  signal,
}: GenerateFlowerInput): Promise<GenerationResult> {
  const res = await fetch("/api/flower/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, template_name: templateName, model }),
    signal,
  });
  if (!res.ok) throw new Error(await failureMessage(res));

  const lines = await readNdjson<GenerationLine>(res, line => {
    if (isSnapshot(line)) onSnapshot(line);
  });
  const last = lines.at(-1);
  if (last === undefined) throw new Error("The generation stream was empty");
  if (!isSnapshot(last)) throw new Error(last.error);
  if (!last.done) throw new Error("The generation stream ended early");
  return { spec: last.spec, answers: last.answers };
}
