import { describe, expect, test } from "bun:test";
import { arrangementFlowers, arrangementMeta } from "./arrangements.ts";

const row = (partPath: string, overrideJson: string) => ({
  partPath,
  overrideJson,
});

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
    expect(arrangementMeta([row("petals.layers.0", "x")])).toBeNull();
  });
});
