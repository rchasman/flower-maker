// Dithers every template plate to public/art/templates/<slug>.dither.png with the same
// dither-image.wgsl shader normalflowers runs live, at tile resolution, no pointer trail.
// Headless through vgpu/node (Dawn). Run: bun client/scripts/render-template-dithers.ts

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import { resolveShader } from "@vgpu/wgsl/runtime";
import { effect, init, sampler, target, texture } from "vgpu/node";
import { TEMPLATES, templateSlug } from "../src/data/templates.ts";

const ART_DIR = join(import.meta.dirname, "../public/art/templates");
const SHADER = join(import.meta.dirname, "../src/gpu/dither-image.wgsl");
const SIZE = 384;
const PIXEL = 2;
const CONTRAST = 1.15;
const EXPOSURE = 3.2;

const { wgsl } = await resolveShader({ entry: SHADER });
const gpu = await init();
const output = target(gpu, { size: [SIZE, SIZE], format: "rgba8unorm" });
const noTrail = texture(gpu, {
  kind: "2d",
  size: [1, 1],
  format: "rgba8unorm",
  usage: ["texture_binding", "copy_dst"],
});
const linear = sampler(gpu, { magFilter: "linear", minFilter: "linear" });

const ditherPlate = async (slug: string): Promise<boolean> => {
  const sourcePath = join(ART_DIR, `${slug}.png`);
  if (!existsSync(sourcePath)) {
    console.warn(`${slug}: no plate yet, skipped`);
    return false;
  }
  const source = PNG.sync.read(readFileSync(sourcePath));
  const image = texture(gpu, {
    kind: "2d",
    size: [source.width, source.height],
    format: "rgba8unorm",
    usage: ["texture_binding", "copy_dst"],
  });
  gpu.gpu.queue.writeTexture(
    { texture: image.gpu },
    source.data,
    { bytesPerRow: source.width * 4 },
    [source.width, source.height],
  );
  const dither = effect(gpu, wgsl, {
    set: {
      params: {
        pixel: PIXEL,
        reveal: 1,
        contrast: CONTRAST,
        exposure: EXPOSURE,
        resolution: [SIZE, SIZE],
      },
      src: image,
      samp: linear,
      trail: noTrail,
    },
  });
  dither.draw(output);
  const pixels = await output.color.read({ mipLevel: 0, region: "all" });
  const png = new PNG({ width: SIZE, height: SIZE });
  png.data.set(pixels);
  writeFileSync(join(ART_DIR, `${slug}.dither.png`), PNG.sync.write(png));
  image.destroy();
  return true;
};

const done = await TEMPLATES.reduce<Promise<number>>(
  async (count, template) =>
    (await count) + ((await ditherPlate(templateSlug(template))) ? 1 : 0),
  Promise.resolve(0),
);

console.log(`${done} of ${TEMPLATES.length} templates dithered`);
gpu.dispose();
