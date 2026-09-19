import { afterAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { errorMessage } from "../lib/utils.ts";
import { generateFlower, type Snapshot } from "./generateFlower.ts";

const STAGE_ONE: Snapshot = {
  stage: 1,
  answers: [{ id: "family", value: "Iridaceae" }],
  spec: "name: Iris\n",
  done: false,
};

const FINAL: Snapshot = {
  stage: 2,
  answers: [
    { id: "family", value: "Iridaceae" },
    { id: "pollen_drift", value: true },
  ],
  spec: "name: Dawn Iris\n",
  done: true,
};

const ndjson = (lines: readonly unknown[]): string =>
  lines.map(line => `${JSON.stringify(line)}\n`).join("");

const ndjsonResponse = (lines: readonly unknown[]): Response =>
  new Response(ndjson(lines), {
    headers: { "Content-Type": "application/x-ndjson" },
  });

const fetchSpy = spyOn(globalThis, "fetch");

function stubFetch(respond: () => Response): RequestInit[] {
  const calls: RequestInit[] = [];
  const stub = (_input: URL | RequestInfo, init?: RequestInit) => {
    if (init) calls.push(init);
    return Promise.resolve(respond());
  };
  fetchSpy.mockImplementation(
    Object.assign(stub, { preconnect: fetch.preconnect }),
  );
  return calls;
}

const rejection = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => {
      throw new Error("expected the promise to reject");
    },
    (error: unknown) => error,
  );

const generate = (overrides: { templateName?: string } = {}) =>
  generateFlower({
    prompt: "an iris",
    model: "m",
    onSnapshot: () => {},
    ...overrides,
  });

beforeEach(() => fetchSpy.mockReset());
afterAll(() => fetchSpy.mockRestore());

describe("generateFlower", () => {
  test("posts the prompt, template and model", async () => {
    const calls = stubFetch(() => ndjsonResponse([STAGE_ONE, FINAL]));
    await generate({ templateName: "Iris" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe("POST");
    const body = calls[0]?.body;
    if (typeof body !== "string") throw new Error("body was not a string");
    expect(JSON.parse(body)).toEqual({
      prompt: "an iris",
      template_name: "Iris",
      model: "m",
    });
  });

  test("reports every snapshot and resolves with the final spec", async () => {
    stubFetch(() => ndjsonResponse([STAGE_ONE, FINAL]));
    const seen: Snapshot[] = [];
    const result = await generateFlower({
      prompt: "an iris",
      model: "m",
      onSnapshot: snapshot => seen.push(snapshot),
    });
    expect(seen).toEqual([STAGE_ONE, FINAL]);
    expect(result).toEqual({ spec: FINAL.spec, answers: FINAL.answers });
  });

  test("throws the error line's message and skips it as a snapshot", async () => {
    stubFetch(() => ndjsonResponse([STAGE_ONE, { error: "model went away" }]));
    const seen: Snapshot[] = [];
    const failure = await rejection(
      generateFlower({
        prompt: "an iris",
        model: "m",
        onSnapshot: snapshot => seen.push(snapshot),
      }),
    );
    expect(errorMessage(failure)).toBe("model went away");
    expect(seen).toEqual([STAGE_ONE]);
  });

  test("throws the body error of a failed HTTP response", async () => {
    stubFetch(() =>
      Response.json(
        { error: "Unknown template: Nonesuch" },
        { status: 502, statusText: "Bad Gateway" },
      ),
    );
    const failure = await rejection(generate());
    expect(errorMessage(failure)).toBe("Unknown template: Nonesuch");
  });

  test("falls back to the status text when the failure has no body", async () => {
    stubFetch(
      () => new Response(null, { status: 503, statusText: "Unavailable" }),
    );
    const failure = await rejection(generate());
    expect(errorMessage(failure)).toBe("Unavailable");
  });

  test("throws when the stream ends without a done line", async () => {
    stubFetch(() => ndjsonResponse([STAGE_ONE]));
    const failure = await rejection(generate());
    expect(errorMessage(failure)).toBe("The generation stream ended early");
  });
});
