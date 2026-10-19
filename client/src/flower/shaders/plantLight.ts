/**
 * The plant light filter: shades every head as a shallow cup lit from the
 * scene light, so the centre and the petals around it read as one volume.
 * Each petal lights its own surface (petalShade.ts); this is the head's
 * shape around them. One filter per plant; the heads arrive as uniforms in
 * the flower's local pixels. The app renders with WebGL only, so this is GLSL.
 *
 * The filter texture's origin moves with the flower's bounds, so a hidden
 * one pixel Sprite at the flower's origin gives pixi something whose world
 * transform maps filter texture space back to local pixels, the way
 * DisplacementFilter does.
 */

import {
  Filter,
  GlProgram,
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
uniform mat3 uFilterMatrix;
uniform vec2 uLight;
uniform float uHeadCount;
uniform vec4 uHeads[${HEADS}];

void main() {
  vec4 color = texture(uTexture, vTextureCoord);
  if (color.a < 0.002) { finalColor = color; return; }
  vec2 local = (uFilterMatrix * vec3(vTextureCoord, 1.0)).xy;
  float best = 1e9;
  vec4 head = vec4(0.0);
  for (int i = 0; i < ${HEADS}; i++) {
    if (float(i) >= uHeadCount) break;
    vec4 h = uHeads[i];
    float d = length(local - h.xy) / max(h.z, 1e-3);
    if (d < best) { best = d; head = h; }
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
  }
  finalColor = vec4(clamp(rgb, 0.0, 1.0) * color.a, color.a);
}
`;

let sharedProgram: GlProgram | null = null;

/** The program compiles once; every filter shares it and only the uniforms differ. */
function program(): GlProgram {
  sharedProgram ??= GlProgram.from({
    vertex: VERTEX_GLSL,
    fragment: FRAGMENT_GLSL,
    name: "plant-light-filter",
  });
  return sharedProgram;
}

/** Packs the heads into the vec4 array the shader reads. */
export function packHeadLights(lights: readonly HeadLight[]): {
  heads: Float32Array;
  count: number;
} {
  const used = lights.slice(0, HEADS);
  const heads = new Float32Array(HEADS * 4);
  used.map((light, i) =>
    heads.set([light.x, light.y, light.radius, light.strength], i * 4),
  );
  return { heads, count: used.length };
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
  });

type PlantUniforms = ReturnType<typeof createPlantUniforms>;

export class PlantLightFilter extends Filter {
  private readonly anchor: Sprite;
  private readonly plantUniforms: PlantUniforms;

  /** `anchor` must sit at the flower's local origin, in the same parent as the filtered Graphics. */
  constructor(anchor: Sprite) {
    const plantUniforms = createPlantUniforms();
    super({
      glProgram: program(),
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
