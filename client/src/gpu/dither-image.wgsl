import { bayer8, ditherBit, paperOrInk, revealMask } from "./dither.wgsl";

struct Params {
  pixel: f32,
  reveal: f32,
  contrast: f32,
  exposure: f32,
  resolution: vec2f,
}
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var trail: texture_2d<f32>;

fn luminanceOf(rgb: vec3f) -> f32 {
  return dot(rgb, vec3f(0.2126, 0.7152, 0.0722));
}

fn saturate(rgb: vec3f, amount: f32) -> vec3f {
  let grey = vec3f(luminanceOf(rgb));
  return clamp(mix(grey, rgb, amount), vec3f(0.0), vec3f(1.0));
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let cell = floor(uv * params.resolution / params.pixel);
  let snapped = (cell + 0.5) * params.pixel / params.resolution;
  let threshold = bayer8(vec2u(cell));

  // Contain-fit the square source so the whole subject stays in frame. The letterbox is ink.
  let aspect = params.resolution.x / params.resolution.y;
  let fit = select(vec2f(1.0, 1.0 / aspect), vec2f(aspect, 1.0), aspect > 1.0);
  let fitted = (snapped - 0.5) * fit + 0.5;
  let inside = step(0.0, fitted.x) * step(fitted.x, 1.0) * step(0.0, fitted.y) * step(fitted.y, 1.0);
  let color = textureSampleLevel(src, samp, fitted, 0.0).rgb * inside;
  let luminance = clamp((luminanceOf(color) * params.exposure - 0.5) * params.contrast + 0.5, 0.0, 1.0);

  // Rows below the reveal line stay ink until the image has streamed in.
  let revealed = step(snapped.y, params.reveal);
  let bit = ditherBit(luminance * revealed, threshold);

  // Under the trail the cell shows its real, saturated pixel instead of a bit.
  let show = revealMask(textureSampleLevel(trail, samp, snapped, 0.0).r, threshold) * revealed;
  return vec4f(mix(paperOrInk(bit), saturate(color, 1.4), show), 1.0);
}
