import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { FlowerSpecSchema, type FlowerSpecJson } from "./specSchema.ts";

const color = { r: 0.5, g: 0.5, b: 0.5, a: 1 };

const minimalSpec: FlowerSpecJson = {
  name: "Minimal",
  species: "Minima minima",
  taxonomy: {
    family: "Invented",
    genus: "Minima",
    species_name: "minima",
    common_name: "Minimal",
    botanical_class: "Dicot",
  },
  petals: {
    layers: [],
    bloom_progress: 1,
    wilt_progress: 0,
    symmetry: "Radial",
    symmetry_order: 0,
    divergence_angle: 137.5,
    stage: "Bloom",
  },
  reproductive: { stamens: [] },
  structure: {
    stem: {
      height: 0.5,
      thickness: 0.3,
      curvature: 0,
      color,
      internode_length: 0.5,
      surface: "Smooth",
      branching: "None",
      style: "Straight",
    },
    sepals: [],
    receptacle: { shape: "Flat", size: 0.5, color },
    buds: [],
  },
  foliage: { leaves: [], bracts: [], leaf_density: 0 },
  ornamentation: { dewdrops: [], particles: [] },
  inflorescence: {
    kind: "Solitary",
    head_count: 1,
    head_scale: 0.5,
    spread: 0.5,
  },
};

const FIXTURES_DIR = join(
  import.meta.dir,
  "../../crates/flower-core/tests/fixtures",
);

describe("FlowerSpecSchema", () => {
  test("a valid minimal spec passes and comes back unchanged", () => {
    expect(FlowerSpecSchema.parse(minimalSpec)).toEqual(minimalSpec);
  });

  test("an unknown field fails", () => {
    expect(() =>
      FlowerSpecSchema.parse({ ...minimalSpec, personality: {} }),
    ).toThrow();
    expect(() =>
      FlowerSpecSchema.parse({
        ...minimalSpec,
        petals: { ...minimalSpec.petals, symetry: "Radial" },
      }),
    ).toThrow();
  });

  test("a misspelled variant fails", () => {
    expect(() =>
      FlowerSpecSchema.parse({
        ...minimalSpec,
        petals: { ...minimalSpec.petals, stage: "Blooming" },
      }),
    ).toThrow();
    expect(() =>
      FlowerSpecSchema.parse({
        ...minimalSpec,
        taxonomy: { ...minimalSpec.taxonomy, family: "Rosacea" },
      }),
    ).toThrow();
  });

  test("a color channel outside the unit range fails", () => {
    expect(() =>
      FlowerSpecSchema.parse({
        ...minimalSpec,
        structure: {
          ...minimalSpec.structure,
          receptacle: { shape: "Flat", size: 0.5, color: { ...color, r: 255 } },
        },
      }),
    ).toThrow();
  });

  test("every generated Rust fixture parses with the mirror", () => {
    const generated = readdirSync(FIXTURES_DIR).filter(
      name => name.endsWith(".yaml") && name !== "contract-smoke.yaml",
    );
    expect(generated.length).toBeGreaterThan(0);
    generated.map(name => {
      const parsed: unknown = parseYaml(
        readFileSync(join(FIXTURES_DIR, name), "utf8"),
      );
      expect(() => FlowerSpecSchema.parse(parsed), name).not.toThrow();
    });
  });
});
