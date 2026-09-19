// The model seam. Both sources take the same question map and yield answer
// sets keyed by question id: Jev answers every question in one evaluate call,
// a text model streams a structured object whose partial values are checked
// against the option lists before they are passed on.
import {
  experimental_evaluate as evaluate,
  NoObjectGeneratedError,
  Output,
  streamText,
  type Experimental_EvaluationAnswer as EvaluationAnswer,
  type Experimental_EvaluationModel as EvaluationModel,
  type Experimental_EvaluationQuestion as EvaluationQuestion,
  type LanguageModel,
} from "ai";
import { z } from "zod";
import type { Questions } from "./questions.ts";

export type PartialAnswers = Record<string, string | boolean>;

export type AnswerSource = (
  questions: Questions,
  state: { request: string },
) => AsyncIterable<PartialAnswers>;

type Entry = [string, string | boolean];

// ═══════════════════════════════════════════════════════════════════════════
// Jev
// ═══════════════════════════════════════════════════════════════════════════

function answerValue(
  id: string,
  answer: EvaluationAnswer<EvaluationQuestion>,
): Entry[] {
  if (answer.type === "choice") return [[id, answer.choice]];
  if (answer.type === "boolean") return [[id, answer.probability > 0.5]];
  return [];
}

export function jevSource(model: EvaluationModel): AnswerSource {
  return async function* (questions, state) {
    const result = await evaluate({ model, state, questions });
    yield Object.fromEntries(
      Object.entries(result.answers).flatMap(([id, answer]) =>
        answerValue(id, answer),
      ),
    );
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Text models
// ═══════════════════════════════════════════════════════════════════════════

function fieldSchema(id: string, question: EvaluationQuestion) {
  if (question.type === "choice") return z.enum(Object.keys(question.criteria));
  if (question.type === "boolean") return z.boolean();
  throw new Error(
    `question ${id} is a score question; only choice and boolean are supported`,
  );
}

/** One required field per question: an enum of the option names, or a boolean. */
export function buildAnswerSchema(questions: Questions) {
  return z.object(
    Object.fromEntries(
      Object.entries(questions).map(([id, question]) => [
        id,
        fieldSchema(id, question),
      ]),
    ),
  );
}

const isOption = (
  question: EvaluationQuestion,
  value: unknown,
): value is string =>
  question.type === "choice" &&
  typeof value === "string" &&
  Object.hasOwn(question.criteria, value);

/**
 * Keeps only values that are complete answers: a streamed partial can hold a
 * prefix of an option name, and a boolean field can arrive as anything until
 * it is closed.
 */
export function filterPartial(
  questions: Questions,
  partial: Readonly<Record<string, unknown>>,
): PartialAnswers {
  return Object.fromEntries(
    Object.entries(partial).flatMap(([id, value]): Entry[] => {
      const question = questions[id];
      if (question === undefined) return [];
      if (question.type === "boolean") {
        return typeof value === "boolean" ? [[id, value]] : [];
      }
      return isOption(question, value) ? [[id, value]] : [];
    }),
  );
}

const describeOption = ([option, description]: [string, unknown]): string =>
  typeof description === "string" ? `${option}: ${description}` : option;

// The SDK lets instructions be JSON as well as text; ours are always text.
const instructionText = (
  instructions: EvaluationQuestion["instructions"],
): string =>
  typeof instructions === "string"
    ? instructions
    : JSON.stringify(instructions);

function describeQuestion(id: string, question: EvaluationQuestion): string {
  const instructions = instructionText(question.instructions);
  if (question.type === "choice") {
    const options = Object.entries(question.criteria)
      .map(describeOption)
      .join(", ");
    return `${id}: ${instructions} (${options})`;
  }
  if (question.type === "boolean") {
    const options = [
      describeOption(["true", question.criteria?.true]),
      describeOption(["false", question.criteria?.false]),
    ].join(", ");
    return `${id}: ${instructions} (${options})`;
  }
  return `${id}: ${instructions}`;
}

export function floristInstructions(questions: Questions): string {
  const list = Object.entries(questions)
    .map(([id, question]) => `- ${describeQuestion(id, question)}`)
    .join("\n");
  return [
    "You are a florist and botanist filling in a form about one flower.",
    "The user message is the request. Answer every question below about the flower described in the request, choosing only from the listed options for each question. Where the request says nothing, choose the most natural option for that kind of flower.",
    "Questions, each as id: instructions (option: description, ...):",
    list,
  ].join("\n");
}

async function completeAnswers<T>(output: PromiseLike<T>): Promise<T> {
  try {
    return await output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error(
        `The model did not return a complete answer set: ${error.message}`,
        { cause: error },
      );
    }
    throw error;
  }
}

export function textModelSource(model: LanguageModel): AnswerSource {
  return async function* (questions, state) {
    const result = streamText({
      model,
      instructions: floristInstructions(questions),
      prompt: state.request,
      output: Output.object({ schema: buildAnswerSchema(questions) }),
    });
    for await (const partial of result.partialOutputStream) {
      yield filterPartial(questions, partial);
    }
    yield filterPartial(questions, await completeAnswers(result.output));
  };
}
