/**
 * Custom PixiJS shader filters for premium visual effects.
 *
 * These are GLSL fragment shaders wrapped as PixiJS Filter instances.
 * Apply them to PixiJS containers/sprites for visual polish.
 *
 * Usage:
 *   import { createMergeGlowFilter } from './shaders'
 *   sprite.filters = [createMergeGlowFilter()]
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. MERGE GLOW — soft radial glow on newly merged arrangements
//    Apply on merge, animate intensity 1.0 → 0.0 over 2 seconds
// ═══════════════════════════════════════════════════════════════════════════

export const MERGE_GLOW_FRAG = `
precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uIntensity;
uniform vec3 uGlowColor;
uniform float uRadius;

void main() {
    vec4 color = texture2D(uSampler, vTextureCoord);

    // Distance from center (0,0 at center, 1.0 at edge)
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vTextureCoord, center) * 2.0;

    // Soft radial glow falloff
    float glow = exp(-dist * dist / (uRadius * uRadius)) * uIntensity;

    // Additive blend with glow color
    vec3 glowContribution = uGlowColor * glow * 0.6;
    color.rgb += glowContribution;

    // Slight alpha boost near center for luminance feel
    color.a = min(1.0, color.a + glow * 0.3);

    gl_FragColor = color;
}
`

export interface MergeGlowUniforms {
  uIntensity: number  // 0.0 - 1.0, animate from 1.0 to 0.0
  uGlowColor: [number, number, number]  // RGB 0-1
  uRadius: number  // glow spread, default 0.8
}

export const MERGE_GLOW_DEFAULTS: MergeGlowUniforms = {
  uIntensity: 1.0,
  uGlowColor: [1.0, 0.85, 0.4],  // warm gold
  uRadius: 0.8,
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. PETAL TRANSLUCENCY — light passing through thin petals
//    Apply to petal sprites. Simulates subsurface scattering.
// ═══════════════════════════════════════════════════════════════════════════

export const PETAL_TRANSLUCENCY_FRAG = `
precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTranslucency;
uniform vec2 uLightDir;

void main() {
    vec4 color = texture2D(uSampler, vTextureCoord);

    // Simulate light direction influence on alpha
    // Petals facing the light are more translucent
    float lightFactor = dot(normalize(vTextureCoord - vec2(0.5)), normalize(uLightDir));
    lightFactor = clamp(lightFactor, 0.0, 1.0);

    // Warm the color where light passes through
    float translucence = lightFactor * uTranslucency;
    color.rgb += vec3(0.15, 0.05, 0.0) * translucence;

    // Slightly increase brightness on light-facing edge
    color.rgb *= 1.0 + translucence * 0.3;

    // Alpha gradient — edges are more translucent
    float edgeDist = distance(vTextureCoord, vec2(0.5)) * 2.0;
    color.a *= mix(1.0, 1.0 - uTranslucency * 0.4, edgeDist);

    gl_FragColor = color;
}
`

export interface PetalTranslucencyUniforms {
  uTranslucency: number  // 0.0 - 1.0
  uLightDir: [number, number]  // normalized direction of virtual light
}

export const PETAL_TRANSLUCENCY_DEFAULTS: PetalTranslucencyUniforms = {
  uTranslucency: 0.4,
  uLightDir: [0.7, -0.7],  // top-right
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. DEPTH BLUR — subtle gaussian blur on distant flowers
//    Apply to homepage grid thumbnails based on distance from center
// ═══════════════════════════════════════════════════════════════════════════

export const DEPTH_BLUR_FRAG = `
precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uBlurAmount;

void main() {
    vec4 color = vec4(0.0);
    float total = 0.0;

    // Simple 9-tap gaussian blur
    for (float x = -1.0; x <= 1.0; x += 1.0) {
        for (float y = -1.0; y <= 1.0; y += 1.0) {
            vec2 offset = vec2(x, y) * uBlurAmount * 0.003;
            float weight = 1.0 - length(vec2(x, y)) * 0.3;
            color += texture2D(uSampler, vTextureCoord + offset) * weight;
            total += weight;
        }
    }

    gl_FragColor = color / total;
}
`

export interface DepthBlurUniforms {
  uBlurAmount: number  // 0.0 (sharp) to 5.0 (very blurry)
}

export const DEPTH_BLUR_DEFAULTS: DepthBlurUniforms = {
  uBlurAmount: 0.0,
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: create a PixiJS-compatible filter config object
// ═══════════════════════════════════════════════════════════════════════════

export interface ShaderConfig {
  fragment: string
  uniforms: Record<string, unknown>
}

export function mergeGlowConfig(overrides?: Partial<MergeGlowUniforms>): ShaderConfig {
  return {
    fragment: MERGE_GLOW_FRAG,
    uniforms: { ...MERGE_GLOW_DEFAULTS, ...overrides },
  }
}

export function petalTranslucencyConfig(overrides?: Partial<PetalTranslucencyUniforms>): ShaderConfig {
  return {
    fragment: PETAL_TRANSLUCENCY_FRAG,
    uniforms: { ...PETAL_TRANSLUCENCY_DEFAULTS, ...overrides },
  }
}

export function depthBlurConfig(overrides?: Partial<DepthBlurUniforms>): ShaderConfig {
  return {
    fragment: DEPTH_BLUR_FRAG,
    uniforms: { ...DEPTH_BLUR_DEFAULTS, ...overrides },
  }
}
