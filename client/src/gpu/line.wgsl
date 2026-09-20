import { bayer8, ditherBit, paperOrInk, revealMask } from "./dither.wgsl";

// Composites the assembly line sprites by brightness, then dithers the result to one bit.
// Every plate is shot on pure black, so the brightest sample at a cell is the sprite in front.
// Arms arrive as four link sprites each, cut from one plate by half-planes at the joints.
// The pointer trail reveals the plate's real colour under the dither.

struct Params {
  pixel: f32,
  reveal: f32,
  contrast: f32,
  /** Distance the belt has travelled, in frame uv, so its surface scrolls with the items. */
  travel: f32,
  resolution: vec2f,
}

// place = (centre.xy, pivot.xy); shape = (angle, scale, aspect, visible); tone = (exposure, tex, 0, 0);
// cutA / cutB = (point.xy, normal.xy) half-planes in plate uv, a zero normal cuts nothing.
struct Sprite {
  place: vec4f,
  shape: vec4f,
  tone: vec4f,
  cutA: vec4f,
  cutB: vec4f,
}

const SPRITE_COUNT = 15u;

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<uniform> sprites: array<Sprite, 15>;
@group(0) @binding(2) var tex0: texture_2d<f32>;
@group(0) @binding(3) var tex1: texture_2d<f32>;
@group(0) @binding(4) var tex2: texture_2d<f32>;
@group(0) @binding(5) var tex3: texture_2d<f32>;
@group(0) @binding(6) var tex4: texture_2d<f32>;
@group(0) @binding(7) var tex5: texture_2d<f32>;
@group(0) @binding(8) var samp: sampler;
@group(0) @binding(9) var trail: texture_2d<f32>;

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

fn sampleTex(index: u32, uv: vec2f) -> vec3f {
  switch index {
    case 0u: { return textureSampleLevel(tex0, samp, uv, 0.0).rgb; }
    case 1u: { return textureSampleLevel(tex1, samp, uv, 0.0).rgb; }
    case 2u: { return textureSampleLevel(tex2, samp, uv, 0.0).rgb; }
    case 3u: { return textureSampleLevel(tex3, samp, uv, 0.0).rgb; }
    case 4u: { return textureSampleLevel(tex4, samp, uv, 0.0).rgb; }
    default: { return textureSampleLevel(tex5, samp, uv, 0.0).rgb; }
  }
}

// Rotate a y-down vector clockwise on screen by `angle`: the inverse of the rig's
// counter-clockwise link rotation, so this maps frame space back into the plate.
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

fn keep(cut: vec4f, uv: vec2f) -> f32 {
  return step(0.0, dot(uv - cut.xy, cut.zw));
}

fn sampleSprite(s: Sprite, q: vec2f, frameAspect: f32) -> Sample {
  let uv = spriteUv(s, q, frameAspect);
  let inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0)
    * keep(s.cutA, uv) * keep(s.cutB, uv);
  let tex = u32(s.tone.y + 0.5);
  let gain = select(1.0, beltSurface(uv), tex == 0u);
  let rgb = sampleTex(tex, uv) * inside * s.shape.w;
  return Sample(luminanceOf(rgb) * s.tone.x * gain, rgb);
}

fn hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(12.9898, 78.233))) * 43758.5453);
}

// A little per-cell jitter on the Bayer threshold breaks the flat plateaus an ordered dither
// makes out of smooth gradients, such as the belt's rubber.
fn jitter(cell: vec2f) -> f32 {
  return (hash(cell) - 0.5) * 0.1;
}

// Scuffs and one seam on the rubber, scrolling with the belt's travel so the belt visibly runs
// while items ride and stands still while an arm works. Random scuffs cannot band.
fn beltSurface(uv: vec2f) -> f32 {
  let onSurface = step(0.52, uv.y) * step(uv.y, 0.6);
  let scrolled = vec2f(uv.x + params.travel, uv.y);
  let scuff = step(0.9, hash(floor(scrolled * vec2f(140.0, 36.0))));
  let seam = 1.0 - smoothstep(0.0, 0.006, abs(fract(scrolled.x) - 0.5));
  return 1.0 + onSurface * (scuff * 1.2 + seam * 2.0);
}

fn brighter(a: Sample, b: Sample) -> Sample {
  if (b.lum > a.lum) { return b; }
  return a;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let cell = floor(uv * params.resolution / params.pixel);
  let snapped = (cell + 0.5) * params.pixel / params.resolution;
  let threshold = clamp(bayer8(vec2u(cell)) + jitter(cell), 0.0, 1.0);

  let frameAspect = params.resolution.x / params.resolution.y;
  let q = vec2f(snapped.x * frameAspect, snapped.y);

  var best = Sample(0.0, vec3f(0.0));
  for (var i = 0u; i < SPRITE_COUNT; i++) {
    best = brighter(best, sampleSprite(sprites[i], q, frameAspect));
  }

  let luminance = clamp((best.lum - 0.5) * params.contrast + 0.5, 0.0, 1.0);

  // The line starts up left to right: cells right of the reveal edge stay ink.
  let revealed = step(snapped.x, params.reveal);
  let bit = ditherBit(luminance * revealed, threshold);

  let show = revealMask(textureSampleLevel(trail, samp, snapped, 0.0).r, threshold) * revealed;
  return vec4f(mix(paperOrInk(bit), saturate(best.rgb, 1.4), show), 1.0);
}
