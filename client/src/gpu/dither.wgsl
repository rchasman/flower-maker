// Ordered dithering shared by every GPU surface on the site. One bit deep: ink or paper.
// The pointer trail (see trail.wgsl) reveals colour; its edge is thresholded against the same
// Bayer matrix as the image, so the boundary breaks into dots instead of a smooth outline.

const INK = vec3f(0.0, 0.0, 0.0);
const PAPER = vec3f(1.0, 1.0, 1.0);
const ACCENT = vec3f(0.659, 0.333, 0.969);

fn bayer2(xb: u32, yb: u32) -> u32 {
  return ((xb ^ yb) << 1u) | yb;
}

// 8x8 Bayer matrix built from its recursive definition, so no array indexing is needed.
export fn bayer8(p: vec2u) -> f32 {
  let x = p.x & 7u;
  let y = p.y & 7u;
  let v = (bayer2(x & 1u, y & 1u) << 4u)
        | (bayer2((x >> 1u) & 1u, (y >> 1u) & 1u) << 2u)
        | bayer2((x >> 2u) & 1u, (y >> 2u) & 1u);
  return (f32(v) + 0.5) / 64.0;
}

export fn ditherBit(luminance: f32, threshold: f32) -> f32 {
  return select(0.0, 1.0, clamp(luminance, 0.0, 1.0) > threshold);
}

export fn paperOrInk(bit: f32) -> vec3f {
  return mix(INK, PAPER, bit);
}

export fn accentRamp(luminance: f32) -> vec3f {
  let low = mix(INK, ACCENT, smoothstep(0.0, 0.55, luminance));
  return mix(low, PAPER, smoothstep(0.55, 1.0, luminance));
}

// 1 where this cell should show colour, given the trail value sampled at the cell.
export fn revealMask(trail: f32, threshold: f32) -> f32 {
  return step(threshold, trail);
}
