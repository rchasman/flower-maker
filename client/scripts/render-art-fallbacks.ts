// Renders public/art/assembly-line.dither.png for browsers without WebGPU, using the same
// line.wgsl shader the landing runs live, frozen one second into the loop with no pointer trail.
// Headless through vgpu/node (Dawn). Run: bun client/scripts/render-art-fallbacks.ts
// Pose checks: bun client/scripts/render-art-fallbacks.ts --time 2.3 --out /tmp/frame.png

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { PNG } from "pngjs";
import { resolveShader } from "@vgpu/wgsl/runtime";
import { effect, init, sampler, target, texture } from "vgpu/node";
import { PLATES } from "../src/landing/plates.ts";
import { beltTravel, timeline } from "../src/landing/timeline.ts";
import { spriteUniforms } from "../src/gpu/startAssemblyLine.ts";

const ART_DIR = join(import.meta.dirname, "../public/art");
const SHADER = join(import.meta.dirname, "../src/gpu/line.wgsl");
const SIZE: readonly [number, number] = [1920, 1080];
const PIXEL = 2;
const CONTRAST = 1.15;

const { values } = parseArgs({
  options: {
    time: { type: "string", default: "1.0" },
    out: { type: "string", default: join(ART_DIR, "assembly-line.dither.png") },
  },
});
const FROZEN_AT_SECONDS = Number(values.time);
const OUTPUT = values.out;

const { wgsl } = await resolveShader({ entry: SHADER });
const gpu = await init();
const output = target(gpu, { size: [...SIZE], format: "rgba8unorm" });
const noTrail = texture(gpu, {
  kind: "2d",
  size: [1, 1],
  format: "rgba8unorm",
  usage: ["texture_binding", "copy_dst"],
});

const images = PLATES.map(plate => {
  const source = PNG.sync.read(readFileSync(join(ART_DIR, `${plate.id}.png`)));
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
  return { texture: image, aspect: source.width / source.height };
});

const line = effect(gpu, wgsl, {
  set: {
    params: {
      pixel: PIXEL,
      reveal: 1,
      contrast: CONTRAST,
      travel: beltTravel(FROZEN_AT_SECONDS),
      resolution: SIZE,
    },
    sprites: spriteUniforms(
      PLATES,
      images.map(image => image.aspect),
      timeline(FROZEN_AT_SECONDS, SIZE[0] / SIZE[1]),
    ),
    ...Object.fromEntries(images.map((image, i) => [`tex${i}`, image.texture])),
    samp: sampler(gpu, { magFilter: "linear", minFilter: "linear" }),
    trail: noTrail,
  },
});
line.draw(output);

const pixels = await output.color.read({ mipLevel: 0, region: "all" });
const png = new PNG({ width: SIZE[0], height: SIZE[1] });
png.data.set(pixels);
writeFileSync(OUTPUT, PNG.sync.write(png));
console.log(`assembly line -> ${OUTPUT}`);

images.map(image => image.texture.destroy());
gpu.dispose();
