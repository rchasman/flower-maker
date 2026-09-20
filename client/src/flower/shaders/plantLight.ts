/**
 * The plant light filter: shades every head as a shallow cup lit from the
 * scene light, and lets light through thin petals. One filter per flower
 * Graphics; the heads arrive as uniforms in the flower's local pixels.
 *
 * The filter texture's origin moves with the flower's bounds, so a hidden
 * one pixel Sprite at the flower's origin gives pixi something whose world
 * transform maps filter texture space back to local pixels, the way
 * DisplacementFilter does.
 */

import {
  Filter,
  GlProgram,
  GpuProgram,
  Matrix,
  Sprite,
  Texture,
  UniformGroup,
  type FilterSystem,
  type RenderSurface,
} from "pixi.js";
import { MAX_LIT_HEADS, type HeadLight } from "../lighting.ts";
import { LIGHT_DIRECTION } from "../util.ts";

const HEADS = MAX_LIT_HEADS;

const VERTEX_GLSL = /* glsl */ `
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

const FRAGMENT_GLSL = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputPixel;
uniform mat3 uFilterMatrix;
uniform vec2 uLight;
uniform float uHeadCount;
uniform vec4 uHeads[${HEADS}];
uniform vec4 uHeadFx[${HEADS}];

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  vec4 color = texture(uTexture, vTextureCoord);
  if (color.a < 0.002) { finalColor = color; return; }
  vec2 local = (uFilterMatrix * vec3(vTextureCoord, 1.0)).xy;
  float best = 1e9;
  vec4 head = vec4(0.0);
  vec4 headFx = vec4(0.0);
  for (int i = 0; i < ${HEADS}; i++) {
    if (float(i) >= uHeadCount) break;
    vec4 h = uHeads[i];
    float d = length(local - h.xy) / max(h.z, 1e-3);
    if (d < best) { best = d; head = h; headFx = uHeadFx[i]; }
  }
  vec3 rgb = color.rgb / color.a;
  if (best < 1.2) {
    vec2 p = (local - head.xy) / max(head.z, 1e-3);
    float inside = 1.0 - smoothstep(0.95, 1.2, best);
    float lit = dot(p, uLight);
    float rim = smoothstep(0.55, 1.0, best);
    float well = 1.0 - smoothstep(0.0, 0.4, best);
    float shade = head.w * inside * (0.8 * lit + 0.4 * rim - 0.45 * well);
    rgb *= 1.0 + shade;
    float catchLight = head.w * inside * rim * max(lit, 0.0);
    rgb = mix(rgb, vec3(1.0), catchLight * 0.4);

    vec2 texel = uInputPixel.zw;
    float dx = luma(texture(uTexture, vTextureCoord + vec2(texel.x, 0.0)).rgb)
             - luma(texture(uTexture, vTextureCoord - vec2(texel.x, 0.0)).rgb);
    float dy = luma(texture(uTexture, vTextureCoord + vec2(0.0, texel.y)).rgb)
             - luma(texture(uTexture, vTextureCoord - vec2(0.0, texel.y)).rgb);
    float edge = clamp(length(vec2(dx, dy)) * 2.0, 0.0, 1.0);
    float thin = 1.0 - color.a;
    float pale = smoothstep(0.45, 0.95, luma(rgb));
    float through = headFx.x * inside * (0.35 * thin + 0.3 * edge + 0.1 * pale);
    rgb = mix(rgb, vec3(1.0, 0.97, 0.9), clamp(through, 0.0, 1.0) * 0.45);
  }
  finalColor = vec4(clamp(rgb, 0.0, 1.0) * color.a, color.a);
}
`;

