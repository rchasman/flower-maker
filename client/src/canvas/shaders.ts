/**
 * Custom PixiJS v8 shader filters for premium visual effects.
 *
 * These are GLSL 300 es fragment shaders wrapped as PixiJS Filter instances.
 * Apply them to PixiJS containers/sprites for visual polish.
 *
 * Usage:
 *   import { createMergeGlowFilter } from './shaders'
 *   sprite.filters = [createMergeGlowFilter()]
 */

import { Filter } from "pixi.js";

// ═══════════════════════════════════════════════════════════════════════════
// 1. MERGE GLOW — a warm glow over the flower a merge lands on
//    Apply on merge, animate intensity 1.0 → 0.0 over 2 seconds
// ═══════════════════════════════════════════════════════════════════════════

const MERGE_GLOW_FRAG = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uIntensity;
uniform vec3 uGlowColor;

void main() {
    vec4 color = texture(uTexture, vTextureCoord);
    // Colors are premultiplied: the glow lights the flower's own pixels in
    // proportion to their coverage, so the empty frame around it stays clear.
    color.rgb += uGlowColor * uIntensity * 0.6 * color.a;
    finalColor = color;
}
`;

const MERGE_GLOW_COLOR: [number, number, number] = [1.0, 0.85, 0.4]; // warm gold

/** Create a PixiJS v8 Filter for merge glow effect. */
export function createMergeGlowFilter(): Filter {
  return Filter.from({
    gl: {
      vertex: defaultFilterVert(),
      fragment: MERGE_GLOW_FRAG,
    },
    resources: {
      mergeGlowUniforms: {
        uIntensity: { value: 1, type: "f32" },
        uGlowColor: {
          value: new Float32Array(MERGE_GLOW_COLOR),
          type: "vec3<f32>",
        },
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. DARK FANTASY DITHER — color grading + ordered dithering in one pass
//    Crushes blacks, tints shadows purple, warms highlights gold,
//    then quantizes through an 8×8 Bayer matrix for visible texture.
//    Apply to app.stage for full-screen effect.
// ═══════════════════════════════════════════════════════════════════════════

export const DARK_FANTASY_DITHER_FRAG = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uColorLevels;
uniform float uContrast;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
uniform float uTintStrength;
uniform float uVignetteStrength;

// 4×4 Bayer threshold via mod/floor arithmetic (GLSL ES 1.00 compatible, no bitwise ops)
float bayer4(vec2 p) {
    vec2 c = floor(mod(p, 4.0));
    float x = c.x;
    float y = c.y;
    // Encode the 4×4 Bayer matrix: M[x,y] = (bit-reverse interleave of x,y) / 16
    // Using the closed-form: 8*mod(x+y,2) + 4*mod(floor(y/2),2) + 2*mod(floor(x/2),2) + mod(floor((x+y)/2),2)
    float v = 8.0 * mod(x + y, 2.0)
            + 4.0 * mod(floor(y * 0.5), 2.0)
            + 2.0 * mod(floor(x * 0.5), 2.0)
            + mod(floor((x + y) * 0.5), 2.0);
    return (v + 0.5) / 16.0;
}

void main() {
    vec4 color = texture(uTexture, vTextureCoord);

    // Skip transparent pixels — filter covers the container bounding box
    // and we don't want to promote empty space to visible gray via dithering
    if (color.a < 0.01) { finalColor = color; return; }

    // ── 1. Contrast: single S-curve blended with original ──
    vec3 c = mix(color.rgb, smoothstep(0.0, 1.0, color.rgb), uContrast);

    // ── 2. Shadow/highlight tinting ──
    float luminance = dot(c, vec3(0.299, 0.587, 0.114));
    // Shadows: blend toward tint where dark, highlights: blend where bright
    vec3 shadowBlend = mix(c, c * uShadowTint, (1.0 - luminance) * uTintStrength);
    vec3 highlightBlend = mix(shadowBlend, shadowBlend + uHighlightTint * 0.3,
        luminance * luminance * uTintStrength);
    c = highlightBlend;

    // ── 3. Vignette: darken edges ──
    vec2 uv = vTextureCoord - 0.5;
    float vignette = 1.0 - dot(uv, uv) * uVignetteStrength;
    c *= vignette;

    // ── 4. Ordered dither ──
    float threshold = bayer4(gl_FragCoord.xy) - 0.5;
    float levels = uColorLevels;
    vec3 scaled = c * levels;
    vec3 quantized = (floor(scaled) + step(0.0, fract(scaled) + threshold)) / levels;

    finalColor = vec4(clamp(quantized, 0.0, 1.0), color.a);
}
`;

export interface DarkFantasyDitherUniforms {
  uColorLevels: number; // color steps per channel (5 = chunky dark fantasy)
  uContrast: number; // S-curve strength (0 = none, 1 = full)
  uShadowTint: [number, number, number]; // RGB multiplier for dark tones
  uHighlightTint: [number, number, number]; // RGB additive for bright tones
  uTintStrength: number; // how much tinting to apply (0–1)
  uVignetteStrength: number; // edge darkening (0 = none, 2 = heavy)
}

export const DARK_FANTASY_DITHER_DEFAULTS: DarkFantasyDitherUniforms = {
  uColorLevels: 5.0,
  uContrast: 0.6,
  uShadowTint: [0.7, 0.5, 1.0], // deep purple shadows
  uHighlightTint: [1.0, 0.85, 0.4], // warm gold highlights
  uTintStrength: 0.5,
  uVignetteStrength: 1.2,
};

/** Create a PixiJS v8 Filter for dark fantasy color grading + ordered dithering. */
export function createDarkFantasyDitherFilter(
  overrides?: Partial<DarkFantasyDitherUniforms>,
): Filter {
  const d = { ...DARK_FANTASY_DITHER_DEFAULTS, ...overrides };
  return Filter.from({
    resolution: "inherit",
    antialias: "inherit",
    gl: {
      vertex: defaultFilterVert(),
      fragment: DARK_FANTASY_DITHER_FRAG,
    },
    resources: {
      ditherUniforms: {
        uColorLevels: { value: d.uColorLevels, type: "f32" },
        uContrast: { value: d.uContrast, type: "f32" },
        uShadowTint: {
          value: new Float32Array(d.uShadowTint),
          type: "vec3<f32>",
        },
        uHighlightTint: {
          value: new Float32Array(d.uHighlightTint),
          type: "vec3<f32>",
        },
        uTintStrength: { value: d.uTintStrength, type: "f32" },
        uVignetteStrength: { value: d.uVignetteStrength, type: "f32" },
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Default filter vertex shader (PixiJS v8 compatible)
// ═══════════════════════════════════════════════════════════════════════════

function defaultFilterVert(): string {
  return /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;
}
