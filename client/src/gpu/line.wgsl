import { bayer8, ditherBit, paperOrInk, revealMask } from "./dither.wgsl";

// Composites the assembly line sprites by brightness, then dithers the result to one bit.
// Every plate is shot on pure black, so the brightest sample at a cell is the sprite in front.
// The pointer trail reveals the plate's real colour under the dither.

struct Params {
  pixel: f32,
  reveal: f32,
  contrast: f32,
  time: f32,
  resolution: vec2f,
}

// Packed as vec4s so the uniform array stride is a clean 48 bytes with no padding fields.
// place = (centre.xy, pivot.xy); shape = (angle, scale, aspect, visible); tone = (exposure, 0, 0, 0).
struct Sprite {
  place: vec4f,
  shape: vec4f,
  tone: vec4f,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<uniform> sprites: array<Sprite, 7>;
@group(0) @binding(2) var tex0: texture_2d<f32>;
@group(0) @binding(3) var tex1: texture_2d<f32>;
@group(0) @binding(4) var tex2: texture_2d<f32>;
@group(0) @binding(5) var tex3: texture_2d<f32>;
@group(0) @binding(6) var tex4: texture_2d<f32>;
@group(0) @binding(7) var tex5: texture_2d<f32>;
@group(0) @binding(8) var tex6: texture_2d<f32>;
@group(0) @binding(9) var samp: sampler;
@group(0) @binding(10) var trail: texture_2d<f32>;

struct Sample {
  lum: f32,
  rgb: vec3f,
}

fn luminanceOf(rgb: vec3f) -> f32 {
  return dot(rgb, vec3f(0.2126, 0.7152, 0.0722));
}

fn saturate(rgb: vec3f, amount: f32) -> vec3f {
  let grey = vec3f(luminanceOf(rgb));
  return clamp(mix(grey, rgb, amount), vec3f(0.0), vec3f(1.0));
}

// Rotate a y-down vector clockwise on screen by `angle`: the inverse of the timeline's
// counter-clockwise sprite rotation, so this maps frame space back into the sprite.
fn unrotate(v: vec2f, angle: f32) -> vec2f {
  let c = cos(angle);
  let s = sin(angle);
  return vec2f(v.x * c - v.y * s, v.x * s + v.y * c);
}

// `q` is the cell position in square units: x scaled by the frame aspect, y in 0..1.
fn spriteUv(s: Sprite, q: vec2f, frameAspect: f32) -> vec2f {
  let centre = vec2f(s.place.x * frameAspect, s.place.y);
  let size = vec2f(s.shape.y * s.shape.z, s.shape.y);
  return unrotate(q - centre, s.shape.x) / size + s.place.zw;
}

fn sampleSprite(tex: texture_2d<f32>, s: Sprite, q: vec2f, frameAspect: f32, gain: f32) -> Sample {
  let uv = spriteUv(s, q, frameAspect);
  let inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  let rgb = textureSampleLevel(tex, samp, uv, 0.0).rgb * inside * s.shape.w;
  return Sample(luminanceOf(rgb) * s.tone.x * gain, rgb);
}

fn brighter(a: Sample, b: Sample) -> Sample {
  if (b.lum > a.lum) { return b; }
  return a;
}

// The belt surface carries a moving stripe so the line reads as running.
fn beltStripes(s: Sprite, q: vec2f, frameAspect: f32) -> f32 {
  let uv = spriteUv(s, q, frameAspect);
  let onSurface = step(0.52, uv.y) * step(uv.y, 0.6);
  let stripe = step(0.5, fract(uv.x * 28.0 - params.time * 0.35));
  return 1.0 - onSurface * 0.35 * stripe;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let cell = floor(uv * params.resolution / params.pixel);
  let snapped = (cell + 0.5) * params.pixel / params.resolution;
  let threshold = bayer8(vec2u(cell));

  let frameAspect = params.resolution.x / params.resolution.y;
  let q = vec2f(snapped.x * frameAspect, snapped.y);

  var best = Sample(0.0, vec3f(0.0));
  best = brighter(best, sampleSprite(tex0, sprites[0], q, frameAspect, beltStripes(sprites[0], q, frameAspect)));
  best = brighter(best, sampleSprite(tex1, sprites[1], q, frameAspect, 1.0));
  best = brighter(best, sampleSprite(tex2, sprites[2], q, frameAspect, 1.0));
  best = brighter(best, sampleSprite(tex3, sprites[3], q, frameAspect, 1.0));
  best = brighter(best, sampleSprite(tex4, sprites[4], q, frameAspect, 1.0));
  best = brighter(best, sampleSprite(tex5, sprites[5], q, frameAspect, 1.0));
  best = brighter(best, sampleSprite(tex6, sprites[6], q, frameAspect, 1.0));

  let luminance = clamp((best.lum - 0.5) * params.contrast + 0.5, 0.0, 1.0);

  // The line starts up left to right: cells right of the reveal edge stay ink.
  let revealed = step(snapped.x, params.reveal);
  let bit = ditherBit(luminance * revealed, threshold);

  let show = revealMask(textureSampleLevel(trail, samp, snapped, 0.0).r, threshold) * revealed;
  return vec4f(mix(paperOrInk(bit), saturate(best.rgb, 1.4), show), 1.0);
}
