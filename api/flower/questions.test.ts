import { describe, expect, test } from "bun:test";
import type { Experimental_EvaluationQuestion as EvaluationQuestion } from "ai";
import {
  FLOWER_FAMILIES,
  SERRATIONS,
  isVariant,
} from "../../client/src/data/flower-enums.ts";
import { TEMPLATES } from "../../client/src/data/templates.ts";
import {
  NONE,
  PROFILE_LIST_FOR_ANSWER,
  STAGE_TWO_FIELDS,
  STAGE_TWO_IDS,
} from "./assemble.ts";
import { FAMILIES, STRANGENESS, legalList } from "./families.ts";
import { stageOneQuestions, stageTwoQuestions } from "./questions.ts";

const findTemplate = (name: string) => {
  const template = TEMPLATES.find(t => t.name === name);
  if (template === undefined) throw new Error(`no template ${name}`);
  return template;
};

const optionsOf = (question: EvaluationQuestion | undefined): string[] => {
  if (question?.type !== "choice") throw new Error("not a choice question");
  return Object.keys(question.criteria);
};

describe("stageOneQuestions", () => {
  test("asks family, template, strangeness and mood, all about `request`", () => {
    const questions = stageOneQuestions(TEMPLATES);
    expect(Object.keys(questions)).toEqual([
      "family",
      "template",
      "strangeness",
      "mood",
    ]);
    Object.values(questions).map(q =>
      expect(q.instructions).toContain("`request`"),
    );
    expect(optionsOf(questions.family)).toEqual([...FLOWER_FAMILIES]);
    expect(optionsOf(questions.template)).toEqual([
      NONE,
      ...TEMPLATES.map(t => t.name),
    ]);
  });

  test("a chosen template removes the family and template questions", () => {
    const questions = stageOneQuestions(TEMPLATES, findTemplate("Iris"));
    expect(Object.keys(questions)).toEqual(["strangeness", "mood"]);
  });
});

describe("stageTwoQuestions", () => {
  const iris = FAMILIES.Iridaceae;

  test("every question is about `request` and offers only legal options", () => {
    FLOWER_FAMILIES.flatMap(key =>
      STRANGENESS.map(strangeness => ({ profile: FAMILIES[key], strangeness })),
    ).map(({ profile, strangeness }) => {
      const questions = stageTwoQuestions(profile, strangeness);
      STAGE_TWO_IDS.map(id => {
        const question = questions[id];
        if (question === undefined) return;
        expect(question.instructions).toContain("`request`");
        const field = STAGE_TWO_FIELDS[id];
        if (field.type !== "choice") return;
        const options = optionsOf(question);
        expect(options.length).toBeGreaterThan(1);
        options.map(option =>
          expect(isVariant(field.options, option), `${id}: ${option}`).toBe(
            true,
          ),
        );
      });
      Object.keys(questions).map(id =>
        expect(isVariant(STAGE_TWO_IDS, id), id).toBe(true),
      );
    });
  });

  test("Iridaceae faithful keeps fusion_kind to the family's fusions", () => {
    const options = optionsOf(stageTwoQuestions(iris, "faithful").fusion_kind);
    expect(options).toEqual([...iris.fusions]);
    expect(options).not.toContain("Bell");
  });

  test("a question whose legal list has one option is not asked", () => {
    expect(iris.serrations).toHaveLength(1);
    expect(stageTwoQuestions(iris, "faithful").serration).toBeUndefined();
    expect(optionsOf(stageTwoQuestions(iris, "invented").serration)).toEqual([
      ...SERRATIONS,
    ]);
  });

  test("a template's inflorescence hint is listed first", () => {
    const delphinium = findTemplate("Delphinium");
    expect(delphinium.inflorescence).toBe("Spike");
    const profile = FAMILIES[delphinium.family];
    const options = optionsOf(
      stageTwoQuestions(profile, "faithful", delphinium).inflorescence_kind,
    );
    expect(options[0]).toBe("Spike");
    expect([...options].sort()).toEqual(
      [...legalList(profile, "faithful", "inflorescences")].sort(),
    );
  });

  test("boolean questions describe both answers", () => {
    const thorns = stageTwoQuestions(iris, "faithful").has_thorns;
    if (thorns?.type !== "boolean") throw new Error("has_thorns not boolean");
    expect(thorns.criteria?.true).toBeString();
    expect(thorns.criteria?.false).toBeString();
  });

  test("colors are asked as palette names filtered by the family", () => {
    expect(PROFILE_LIST_FOR_ANSWER.outer_base_color).toBe("colors");
    expect(
      optionsOf(stageTwoQuestions(iris, "faithful").outer_base_color),
    ).toEqual([...iris.colors]);
  });
});
