import { describe, expect, test } from "bun:test";
import * as enums from "./flower-enums.ts";
import {
  FLOWER_FAMILIES,
  INFLORESCENCE_KINDS,
  SYMMETRIES,
  isVariant,
} from "./flower-enums.ts";
import { TEMPLATES } from "./templates.ts";

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string");

const exported: Record<string, unknown> = enums;
const ENUM_ARRAYS = Object.entries(exported).filter(
  (entry): entry is [string, readonly string[]] => isStringArray(entry[1]),
);

describe("flower-enums", () => {
  test("exports one array per Rust enum", () => {
    expect(ENUM_ARRAYS.length).toBe(38);
  });

  test.each(ENUM_ARRAYS)("%s has no duplicate variants", (_, list) => {
    expect(new Set(list).size).toBe(list.length);
  });

  test("FLOWER_FAMILIES starts with the Invented default", () => {
    expect(FLOWER_FAMILIES[0]).toBe("Invented");
  });

  test("FLOWER_FAMILIES holds every family the spec lists", () => {
    expect(FLOWER_FAMILIES.length).toBe(38);
    expect(FLOWER_FAMILIES.at(-1)).toBe("Alstroemeriaceae");
  });

  test("SYMMETRIES is the flattened unit enum", () => {
    expect(SYMMETRIES).toEqual(["Radial", "Bilateral", "Asymmetric", "Spiral"]);
  });

  test("isVariant narrows only to listed strings", () => {
    expect(isVariant(SYMMETRIES, "Spiral")).toBe(true);
    expect(isVariant(SYMMETRIES, "Unknown")).toBe(false);
    expect(isVariant(SYMMETRIES, 3)).toBe(false);
  });
});

describe("templates", () => {
  test("lists 45 templates", () => {
    expect(TEMPLATES.length).toBe(45);
  });

  test.each(TEMPLATES.map(t => [t.name, t.family] as const))(
    "%s has a family from FLOWER_FAMILIES",
    (_, family) => {
      expect(isVariant(FLOWER_FAMILIES, family)).toBe(true);
    },
  );

  test.each(TEMPLATES.map(t => [t.name, t.genus, t.epithet] as const))(
    "%s has a capitalised one word genus and a lowercase or empty epithet",
    (_, genus, epithet) => {
      expect(genus).toMatch(/^[A-Z][a-z]+$/);
      expect(epithet).toMatch(/^[a-z]*$/);
    },
  );

  test.each(TEMPLATES.map(t => [t.name, t.scientific, t.genus] as const))(
    "%s shows its genus in the scientific display name",
    (_, scientific, genus) => {
      expect(scientific.split(" ")).toContain(genus);
    },
  );

  test.each(
    TEMPLATES.filter(t => t.inflorescence !== undefined).map(
      t => [t.name, t.inflorescence] as const,
    ),
  )("%s has an inflorescence from INFLORESCENCE_KINDS", (_, kind) => {
    expect(isVariant(INFLORESCENCE_KINDS, kind)).toBe(true);
  });

  test("names the templates the spec marks as multi-headed", () => {
    const withHint = TEMPLATES.filter(t => t.inflorescence !== undefined).map(
      t => t.name,
    );
    expect(withHint).toEqual([
      "Alstroemeria",
      "Hydrangea",
      "Snapdragon",
      "Stock",
      "Lisianthus",
      "Delphinium",
      "Freesia",
      "Sweet Pea",
      "Gladiolus",
      "Larkspur",
      "Liatris",
      "Bells of Ireland",
      "Solidago",
      "Hypericum",
      "Statice",
      "Waxflower",
      "Queen Anne's Lace",
      "Heather",
      "Bupleurum",
      "Yarrow",
      "Limonium",
      "Spray Rose",
      "Mini Carnation",
      "Button Pom",
      "Cushion Pom",
      "Kermit Pom",
      "Spray Mum",
      "Matsumoto Aster",
      "Solidaster",
    ]);
  });
});
