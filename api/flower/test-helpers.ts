// Fakes shared by the generator tests: an evaluation model that answers every
// question with its first option unless overridden, a text model that streams
// scripted JSON, and an answer source scripted per stage.
import type {
  Experimental_EvaluationModelV4Answer as Answer,
  Experimental_EvaluationModelV4CallOptions as CallOptions,
  Experimental_EvaluationModelV4Question as Question,
  LanguageModelV4StreamPart as StreamPart,
} from "@ai-sdk/provider";
import {
  Experimental_EvaluationMockModelV4 as EvaluationMockModel,
  MockLanguageModelV4,
  simulateReadableStream,
} from "ai/test";
import type { AnswerSource, PartialAnswers } from "./answering.ts";

export type Overrides = Record<string, string | number>;

function firstOption(criteria: Readonly<Record<string, unknown>>): string {
  const [first] = Object.keys(criteria);
  if (first === undefined) throw new Error("question has no options");
  return first;
}

function answerFor(
  id: string,
  question: Question,
  overrides: Overrides,
): Answer {
  const override = overrides[id];
  if (question.type === "boolean") {
    return {
      type: "boolean",
      probability: typeof override === "number" ? override : 0.1,
    };
  }
  if (question.type === "score") return { type: "score", score: 0 };
  const picked =
    typeof override === "string" ? override : firstOption(question.criteria);
  return {
    type: "choice",
    choice: picked,
    probabilities: Object.fromEntries(
      Object.keys(question.criteria).map(key => [key, key === picked ? 1 : 0]),
    ),
  };
}

/** Choice ids override with an option name, boolean ids with a probability. */
export function fakeEvaluationModel(
  overrides: Overrides = {},
  onCall?: (options: CallOptions) => void,
): EvaluationMockModel {
  return new EvaluationMockModel({
    provider: "test",
    modelId: "typesafe-ai/jev",
    doEvaluate: async options => {
      onCall?.(options);
      return {
        answers: Object.fromEntries(
          Object.entries(options.questions).map(([id, question]) => [
            id,
            answerFor(id, question, overrides),
          ]),
        ),
        warnings: [],
      };
    },
  });
}

const finishPart: StreamPart = {
  type: "finish",
  finishReason: { unified: "stop", raw: undefined },
  usage: {
    inputTokens: {
      total: 1,
      noCache: 1,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: { total: 1, text: 1, reasoning: undefined },
  },
};

/** Streams the given text deltas as one JSON text response. */
export function fakeTextModel(deltas: readonly string[]): MockLanguageModelV4 {
  const chunks: StreamPart[] = [
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "1" },
    ...deltas.map((delta): StreamPart => ({
      type: "text-delta",
      id: "1",
      delta,
    })),
    { type: "text-end", id: "1" },
    finishPart,
  ];
  return new MockLanguageModelV4({
    doStream: async () => ({ stream: simulateReadableStream({ chunks }) }),
  });
}

/** Resolves with the rejection reason; fails when the promise resolves. */
export async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("expected the promise to reject");
    },
    (reason: unknown) => reason,
  );
}

/** Yields the stage one script when asked for the mood, else the stage two script. */
export function stagedSource(
  stageOne: readonly PartialAnswers[],
  stageTwo: readonly PartialAnswers[],
): AnswerSource {
  return async function* (questions) {
    yield* "mood" in questions ? stageOne : stageTwo;
  };
}
