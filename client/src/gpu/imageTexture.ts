import { texture, type Gpu, type Texture } from "vgpu";

export interface ImageTexture {
  readonly texture: Texture;
  readonly aspect: number;
}

export const loadImageTexture = async (
  gpu: Gpu,
  url: string,
): Promise<ImageTexture> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image fetch failed: ${url} (${response.status})`);
  }
  const bitmap = await createImageBitmap(await response.blob(), {
    colorSpaceConversion: "none",
  });
  const size: [number, number] = [bitmap.width, bitmap.height];
  const image = texture(gpu, {
    kind: "2d",
    size,
    format: "rgba8unorm",
    usage: ["texture_binding", "copy_dst", "render_attachment"],
    label: url,
  });
  gpu.gpu.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture: image.gpu },
    size,
  );
  const aspect = bitmap.width / bitmap.height;
  bitmap.close();
  return { texture: image, aspect };
};
