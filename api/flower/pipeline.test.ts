import { describe, expect, test } from "bun:test";
import { parse as parseYaml } from "yaml";
import { TEMPLATES } from "../../client/src/data/templates.ts";
import { jevSource } from "./answering.ts";
import { generateFlower, type Snapshot } from "./pipeline.ts";
import { FlowerSpecSchema } from "./specSchema.ts";
import {
  fakeEvaluationModel,
  rejection,
  stagedSource,
} from "./test-helpers.ts";

const answerIds = (snapshot: Snapshot) => snapshot.answers.map(a => a.id);
const valueOf = (snapshot: Snapshot, id: string) =>
  snapshot.answers.find(a => a.id === id)?.value;
const parsedSpec = (snapshot: Snapshot | undefined) => {
  if (snapshot === undefined) throw new Error("expected a snapshot");
  return FlowerSpecSchema.parse(parseYaml(snapshot.spec));
};

describe("generateFlower with a one shot source", () => {
  const run = (
    overrides: Record<string, string | number>,
    templateName?: string,
  ) =>
    Array.fromAsync(
      generateFlower({
        source: jevSource(fakeEvaluationModel(overrides)),
        prompt: "a frosty iris",
        templateName,
        templates: TEMPLATES,
      }),
    );

  test("yields stage one, then stage two done, with cumulative answers", async () => {
    const snapshots = await run({
      family: "Iridaceae",
      template: "none",
      strangeness: "stylized",
      mood: "Frost",
      outer_base_color: "sky",
    });
    expect(snapshots.map(s => [s.stage, s.done])).toEqual([
      [1, false],
      [2, true],
    ]);
    const [one, two] = snapshots;
    if (one === undefined || two === undefined) {
      throw new Error("expected two snapshots");
    }
    expect(one.answers).toEqual([
      { id: "family", value: "Iridaceae" },
      { id: "template", value: "none" },
      { id: "strangeness", value: "stylized" },
      { id: "mood", value: "Frost" },
    ]);
    expect(answerIds(two).slice(0, 4)).toEqual(answerIds(one));
    expect(two.answers.length).toBeGreaterThan(one.answers.length);
    expect(valueOf(two, "outer_base_color")).toBe("sky");
    snapshots.map(snapshot => {
      const spec = parsedSpec(snapshot);
      expect(spec.taxonomy.family).toBe("Iridaceae");
      expect(spec.name.startsWith("Frost ")).toBe(true);
    });
  });

  test("a requested template fixes the family and names the flower", async () => {
    const snapshots = await run({ mood: "Garden" }, "Tulip");
    const spec = parsedSpec(snapshots[1]);
    expect(spec.taxonomy.family).toBe("Liliaceae");
    expect(spec.name).toBe("Garden Tulip");
    expect(spec.species).toBe("Tulipa gesneriana");
    expect(snapshots[0] && valueOf(snapshots[0], "template")).toBe("Tulip");
  });

  test("the model's template only counts when it matches its family", async () => {
    const agree = await run({
      family: "Rosaceae",
      template: "Rose",
      mood: "Garden",
    });
    expect(parsedSpec(agree[1]).name).toBe("Garden Rose");
    const disagree = await run({
      family: "Iridaceae",
      template: "Rose",
      mood: "Garden",
    });
    const spec = parsedSpec(disagree[1]);
    expect(spec.taxonomy.family).toBe("Iridaceae");
    expect(spec.name).not.toBe("Garden Rose");
    expect(disagree[0] && valueOf(disagree[0], "template")).toBe("none");
  });

  test("an unknown template is an error before any snapshot", async () => {
    const failure = await rejection(run({}, "Nonesuch"));
    expect(String(failure)).toBe("Error: Unknown template: Nonesuch");
  });

  test("the same prompt gives the same spec", async () => {
    const [a, b] = await Promise.all([run({}), run({})]);
    expect(a[1]?.spec).toBeString();
    expect(a[1]?.spec).toBe(b[1]?.spec ?? "");
  });
});

describe("generateFlower with a streaming source", () => {
  test("yields one stage two snapshot per partial, all valid, done only last", async () => {
    const source = stagedSource(
      [{ family: "Asteraceae" }, { strangeness: "faithful", mood: "Solar" }],
      [
        { pose: "open" },
        { pose: "cupped", has_thorns: true },
        { stem_height: "tall" },
      ],
    );
    const snapshots = await Array.fromAsync(
      generateFlower({ source, prompt: "a sunny daisy", templates: TEMPLATES }),
    );
    expect(snapshots.map(s => [s.stage, s.done])).toEqual([
      [1, false],
      [2, false],
      [2, false],
      [2, true],
    ]);
    const last = snapshots.at(-1);
    if (last === undefined) throw new Error("no snapshots");
    expect(answerIds(last)).toEqual([
      "family",
      "template",
      "strangeness",
      "mood",
      "pose",
      "has_thorns",
      "stem_height",
    ]);
    expect(valueOf(last, "pose")).toBe("cupped");
    snapshots.map(snapshot =>
      expect(parsedSpec(snapshot).taxonomy.family).toBe("Asteraceae"),
    );
    expect(parsedSpec(last).structure.stem.height).toBeGreaterThan(
      parsedSpec(snapshots[0]).structure.stem.height,
    );
  });

  test("a source that answers nothing still renders the family archetype", async () => {
    const snapshots = await Array.fromAsync(
      generateFlower({
        source: stagedSource([], []),
        prompt: "",
        templates: TEMPLATES,
      }),
    );
    expect(snapshots.map(s => s.done)).toEqual([false, true]);
    expect(parsedSpec(snapshots[1]).taxonomy.family).toBe("Invented");
  });
});
