import { describe, expect, test } from "bun:test";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { parse as parseYaml } from "yaml";
import { TEMPLATES } from "../../client/src/data/templates.ts";
import { FLOWER_QUESTIONS, generateSpecYamlWithJev } from "./jevSpec";

type Criteria = Record<string, unknown>;

function firstOption(criteria: Criteria): string {
  const [first] = Object.keys(criteria);
  if (!first) throw new Error("question has no options");
  return first;
}

function answersFrom(overrides: Record<string, string | number>) {
  return Object.fromEntries(
    Object.entries(FLOWER_QUESTIONS).map(([id, question]) => {
      if (question.type === "noul") {
        return [id, { type: "noul", noul: overrides[id] ?? 0.1 }];
      }
      const picked = overrides[id] ?? firstOption(question.criteria);
      return [
        id,
        {
          type: "choice",
          choice: picked,
          probabilities: { [picked]: 1 },
          confidence: 1,
        },
      ];
    }),
  );
}

function stubClient(
  overrides: Record<string, string | number>,
  seen: { body?: Record<string, unknown> },
) {
  return new TypeSafeClient({
    apiKey: "test",
    fetch: async (_url, init) => {
      seen.body = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          model: "jev-1.13.0",
          answers: answersFrom(overrides),
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { headers: { "content-type": "application/json" } },
      );
    },
  });
}

describe("generateSpecYamlWithJev", () => {
  test("assembles a renderable spec from Jev's selections", async () => {
    const seen: { body?: Record<string, unknown> } = {};
    const yaml = await generateSpecYamlWithJev(
      stubClient(
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
      { prompt: "a frosty orchid dripping with dew", model: "jev-1.13.0" },
    );
    const spec = parseYaml(yaml);

    expect(seen.body?.model).toBe("jev-1.13.0");
    expect(seen.body?.state).toEqual({
      request: "a frosty orchid dripping with dew",
    });
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
      stubClient({ template: "Rose", name_word: "Garden" }, {}),
      { prompt: "Tulip", templateName: "Tulip", model: "jev-1.13.0" },
    );
    expect(parseYaml(yaml).name).toBe("Garden Tulip");
  });

  test("an ordinary flower gets no aura, thorns or dewdrops", async () => {
    const yaml = await generateSpecYamlWithJev(
      stubClient(
        {
          aura: "none",
          has_thorns: 0.3,
          has_dewdrops: 0.1,
          layer_count: "single",
        },
        {},
      ),
      { prompt: "a plain daisy", model: "jev-1.13.0" },
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