const WGSL = /* wgsl */ `
struct GlobalFilterUniforms {
  uInputSize: vec4<f32>,
  uInputPixel: vec4<f32>,
  uInputClamp: vec4<f32>,
  uOutputFrame: vec4<f32>,
  uGlobalFrame: vec4<f32>,
  uOutputTexture: vec4<f32>,
};

struct PlantLightUniforms {
  uFilterMatrix: mat3x3<f32>,
  uLight: vec2<f32>,
  uHeadCount: f32,
  uHeads: array<vec4<f32>, ${HEADS}>,
  uHeadFx: array<vec4<f32>, ${HEADS}>,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> plantLight: PlantLightUniforms;

struct VSOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

fn filterVertexPosition(aPosition: vec2<f32>) -> vec4<f32> {
  var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;
  position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

fn filterTextureCoord(aPosition: vec2<f32>) -> vec2<f32> {
  return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}

@vertex
fn mainVertex(@location(0) aPosition: vec2<f32>) -> VSOutput {
  return VSOutput(filterVertexPosition(aPosition), filterTextureCoord(aPosition));
}

fn luma(c: vec3<f32>) -> f32 { return dot(c, vec3<f32>(0.299, 0.587, 0.114)); }

@fragment
fn mainFragment(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let color = textureSample(uTexture, uSampler, uv);
  let texel = gfu.uInputPixel.zw;
  let dxSample = luma(textureSample(uTexture, uSampler, uv + vec2<f32>(texel.x, 0.0)).rgb)
               - luma(textureSample(uTexture, uSampler, uv - vec2<f32>(texel.x, 0.0)).rgb);
  let dySample = luma(textureSample(uTexture, uSampler, uv + vec2<f32>(0.0, texel.y)).rgb)
               - luma(textureSample(uTexture, uSampler, uv - vec2<f32>(0.0, texel.y)).rgb);
  if (color.a < 0.002) { return color; }
  let local = (plantLight.uFilterMatrix * vec3<f32>(uv, 1.0)).xy;
  var best = 1e9;
  var head = vec4<f32>(0.0);
  var headFx = vec4<f32>(0.0);
  for (var i = 0; i < ${HEADS}; i++) {
    if (f32(i) >= plantLight.uHeadCount) { break; }
    let h = plantLight.uHeads[i];
    let d = length(local - h.xy) / max(h.z, 1e-3);
    if (d < best) { best = d; head = h; headFx = plantLight.uHeadFx[i]; }
  }
  var rgb = color.rgb / color.a;
  if (best < 1.2) {
    let p = (local - head.xy) / max(head.z, 1e-3);
    let inside = 1.0 - smoothstep(0.95, 1.2, best);
    let lit = dot(p, plantLight.uLight);
    let rim = smoothstep(0.55, 1.0, best);
    let well = 1.0 - smoothstep(0.0, 0.4, best);
    let shade = head.w * inside * (0.8 * lit + 0.4 * rim - 0.45 * well);
    rgb = rgb * (1.0 + shade);
    let catchLight = head.w * inside * rim * max(lit, 0.0);
    rgb = mix(rgb, vec3<f32>(1.0), catchLight * 0.4);
    let edge = clamp(length(vec2<f32>(dxSample, dySample)) * 2.0, 0.0, 1.0);
    let thin = 1.0 - color.a;
    let pale = smoothstep(0.45, 0.95, luma(rgb));
    let through = headFx.x * inside * (0.35 * thin + 0.3 * edge + 0.1 * pale);
    rgb = mix(rgb, vec3<f32>(1.0, 0.97, 0.9), clamp(through, 0.0, 1.0) * 0.45);
  }
  return vec4<f32>(clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0)) * color.a, color.a);
}
`;

let sharedPrograms: { gl: GlProgram; gpu: GpuProgram } | null = null;

/** Both programs compile once; every filter shares them and only the uniforms differ. */
function programs(): { gl: GlProgram; gpu: GpuProgram } {
  if (sharedPrograms) return sharedPrograms;
  sharedPrograms = {
    gl: GlProgram.from({
      vertex: VERTEX_GLSL,
      fragment: FRAGMENT_GLSL,
      name: "plant-light-filter",
    }),
    gpu: GpuProgram.from({
      vertex: { source: WGSL, entryPoint: "mainVertex" },
      fragment: { source: WGSL, entryPoint: "mainFragment" },
      name: "plant-light-filter",
    }),
  };
  return sharedPrograms;
}

/** Packs the heads into the two vec4 arrays the shader reads. */
export function packHeadLights(lights: readonly HeadLight[]): {
  heads: Float32Array;
  fx: Float32Array;
  count: number;
} {
  const used = lights.slice(0, HEADS);
  const heads = new Float32Array(HEADS * 4);
  const fx = new Float32Array(HEADS * 4);
  used.forEach((light, i) => {
    heads.set([light.x, light.y, light.radius, light.strength], i * 4);
    fx.set([light.translucency, 0, 0, 0], i * 4);
  });
  return { heads, fx, count: used.length };
}

const createPlantUniforms = () =>
  new UniformGroup({
    uFilterMatrix: { value: new Matrix(), type: "mat3x3<f32>" },
    uLight: {
      value: new Float32Array(LIGHT_DIRECTION),
      type: "vec2<f32>",
    },
    uHeadCount: { value: 0, type: "f32" },
    uHeads: {
      value: new Float32Array(HEADS * 4),
      type: "vec4<f32>",
      size: HEADS,
    },
    uHeadFx: {
      value: new Float32Array(HEADS * 4),
      type: "vec4<f32>",
      size: HEADS,
    },
  });

type PlantUniforms = ReturnType<typeof createPlantUniforms>;

export class PlantLightFilter extends Filter {
  private readonly anchor: Sprite;
  private readonly plantUniforms: PlantUniforms;

  /** `anchor` must sit at the flower's local origin, in the same parent as the filtered Graphics. */
  constructor(anchor: Sprite) {
    const plantUniforms = createPlantUniforms();
    const { gl, gpu } = programs();
    super({
      glProgram: gl,
      gpuProgram: gpu,
      resources: { plantLight: plantUniforms },
      resolution: "inherit",
      antialias: "inherit",
    });
    this.anchor = anchor;
    this.plantUniforms = plantUniforms;
  }

  setHeads(lights: readonly HeadLight[]): void {
    const packed = packHeadLights(lights);
    this.plantUniforms.uniforms.uHeads.set(packed.heads);
    this.plantUniforms.uniforms.uHeadFx.set(packed.fx);
    this.plantUniforms.uniforms.uHeadCount = packed.count;
    this.plantUniforms.update();
  }

  override apply(
    filterManager: FilterSystem,
    input: Texture,
    output: RenderSurface,
    clearMode: boolean,
  ): void {
    filterManager.calculateSpriteMatrix(
      this.plantUniforms.uniforms.uFilterMatrix,
      this.anchor,
    );
    filterManager.applyFilter(this, input, output, clearMode);
  }
}

/** The hidden one pixel sprite a PlantLightFilter maps its texture through. */
export function createLightAnchor(): Sprite {
  const anchor = new Sprite(Texture.WHITE);
  anchor.renderable = false;
  return anchor;
}
