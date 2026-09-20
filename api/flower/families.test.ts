import { describe, expect, test } from "bun:test";
import {
  FLOWER_FAMILIES,
  isVariant,
} from "../../client/src/data/flower-enums.ts";
import {
  FAMILIES,
  FULL_LISTS,
  LEAF_COLOR_NAMES,
  PALETTE,
  PALETTE_NAMES,
  SURFACE_LISTS,
  STRANGENESS,
  darken,
  hexToRgba,
  legalList,
  type ListName,
} from "./families.ts";

const LIST_NAMES = Object.keys(FULL_LISTS).filter(
  (name): name is ListName => name in FULL_LISTS,
);

const profiles = FLOWER_FAMILIES.map(key => FAMILIES[key]);

describe("FAMILIES", () => {
  test("has one profile per flower family, keyed by its own name", () => {
    expect(Object.keys(FAMILIES).sort()).toEqual([...FLOWER_FAMILIES].sort());
    FLOWER_FAMILIES.map(key => expect(FAMILIES[key].key).toBe(key));
  });

  test("every list is a non-empty subset of its enum", () => {
    profiles.map(profile =>
      LIST_NAMES.map(listName => {
        const list = profile[listName];
        expect(list.length, `${profile.key}.${listName}`).toBeGreaterThan(0);
        const full = FULL_LISTS[listName];
        list.map(value =>
          expect(
            isVariant(full, value),
            `${profile.key}.${listName} has ${value}`,
          ).toBe(true),
        );
        expect(new Set(list).size, `${profile.key}.${listName}`).toBe(
          list.length,
        );
      }),
    );
  });

  test("structural lists always keep the unpatterned single head, and the unfused corolla outside bell families", () => {
    profiles.map(profile => {
      expect(profile.patterns, profile.key).toContain("None");
      expect(profile.inflorescences, profile.key).toContain("Solitary");
      if (profile.special === "Bell") {
        expect(profile.fusions, profile.key).not.toContain("Free");
      } else {
        expect(profile.fusions, profile.key).toContain("Free");
      }
    });
  });

  test("a composite family's only outer shape is Ligulate", () => {
    const composites = profiles.filter(
      profile => profile.special === "Composite",
    );
    expect(composites.map(profile => profile.key)).toEqual(["Asteraceae"]);
    composites.map(profile =>
      expect(profile.shapes, profile.key).toEqual(["Ligulate"]),
    );
  });

  test("petal counts agree with the radial symmetry order", () => {
    profiles
      .filter(
        profile => profile.symmetry === "Radial" && profile.symmetryOrder > 0,
      )
      .map(profile =>
        profile.petalCounts.map(count =>
          expect(count % profile.symmetryOrder, `${profile.key} ${count}`).toBe(
            0,
          ),
        ),
      );
  });

  test("defaults and ranges are usable", () => {
    profiles.map(profile => {
      expect(profile.petalCounts.length, profile.key).toBeGreaterThan(0);
      profile.petalCounts.map(count =>
        expect(Number.isInteger(count) && count > 0, profile.key).toBe(true),
      );
      LIST_NAMES.map(listName =>
        expect(
          profile[listName][0],
          `${profile.key}.${listName}`,
        ).toBeDefined(),
      );
      expect(isVariant(LEAF_COLOR_NAMES, profile.leafColor), profile.key).toBe(
        true,
      );
      expect(profile.layerRange[0], profile.key).toBeGreaterThanOrEqual(1);
      expect(profile.layerRange[1], profile.key).toBeGreaterThanOrEqual(
        profile.layerRange[0],
      );
      expect(profile.receptacleSize[1], profile.key).toBeGreaterThanOrEqual(
        profile.receptacleSize[0],
      );
      expect(profile.stamenRange[1], profile.key).toBeGreaterThanOrEqual(
        profile.stamenRange[0],
      );
      expect(profile.sepalCount, profile.key).toBeGreaterThanOrEqual(0);
      expect(profile.typicalGenus.length, profile.key).toBeGreaterThan(0);
      expect(profile.description.length, profile.key).toBeGreaterThan(0);
      expect(profile.examples.length, profile.key).toBeGreaterThan(0);
    });
  });

  test("small tubular families hide their centres: a small receptacle, stamens hidden first, a capitate stigma first", () => {
    for (const key of [
      "Lamiaceae",
      "Plantaginaceae",
      "Boraginaceae",
    ] as const) {
      const profile = FAMILIES[key];
      expect(profile.receptacleSize, key).toEqual([0.1, 0.2]);
      expect(profile.stamenProminence[0], key).toBe("hidden");
      expect(profile.stigmaShapes[0], key).toBe("Capitate");
    }
  });

  test("Invented has every enum open", () => {
    LIST_NAMES.map(listName =>
      expect(FAMILIES.Invented[listName], listName).toEqual(
        FULL_LISTS[listName],
      ),
    );
  });

  test("special structures match the family skeleton", () => {
    expect(FAMILIES.Asteraceae.disc).toBe(true);
    expect(FAMILIES.Asteraceae.special).toBe("Composite");
    expect(FAMILIES.Orchidaceae.special).toBe("Labellum");
    expect(FAMILIES.Orchidaceae.symmetry).toBe("Bilateral");
    expect(FAMILIES.Amaryllidaceae.special).toBe("Corona");
    expect(FAMILIES.Violaceae.special).toBe("Spur");
    expect(FAMILIES.Apiaceae.special).toBe("Umbel");
    expect(FAMILIES.Apiaceae.inflorescences[0]).toBe("Umbel");
    expect(FAMILIES.Ericaceae.special).toBe("Bell");
    expect(FAMILIES.Campanulaceae.special).toBe("Bell");
    expect(FAMILIES.Iridaceae.petalCounts).toEqual([3]);
    expect(FAMILIES.Brassicaceae.petalCounts).toEqual([4]);
    expect(FAMILIES.Rosaceae.thorns).toBe(true);
    expect(FAMILIES.Cactaceae.thorns).toBe(true);
    profiles
      .filter(profile => profile.disc)
      .map(profile => expect(profile.key).toBe("Asteraceae"));
  });
});

