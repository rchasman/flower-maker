// Generates the assembly line cut-out plates with OpenAI images.
//   bun client/scripts/generate-art.ts [id ...]   -> client/public/art/<id>.png
// Existing files are kept unless an id is passed explicitly. Needs OPENAI_API_KEY.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PLATES, type Plate } from "../src/landing/plates.ts";

const API = "https://api.openai.com/v1/images/generations";
const CONCURRENCY = 4;
const OUT_DIR = join(import.meta.dirname, "../public/art");

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

const targetFor = (id: string) => join(OUT_DIR, `${id}.png`);

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
      size: "1536x1024",
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
const plates =
  requested.size > 0
    ? PLATES.filter(plate => requested.has(plate.id))
    : PLATES.filter(plate => !existsSync(targetFor(plate.id)));

mkdirSync(OUT_DIR, { recursive: true });

const renderPlate = async (plate: Plate) => {
  const startedAt = Date.now();
  const bytes = await generate(plate.prompt);
  writeFileSync(targetFor(plate.id), bytes);
  console.log(
    `${plate.id}: ${bytes.byteLength} bytes in ${Date.now() - startedAt}ms -> ${targetFor(plate.id)}`,
  );
};

const batches = plates.reduce<Plate[][]>(
  (acc, plate, index) =>
    index % CONCURRENCY === 0
      ? [...acc, [plate]]
      : [...acc.slice(0, -1), [...(acc[acc.length - 1] ?? []), plate]],
  [],
);
for (const batch of batches) await Promise.all(batch.map(renderPlate));

if (plates.length === 0) {
  console.log("Nothing to generate. Pass an id to regenerate a plate.");
}
