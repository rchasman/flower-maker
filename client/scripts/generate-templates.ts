// Generates one single-stem plate per template with OpenAI images, prompted from its taxonomy.
//   bun client/scripts/generate-templates.ts [slug ...]   -> client/public/art/templates/<slug>.png
// Existing files are kept unless a slug is passed explicitly. Needs OPENAI_API_KEY.
// Run render-template-dithers.ts afterwards to produce the <slug>.dither.png the tiles show.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  TEMPLATES,
  templatePrompt,
  templateSlug,
  type TemplateInfo,
} from "../src/data/templates.ts";

const API = "https://api.openai.com/v1/images/generations";
const CONCURRENCY = 4;
const OUT_DIR = join(import.meta.dirname, "../public/art/templates");

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

const targetFor = (template: TemplateInfo) =>
  join(OUT_DIR, `${templateSlug(template)}.png`);

interface ImagesResponse {
  data: { b64_json: string }[];
}

const generate = async (prompt: string): Promise<Uint8Array> => {
  const response = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "medium",
      output_format: "png",
    }),
  });
  if (!response.ok) {
    throw new Error(
      `OpenAI images failed: ${response.status} ${await response.text()}`,
    );
  }
  const body: ImagesResponse = await response.json();
  const first = body.data[0];
  if (!first) throw new Error("OpenAI images returned no data");
  return new Uint8Array(Buffer.from(first.b64_json, "base64"));
};

const requested = new Set(process.argv.slice(2));
const templates =
  requested.size > 0
    ? TEMPLATES.filter(t => requested.has(templateSlug(t)))
    : TEMPLATES.filter(t => !existsSync(targetFor(t)));

mkdirSync(OUT_DIR, { recursive: true });

const renderTemplate = async (template: TemplateInfo) => {
  const startedAt = Date.now();
  const bytes = await generate(templatePrompt(template));
  writeFileSync(targetFor(template), bytes);
  console.log(
    `${templateSlug(template)}: ${bytes.byteLength} bytes in ${Date.now() - startedAt}ms`,
  );
};

const batches = templates.reduce<TemplateInfo[][]>(
  (acc, template, index) =>
    index % CONCURRENCY === 0
      ? [...acc, [template]]
      : [...acc.slice(0, -1), [...(acc[acc.length - 1] ?? []), template]],
  [],
);
for (const batch of batches) await Promise.all(batch.map(renderTemplate));

if (templates.length === 0) {
  console.log("Nothing to generate. Pass a slug to regenerate a template.");
}