describe("legalList", () => {
  const rose = FAMILIES.Rosaceae;

  test("faithful keeps the family list", () => {
    LIST_NAMES.map(listName =>
      expect(legalList(rose, "faithful", listName)).toEqual(rose[listName]),
    );
  });

  test("stylized opens only the surface lists", () => {
    const surface = LIST_NAMES.filter(name => isVariant(SURFACE_LISTS, name));
    const structural = LIST_NAMES.filter(
      name => !isVariant(SURFACE_LISTS, name),
    );
    expect(surface.length).toBeGreaterThan(0);
    expect(structural.length).toBeGreaterThan(0);
    surface.map(listName =>
      expect(legalList(rose, "stylized", listName), listName).toEqual(
        FULL_LISTS[listName],
      ),
    );
    structural.map(listName =>
      expect(legalList(rose, "stylized", listName), listName).toEqual(
        rose[listName],
      ),
    );
    expect(legalList(rose, "stylized", "shapes")).not.toEqual(
      FULL_LISTS.shapes,
    );
  });

  test("invented opens every list", () => {
    LIST_NAMES.map(listName =>
      expect(legalList(rose, "invented", listName), listName).toEqual(
        FULL_LISTS[listName],
      ),
    );
  });

  test("strangeness levels are the three dial positions", () => {
    expect(STRANGENESS).toEqual(["faithful", "stylized", "invented"]);
  });
});

describe("colors", () => {
  test("every palette name has a hex value", () => {
    PALETTE_NAMES.map(name => expect(PALETTE[name]).toMatch(/^#[0-9a-f]{6}$/));
  });

  test("hexToRgba converts channels to unit floats", () => {
    expect(hexToRgba("#ff0000")).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(hexToRgba("#7f7f7f")).toEqual({
      r: 0.498,
      g: 0.498,
      b: 0.498,
      a: 1,
    });
  });

  test("darken scales the channels and keeps alpha", () => {
    expect(darken({ r: 1, g: 0.5, b: 0.25, a: 0.9 }, 0.5)).toEqual({
      r: 0.5,
      g: 0.25,
      b: 0.125,
      a: 0.9,
    });
  });
});
