import { describe, expect, test } from "bun:test";
import { createRng, seedFromPrompt } from "./seed.ts";

describe("seedFromPrompt", () => {
  test("matches the published FNV-1a 32 bit vectors", () => {
    expect(seedFromPrompt("")).toBe(0x811c9dc5);
    expect(seedFromPrompt("a")).toBe(0xe40c292c);
    expect(seedFromPrompt("foobar")).toBe(0xbf9cf968);
  });

  test("is deterministic and prompt sensitive", () => {
    expect(seedFromPrompt("a red rose")).toBe(seedFromPrompt("a red rose"));
    expect(seedFromPrompt("a red rose")).not.toBe(seedFromPrompt("a red rosé"));
  });
});

describe("createRng", () => {
  // Reference values from the LCG in crates/flower-core/src/genetics.rs
  // (multiplier 6364136223846793005, increment 1442695040888963407,
  // output (state >> 33) / 2^31), computed by a throwaway rustc program.
  test("produces the same sequence as genetics.rs for seed 12345", () => {
    const next = createRng(12345);
    expect(next()).toBe(0.10957860574126244);
    expect(next()).toBe(0.2653852957300842);
    expect(next()).toBe(0.885623992420733);
  });

  test("produces the same sequence as genetics.rs for seed 1", () => {
    const next = createRng(1);
    expect(next()).toBe(0.4232091708108783);
    expect(next()).toBe(0.5094074425287545);
    expect(next()).toBe(0.6483593937009573);
  });

  test("handles the full unsigned 32 bit seed range", () => {
    const next = createRng(4294967295);
    expect(next()).toBe(0.03236427856609225);
    expect(next()).toBe(0.7000887002795935);
  });

  test("stays inside [0, 1) and is deterministic per seed", () => {
    const a = createRng(99);
    const b = createRng(99);
    const draws = Array.from({ length: 200 }, () => a());
    draws.map(value => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });
    expect(Array.from({ length: 200 }, () => b())).toEqual(draws);
  });
});
