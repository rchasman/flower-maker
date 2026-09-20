import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PLATES, artUrl } from "./plates.ts";
import { SPRITE_IDS } from "./timeline.ts";

const ART_DIR = join(import.meta.dir, "../../public/art");

describe("plates", () => {
  test("declares one plate per sprite in SPRITE_IDS order", () => {
    expect(PLATES.map(p => p.id)).toEqual([...SPRITE_IDS]);
  });

  test("every pivot is inside the image", () => {
    PLATES.map(p => {
      expect(p.pivot[0]).toBeGreaterThanOrEqual(0);
      expect(p.pivot[0]).toBeLessThanOrEqual(1);
      expect(p.pivot[1]).toBeGreaterThanOrEqual(0);
      expect(p.pivot[1]).toBeLessThanOrEqual(1);
      expect(p.exposure).toBeGreaterThan(0);
    });
  });

  test("every plate has a generated PNG in public/art", () => {
    PLATES.map(p => {
      expect(existsSync(join(ART_DIR, `${p.id}.png`))).toBe(true);
    });
  });

  test("artUrl points at public/art", () => {
    expect(artUrl("belt")).toBe("/art/belt.png");
  });
});
