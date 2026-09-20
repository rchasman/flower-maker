// POST /flower/generate. Streams NDJSON: one spec snapshot per line as the
// answers land, a final line with done true, or an error line when the
// pipeline fails after the first snapshot. A failure before the first
// snapshot is an ordinary 502 JSON response.
import { gateway } from "ai";
import { z } from "zod";
import { TEMPLATES } from "../../client/src/data/templates.ts";
import { DEFAULT_MODEL, JEV_MODEL } from "../config/models.ts";
import { jevSource, textModelSource, type AnswerSource } from "./answering.ts";
import { generateFlower, type Snapshot } from "./pipeline.ts";

const GenerateBody = z.object({
  prompt: z.string(),
  template_name: z.string().optional(),
  model: z.string().default(DEFAULT_MODEL),
});

export type SourceFor = (modelId: string) => AnswerSource;

const gatewaySource: SourceFor = modelId =>
  modelId === JEV_MODEL
    ? jevSource(gateway.evaluationModel(JEV_MODEL))
    : textModelSource(gateway(modelId));

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const encoder = new TextEncoder();
const line = (value: unknown): Uint8Array =>
  encoder.encode(`${JSON.stringify(value)}\n`);

// Cancelling the response aborts the model calls as well as the iterator.
function ndjsonStream(
  head: Snapshot,
  rest: AsyncIterator<Snapshot>,
  abort: AbortController,
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(line(head));
    },
    async pull(controller) {
      try {
        const next = await rest.next();
        if (abort.signal.aborted) return;
        if (next.done) return controller.close();
        controller.enqueue(line(next.value));
      } catch (error) {
        console.error("[generate] failed mid-stream:", errorMessage(error));
        controller.enqueue(line({ error: errorMessage(error) }));
        controller.close();
      }
    },
    async cancel(reason: unknown) {
      abort.abort(reason);
      await rest.return?.();
    },
  });
}

export function handleGenerateWith(
  sourceFor: SourceFor,
): (request: Request) => Promise<Response> {
  return async request => {
    try {
      const body = GenerateBody.parse(await request.json());
      const abort = new AbortController();
      const snapshots = generateFlower({
        source: sourceFor(body.model),
        prompt: body.prompt,
        templateName: body.template_name,
        templates: TEMPLATES,
        signal: AbortSignal.any([request.signal, abort.signal]),
      })[Symbol.asyncIterator]();
      const head = await snapshots.next();
      if (head.done) throw new Error("generation produced no snapshot");
      return new Response(ndjsonStream(head.value, snapshots, abort), {
        headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
      });
    } catch (error) {
      const message = errorMessage(error);
      console.error("[generate] failed:", message);
      return Response.json({ error: message }, { status: 502 });
    }
  };
}

export const handleGenerate = handleGenerateWith(gatewaySource);
