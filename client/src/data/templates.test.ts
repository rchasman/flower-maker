import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  TEMPLATES,
  templateArtUrl,
  templatePrompt,
  templateSlug,
} from "./templates.ts";

const ART_DIR = join(import.meta.dir, "../../public/art/templates");

describe("templates", () => {
  test("slugs are file-safe and unique", () => {
    const slugs = TEMPLATES.map(templateSlug);
    slugs.map(slug => expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test("prompts carry the taxonomy and ask for one stem", () => {
    TEMPLATES.map(t => {
      const prompt = templatePrompt(t);
      expect(prompt).toContain(t.scientific);
      expect(prompt).toContain(t.family);
      expect(prompt).toContain("exactly one stem");
      if (t.inflorescence) {
        expect(prompt.toLowerCase()).toContain(t.inflorescence.toLowerCase());
      }
    });
  });

  test("every template has a dithered plate to show on its tile", () => {
    TEMPLATES.map(t => {
      expect(existsSync(join(ART_DIR, `${templateSlug(t)}.dither.png`))).toBe(
        true,
      );
    });
    expect(templateArtUrl(TEMPLATES[0]!)).toMatch(
      /^\/art\/templates\/[a-z0-9-]+\.dither\.png$/,
    );
  });
});
