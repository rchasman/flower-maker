import { describe, expect, mock, test } from "bun:test";
import type { Experimental_EvaluationModelV4CallOptions as CallOptions } from "@ai-sdk/provider";
import {
  buildAnswerSchema,
  filterPartial,
  floristInstructions,
  jevSource,
  textModelSource,
} from "./answering.ts";
import type { Questions } from "./questions.ts";
import {
  fakeEvaluationModel,
  fakeTextModel,
  rejection,
} from "./test-helpers.ts";

const signal = new AbortController().signal;

const questions: Questions = {
  pose: {
    type: "choice",
    instructions:
      "How do the petals curve on the flower described in `request`?",
    criteria: { recurved: "bent back", open: null, cupped: "bowl" },
  },
  has_thorns: {
    type: "boolean",
    instructions: "Thorns on the flower described in `request`?",
    criteria: { true: "thorns named", false: "no thorns" },
  },
};

describe("jevSource", () => {
  test("yields one answer set with choice names and booleans", async () => {
    const onCall = mock((_options: CallOptions) => {});
    const source = jevSource(
      fakeEvaluationModel({ pose: "cupped", has_thorns: 0.9 }, onCall),
    );
    const yielded = await Array.fromAsync(
      source(questions, { request: "a thorny cup" }, signal),
    );
    expect(yielded).toEqual([{ pose: "cupped", has_thorns: true }]);
    const options = onCall.mock.calls[0]?.[0];
    expect(options?.state).toEqual({ request: "a thorny cup" });
    expect(options?.abortSignal).toBe(signal);
    expect(Object.keys(options?.questions ?? {})).toEqual([
      "pose",
      "has_thorns",
    ]);
  });

  test("a low probability is false", async () => {
    const source = jevSource(fakeEvaluationModel({ has_thorns: 0.2 }));
    const [answers] = await Array.fromAsync(
      source(questions, { request: "" }, signal),
    );
    expect(answers).toEqual({ pose: "recurved", has_thorns: false });
  });
});

describe("buildAnswerSchema", () => {
  const schema = buildAnswerSchema(questions);

  test("accepts a complete answer set", () => {
    expect(schema.parse({ pose: "open", has_thorns: false })).toEqual({
      pose: "open",
      has_thorns: false,
    });
  });

  test("rejects an option that is not a criteria key", () => {
    expect(schema.safeParse({ pose: "flat", has_thorns: false }).success).toBe(
      false,
    );
  });

  test("every question is required", () => {
    expect(schema.safeParse({ pose: "open" }).success).toBe(false);
  });
});

describe("filterPartial", () => {
  test("drops prefixes, wrong types and unknown ids", () => {
    expect(
      filterPartial(questions, {
        pose: "cup",
        has_thorns: "yes",
        color: "red",
      }),
    ).toEqual({});
  });

  test("keeps complete answers", () => {
    expect(
      filterPartial(questions, { pose: "cupped", has_thorns: false }),
    ).toEqual({ pose: "cupped", has_thorns: false });
  });

  test("does not accept object prototype names as options", () => {
    expect(filterPartial(questions, { pose: "constructor" })).toEqual({});
  });
});

describe("floristInstructions", () => {
  test("lists every question as id: instructions (option: description)", () => {
    const text = floristInstructions(questions);
    expect(text).toContain(
      "- pose: How do the petals curve on the flower described in `request`? (recurved: bent back, open, cupped: bowl)",
    );
    expect(text).toContain(
      "- has_thorns: Thorns on the flower described in `request`? (true: thorns named, false: no thorns)",
    );
  });
});

describe("textModelSource", () => {
  test("yields filtered partials in order, then the complete answers", async () => {
    const source = textModelSource(
      fakeTextModel(['{"pose":"cup', 'ped","has_thorns":tr', "ue}"]),
    );
    const yielded = await Array.fromAsync(
      source(questions, { request: "a thorny cup" }, signal),
    );
    expect(yielded.at(-1)).toEqual({ pose: "cupped", has_thorns: true });
    expect(yielded.length).toBeGreaterThan(1);
    yielded.map(partial =>
      Object.entries(partial).map(([id, value]) => {
        const question = questions[id];
        if (question?.type === "choice") {
          expect(
            typeof value === "string" &&
              Object.hasOwn(question.criteria, value),
          ).toBe(true);
        } else {
          expect(typeof value).toBe("boolean");
        }
      }),
    );
    const firstComplete = yielded.findIndex(
      partial => partial.pose === "cupped",
    );
    expect(firstComplete).toBeGreaterThanOrEqual(0);
    expect(firstComplete).toBeLessThan(yielded.length - 1);
  });

  test("a model that never closes its JSON fails with a clear error", async () => {
    const source = textModelSource(fakeTextModel(['{"pose":"cupp']));
    const failure = await rejection(
      Array.fromAsync(source(questions, { request: "" }, signal)),
    );
    expect(String(failure)).toContain("did not return a complete answer set");
  });

  test("the model is told to answer as a florist about the request", async () => {
    const model = fakeTextModel(['{"pose":"open","has_thorns":false}']);
    await Array.fromAsync(
      textModelSource(model)(questions, { request: "a plain flower" }, signal),
    );
    const call = model.doStreamCalls[0];
    expect(call?.abortSignal).toBe(signal);
    const system = call?.prompt.find(message => message.role === "system");
    expect(system?.content).toContain("florist");
    expect(system?.content).toContain("- pose:");
    const user = call?.prompt.find(message => message.role === "user");
    expect(JSON.stringify(user?.content)).toContain("a plain flower");
  });
});
