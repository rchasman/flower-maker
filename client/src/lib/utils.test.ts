import { describe, expect, test } from "bun:test";
import { parseSpec } from "./utils.ts";

const RUST_SERIALISED_SPEC = `
name: Rose
petals:
  layers: []
  symmetry: !Radial
    order: 5
`;

const SPIRAL_SPEC = `
petals:
  symmetry: !Spiral
    divergence_angle: 137.5
`;

describe("parseSpec", () => {
  test("resolves serde_yaml enum tags to externally tagged objects", () => {
    const spec = parseSpec(RUST_SERIALISED_SPEC);
    expect(spec?.petals).toEqual({
      layers: [],
      symmetry: { Radial: { order: 5 } },
    });
  });

  test("resolves the Spiral variant the same way", () => {
    const spec = parseSpec(SPIRAL_SPEC);
    expect(spec?.petals).toEqual({
      symmetry: { Spiral: { divergence_angle: 137.5 } },
    });
  });

  test("returns null for empty input", () => {
    expect(parseSpec("{}")).toBeNull();
    expect(parseSpec(undefined)).toBeNull();
  });
});
