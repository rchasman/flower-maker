// Pointer trail buffer: the standard fluid-trail technique. Every frame the previous buffer
// is blurred a little and faded, then a soft stroke is painted from the last pointer position
// to the current one. Fast moves paint long strokes; stillness lets the trail dissolve.
// Red channel holds the trail. Surfaces sample it as a reveal mask.

struct Params {
  head: vec2f,
  prevHead: vec2f,
  texel: vec2f,
  aspect: f32,
  radius: f32,
  strength: f32,
  decay: f32,
}
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var prev: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

fn tap(uv: vec2f, offset: vec2f) -> f32 {
  return textureSampleLevel(prev, samp, uv + offset * params.texel, 0.0).r;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  // Wide, heavy diffusion so the stroke spreads into a soft cloud as it fades.
  let centre = tap(uv, vec2f(0.0));
  let ring = tap(uv, vec2f(2.5, 0.0)) + tap(uv, vec2f(-2.5, 0.0)) + tap(uv, vec2f(0.0, 2.5)) + tap(uv, vec2f(0.0, -2.5));
  let diagonal = tap(uv, vec2f(1.8, 1.8)) + tap(uv, vec2f(-1.8, 1.8)) + tap(uv, vec2f(1.8, -1.8)) + tap(uv, vec2f(-1.8, -1.8));
  let diffused = centre * 0.36 + ring * 0.1 + diagonal * 0.06;
  let faded = diffused * params.decay;

  let scale = vec2f(params.aspect, 1.0);
  let p = (uv - params.prevHead) * scale;
  let seg = (params.head - params.prevHead) * scale;
  let t = clamp(dot(p, seg) / max(dot(seg, seg), 1e-6), 0.0, 1.0);
  let d = length(p - seg * t);
  // Gaussian-ish falloff rather than a hard-edged disc.
  let stroke = exp(-(d * d) / (params.radius * params.radius * 0.5)) * params.strength;

  return vec4f(clamp(faded + stroke, 0.0, 1.0), 0.0, 0.0, 1.0);
}
