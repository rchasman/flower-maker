// Runs the two question stages against one answer source and turns every
// answer set into a complete spec snapshot, so the canvas can update as the
// answers land.
import { stringify as toYaml } from "yaml";
import {
  FLOWER_FAMILIES,
  isVariant,
} from "../../client/src/data/flower-enums.ts";
import type { TemplateInfo } from "../../client/src/data/templates.ts";
import type { AnswerSource, PartialAnswers } from "./answering.ts";
import {
  MOOD_WORDS,
  NONE,
  assembleSpec,
  type StageOneAnswers,
} from "./assemble.ts";
import { FAMILIES, STRANGENESS } from "./families.ts";
import { first } from "./lists.ts";
import {
  stageOneQuestions,
  stageTwoQuestions,
  type Questions,
} from "./questions.ts";
import { seedFromPrompt } from "./seed.ts";

export type Answer = { id: string; value: string | boolean };

export type Snapshot = {
  stage: 1 | 2;
  answers: Answer[];
  spec: string;
  done: boolean;
};

export type GenerateInput = {
  source: AnswerSource;
  prompt: string;
  templateName?: string;
  templates: readonly TemplateInfo[];
};

// Later partials win per id; an id keeps the position of its first arrival.
async function* accumulate(
  partials: AsyncIterator<PartialAnswers>,
  merged: PartialAnswers = {},
): AsyncGenerator<PartialAnswers, PartialAnswers> {
  const next = await partials.next();
  if (next.done) return merged;
  const answers = { ...merged, ...next.value };
  yield answers;
  return yield* accumulate(partials, answers);
}

const answersOf = (
  source: AnswerSource,
  questions: Questions,
  request: string,
): AsyncGenerator<PartialAnswers, PartialAnswers> =>
  accumulate(source(questions, { request })[Symbol.asyncIterator]());

async function finalAnswers(
  merged: AsyncGenerator<PartialAnswers, PartialAnswers>,
): Promise<PartialAnswers> {
  const next = await merged.next();
  return next.done ? next.value : finalAnswers(merged);
}

type SnapshotOf = (answers: PartialAnswers, done: boolean) => Snapshot;

// Each answer set is emitted once the next one arrives, so the last set is
// the line that carries done: true and a one shot source gives one line.
async function* stageTwoSnapshots(
  merged: AsyncGenerator<PartialAnswers, PartialAnswers>,
  snapshot: SnapshotOf,
  held?: PartialAnswers,
): AsyncGenerator<Snapshot> {
  const next = await merged.next();
  if (next.done) {
    yield snapshot(held ?? next.value, true);
    return;
  }
  if (held !== undefined) yield snapshot(held, false);
  yield* stageTwoSnapshots(merged, snapshot, next.value);
}

const toList = (answers: PartialAnswers): Answer[] =>
  Object.entries(answers).map(([id, value]) => ({ id, value }));

function requestedTemplate(
  templates: readonly TemplateInfo[],
  templateName: string | undefined,
): TemplateInfo | undefined {
  if (templateName === undefined) return undefined;
  const template = templates.find(t => t.name === templateName);
  if (template === undefined) {
    throw new Error(`Unknown template: ${templateName}`);
  }
  return template;
}

type Lineage = {
  stageOne: StageOneAnswers;
  template: TemplateInfo | undefined;
};

// A template the model picks only counts when it agrees with the family it
// picked, so the skeleton always comes from the family answer.
function resolveLineage(
  answers: PartialAnswers,
  templates: readonly TemplateInfo[],
  requested: TemplateInfo | undefined,
): Lineage {
  const answeredFamily = answers.family;
  const family =
    requested?.family ??
    (isVariant(FLOWER_FAMILIES, answeredFamily) ? answeredFamily : "Invented");
  const answered = templates.find(t => t.name === answers.template);
  const template =
    requested ?? (answered?.family === family ? answered : undefined);
  const strangeness = answers.strangeness;
  const mood = answers.mood;
  return {
    template,
    stageOne: {
      family,
      template: template?.name ?? NONE,
      strangeness: isVariant(STRANGENESS, strangeness)
        ? strangeness
        : first(STRANGENESS, "STRANGENESS"),
      mood: isVariant(MOOD_WORDS, mood)
        ? mood
        : first(MOOD_WORDS, "MOOD_WORDS"),
    },
  };
}

const stageOneList = (stageOne: StageOneAnswers): Answer[] =>
  toList({
    family: stageOne.family,
    template: stageOne.template,
    strangeness: stageOne.strangeness,
    mood: stageOne.mood,
  });

export async function* generateFlower(
  input: GenerateInput,
): AsyncIterable<Snapshot> {
  const { source, prompt, templates } = input;
  const requested = requestedTemplate(templates, input.templateName);
  const seed = seedFromPrompt(prompt);

  const { stageOne, template } = resolveLineage(
    await finalAnswers(
      answersOf(source, stageOneQuestions(templates, requested), prompt),
    ),
    templates,
    requested,
  );
  const profile = FAMILIES[stageOne.family];
  const strangeness = stageOne.strangeness;
  const stageOneAnswers = stageOneList(stageOne);
  const snapshot = (
    stage: 1 | 2,
    answers: PartialAnswers,
    done: boolean,
  ): Snapshot => ({
    stage,
    answers: [...stageOneAnswers, ...toList(answers)],
    spec: toYaml(
      assembleSpec({ profile, strangeness, answers, stageOne, seed, template }),
    ),
    done,
  });

  yield snapshot(1, {}, false);

  const questions = stageTwoQuestions(profile, strangeness, template);
  yield* stageTwoSnapshots(
    answersOf(source, questions, prompt),
    (answers, done) => snapshot(2, answers, done),
  );
}
