import { describe, expect, test } from "bun:test";
import type { Experimental_EvaluationModel as EvaluationModel } from "ai";
import type {
  Experimental_EvaluationModelV4Answer as Answer,
  Experimental_EvaluationModelV4CallOptions as CallOptions,
  Experimental_EvaluationModelV4Question as Question,
} from "@ai-sdk/provider";
import { parse as parseYaml } from "yaml";
import { TEMPLATES } from "../../client/src/data/templates.ts";
import { FLOWER_QUESTIONS, generateSpecYamlWithJev } from "./jevSpec";

type Overrides = Record<string, string | number>;

function firstOption(criteria: Readonly<Record<string, unknown>>): string {
  const [first] = Object.keys(criteria);
  if (!first) throw new Error("question has no options");
  return first;
}

function answerFor(
  id: string,
  question: Question,
  overrides: Overrides,
): Answer {
  if (question.type === "boolean") {
    const override = overrides[id];
    return {
      type: "boolean",
      probability: typeof override === "number" ? override : 0.1,
    };
  }
  if (question.type === "score") {
    return { type: "score", score: 0 };
  }
  const override = overrides[id];
  const picked =
    typeof override === "string" ? override : firstOption(question.criteria);
  const probabilities = Object.fromEntries(
    Object.keys(question.criteria).map(key => [key, key === picked ? 1 : 0]),
  );
  return { type: "choice", choice: picked, probabilities };
}

function stubModel(
  overrides: Overrides,
  seen: { options?: CallOptions },
): EvaluationModel {
  return {
    specificationVersion: "v4",
    provider: "test",
    modelId: "typesafe-ai/jev",
    supportedQuestionTypes: ["choice", "score", "boolean"],
    doEvaluate: async options => {
      seen.options = options;
      const answers = Object.fromEntries(
        Object.entries(options.questions).map(([id, question]) => [
          id,
          answerFor(id, question, overrides),
        ]),
      );
      return { answers, warnings: [] };
    },
  };
}

describe("generateSpecYamlWithJev", () => {
  test("assembles a renderable spec from Jev's selections", async () => {
    const seen: { options?: CallOptions } = {};
    const yaml = await generateSpecYamlWithJev(
      stubModel(
        {
          template: "Orchid",
          name_word: "Frost",
          petal_shape: "Falcate",
          arrangement: "Zygomorphic",
          layer_count: "triple",
          petal_count: "five_or_six",
          petal_pose: "recurved",
          primary_color: "sky",
          secondary_color: "white",
          aura: "Frost",
          aura_color: "sky",
          has_thorns: 0.2,
          has_dewdrops: 0.9,
          stem_height: "tall",
          stamens: "prominent",
        },
        seen,
      ),
      { prompt: "a frosty orchid dripping with dew" },
    );
    const spec = parseYaml(yaml);

    expect(seen.options?.state).toEqual({
      request: "a frosty orchid dripping with dew",
    });
    expect(Object.keys(seen.options?.questions ?? {})).toEqual(
      Object.keys(FLOWER_QUESTIONS),
    );
    expect(spec.name).toBe("Frost Orchid");
    expect(spec.species).toBe("Phalaenopsis amabilis");
    expect(spec.petals.layers).toHaveLength(3);
    expect(spec.petals.layers.map((l: { count: number }) => l.count)).toEqual([
      5, 4, 3,
    ]);
    expect(spec.petals.layers[0].shape).toBe("Falcate");
    expect(spec.petals.layers[0].curvature).toBe(-0.3);
    expect(spec.petals.layers[0].color.stops[0].color).toEqual({
      r: 0.49,
      g: 0.827,
      b: 0.988,
      a: 1,
    });
    expect(spec.aura.kind).toBe("Frost");
    expect(spec.structure.stem.thorns).toBeUndefined();
    expect(spec.ornamentation.dewdrops).toHaveLength(1);
    expect(spec.foliage.leaves).toHaveLength(4);
    expect(spec.reproductive.stamens).toHaveLength(6);
  });

  test("a requested template wins over Jev's template choice", async () => {
    const yaml = await generateSpecYamlWithJev(
      stubModel({ template: "Rose", name_word: "Garden" }, {}),
      {
        prompt: "Tulip",
        templateName: "Tulip",
      },
    );
    expect(parseYaml(yaml).name).toBe("Garden Tulip");
  });

  test("an ordinary flower gets no aura, thorns or dewdrops", async () => {
    const yaml = await generateSpecYamlWithJev(
      stubModel(
        {
          aura: "none",
          has_thorns: 0.3,
          has_dewdrops: 0.1,
          layer_count: "single",
        },
        {},
      ),
      { prompt: "a plain daisy" },
    );
    const spec = parseYaml(yaml);
    expect(spec.aura).toBeUndefined();
    expect(spec.ornamentation).toBeUndefined();
    expect(spec.structure.stem.thorns).toBeUndefined();
    expect(spec.petals.layers).toHaveLength(1);
  });

  test("every template is an option so Jev can pick any real flower", () => {
    expect(Object.keys(FLOWER_QUESTIONS.template.criteria)).toContain(
      "Queen Anne's Lace",
    );
    expect(Object.keys(FLOWER_QUESTIONS.template.criteria)).toHaveLength(
      TEMPLATES.length,
    );
  });
});
