import { describe, expect, test } from "bun:test";
import { arrangementFlowers, inheritedMeta } from "./arrangements.ts";

const row = (partPath: string, overrideJson: string, forkedFrom = "") => ({
  partPath,
  overrideJson,
  forkedFrom,
});

const dressed = (material: string) =>
  row(
    "arrangement",
    JSON.stringify({
      name: material,
      adornment_spec: {
        container: { type: "tie", material, color: { r: 1, g: 0, b: 0 } },
        accent: { type: "bow", color: { r: 0, g: 0, b: 1 } },
        mood: "calm",
      },
    }),
  );

describe("arrangementFlowers", () => {
  test("flowers come in slot order, whatever order the rows arrive in, and gaps close", () => {
    const flowers = arrangementFlowers([
      row("constituent:7", "c"),
      row("arrangement", "{}"),
      row("constituent:0", "a"),
      row("constituent:2", "b"),
    ]);
    expect(flowers.map(f => f.spec)).toEqual(["a", "b", "c"]);
  });

  test("a flower keeps its seed when it moves to another slot", () => {
    const before = arrangementFlowers([
      row("constituent:0", "rose"),
      row("constituent:1", "iris"),
    ]);
    const after = arrangementFlowers([
      row("constituent:0", "tulip"),
      row("constituent:1", "rose"),
      row("constituent:2", "iris"),
    ]);
    expect(after[1]!.sid).toBe(before[0]!.sid);
    expect(after[2]!.sid).toBe(before[1]!.sid);
    expect(new Set(after.map(f => f.sid)).size).toBe(3);
  });

  test("a single flower has no arrangement flowers and no meta", () => {
    expect(arrangementFlowers([row("petals.layers.0", "x")])).toEqual([]);
    expect(
      inheritedMeta("1", new Map([["1", [row("petals.layers.0", "x")]]])),
    ).toBeNull();
  });
});

describe("inheritedMeta", () => {
  const bySession = new Map([
    // a dressed arrangement of three, a plain flower, and their merge
    [
      "1",
      [
        row("constituent:0", "a"),
        row("constituent:1", "b"),
        row("constituent:2", "c"),
        dressed("silk"),
      ],
    ],
    ["2", [row("petals", "x")]],
    [
      "3",
      [
        row("constituent:0", "a", "merge:2+1"),
        row("constituent:1", "b", "merge:2+1"),
      ],
    ],
  ]);

  test("a merged arrangement wears its larger parent's look until the AI dresses it", () => {
    expect(inheritedMeta("3", bySession)?.name).toBe("silk");
  });

  test("its own look wins once it has one", () => {
    const own = new Map(bySession).set("3", [
      ...bySession.get("3")!,
      dressed("glass"),
    ]);
    expect(inheritedMeta("3", own)?.name).toBe("glass");
  });

  test("an arrangement with no dressed ancestor has no look", () => {
    expect(inheritedMeta("2", bySession)).toBeNull();
  });
});
