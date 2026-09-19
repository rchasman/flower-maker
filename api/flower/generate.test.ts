import { describe, expect, mock, test } from "bun:test";
import { parse as parseYaml } from "yaml";
import { jevSource, type AnswerSource } from "./answering.ts";
import { handleGenerateWith } from "./generate.ts";
import { FlowerSpecSchema } from "./specSchema.ts";
import { fakeEvaluationModel, stagedSource } from "./test-helpers.ts";

const post = (body: unknown) =>
  new Request("http://localhost/flower/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const lines = async (response: Response): Promise<unknown[]> =>
  (await response.text())
    .split("\n")
    .filter(line => line.length > 0)
    .map(line => JSON.parse(line));

type SnapshotLine = { stage: number; done: boolean; spec: string };

const isSnapshot = (value: unknown): value is SnapshotLine =>
  typeof value === "object" && value !== null && "spec" in value;

describe("handleGenerateWith", () => {
  test("streams NDJSON snapshots and hands the model id to the chooser", async () => {
    const sourceFor = mock((_modelId: string) =>
      jevSource(fakeEvaluationModel({ family: "Rosaceae", mood: "Velvet" })),
    );
    const response = await handleGenerateWith(sourceFor)(
      post({ prompt: "a velvet rose", model: "typesafe-ai/jev" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/x-ndjson; charset=utf-8",
    );
    expect(sourceFor.mock.calls).toEqual([["typesafe-ai/jev"]]);
    const parsed = await lines(response);
    expect(parsed).toHaveLength(2);
    const snapshots = parsed.filter(isSnapshot);
    expect(snapshots.map(s => [s.stage, s.done])).toEqual([
      [1, false],
      [2, true],
    ]);
    snapshots.map(s => {
      const spec = FlowerSpecSchema.parse(parseYaml(s.spec));
      expect(spec.taxonomy.family).toBe("Rosaceae");
      expect(spec.name.startsWith("Velvet ")).toBe(true);
    });
  });

  test("the default model is used when the body names none", async () => {
    const sourceFor = mock((_modelId: string) => stagedSource([], []));
    await handleGenerateWith(sourceFor)(post({ prompt: "anything" }));
    expect(sourceFor.mock.calls).toEqual([["google/gemini-3.1-flash-lite"]]);
  });

  test("a failure after the first line is written as an error line", async () => {
    const source: AnswerSource = async function* (questions) {
      if ("mood" in questions) {
        yield { family: "Liliaceae", strangeness: "faithful", mood: "Dawn" };
        return;
      }
      throw new Error("model went away");
    };
    const response = await handleGenerateWith(() => source)(
      post({ prompt: "a lily" }),
    );
    expect(response.status).toBe(200);
    const parsed = await lines(response);
    expect(parsed).toHaveLength(2);
    expect(isSnapshot(parsed[0])).toBe(true);
    expect(parsed[1]).toEqual({ error: "model went away" });
  });

  test("a failure before the first line is a 502", async () => {
    const source: AnswerSource = () => {
      throw new Error("no model");
    };
    const response = await handleGenerateWith(() => source)(
      post({ prompt: "a lily" }),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "no model" });
  });

  test("an invalid body is a 502", async () => {
    const handler = handleGenerateWith(() => stagedSource([], []));
    expect((await handler(post({ model: "x" }))).status).toBe(502);
    expect((await handler(post("not json"))).status).toBe(502);
  });

  test("an unknown template is a 502", async () => {
    const handler = handleGenerateWith(() => stagedSource([], []));
    const response = await handler(
      post({ prompt: "x", template_name: "Nonesuch" }),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Unknown template: Nonesuch",
    });
  });
});
