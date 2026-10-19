/**
 * A petal drawn as a lit surface. The mesh carries each vertex's normal and
 * where it sits on the blade; the shader colors it along its gradient and
 * lights it: wrapped diffuse from the scene light, light passing through
 * thin parts of the blade, a highlight for glossy materials and a sheen on
 * the rims of hairy ones. Colors mix and light adds in linear light, so a
 * gradient between two hues does not pass through mud. The app renders with
 * WebGL only, so this is GLSL.
 */

import { GlProgram, Mesh, MeshGeometry, Shader, UniformGroup } from "pixi.js";
import { gradientAt, type GradientStop } from "../color.ts";
import type { Material } from "../lighting.ts";
import type { PetalSurface } from "../surface.ts";
import { LIGHT_VECTOR } from "../util.ts";

/** Gradients with more stops are resampled to this many. */
export const MAX_STOPS = 8;

const VERTEX = /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
in vec3 aNormal;
out vec2 vSurface;
out vec3 vNormal;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

void main() {
  mat3 model = uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((uProjectionMatrix * model * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  float scale = max(length(model[0].xy), 1e-6);
  vNormal = vec3(mat2(model) * aNormal.xy / scale, aNormal.z);
  vSurface = aUV;
}
`;

const FRAGMENT = /* glsl */ `
in vec2 vSurface;
in vec3 vNormal;
out vec4 finalColor;

uniform vec4 uColor;
uniform vec4 uStops[${MAX_STOPS}];
uniform float uStopCount;
uniform vec3 uLight;
uniform vec4 uMaterial;
uniform float uTranslucency;
uniform float uOpacity;

vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 toDisplay(vec3 c) { return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)); }

vec3 baseAt(float t) {
  vec3 color = toLinear(uStops[0].rgb);
  for (int i = 1; i < ${MAX_STOPS}; i++) {
    if (float(i) >= uStopCount) break;
    float from = uStops[i - 1].a;
    float span = max(uStops[i].a - from, 1e-4);
    float s = smoothstep(0.0, 1.0, (t - from) / span);
    color = mix(color, toLinear(uStops[i].rgb), s);
  }
  return color;
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 base = baseAt(vSurface.x);
  float diffuse = clamp((dot(n, uLight) + 0.35) / 1.35, 0.0, 1.0);
  vec3 rgb = base * (0.2 + 1.05 * diffuse);
  rgb += base * uTranslucency * vSurface.y * (1.0 - diffuse) * 0.4;
  vec3 halfway = normalize(uLight + vec3(0.0, 0.0, 1.0));
  rgb += vec3(uMaterial.x * pow(max(dot(n, halfway), 0.0), uMaterial.y));
  float rim = pow(1.0 - n.z, 1.5);
  vec3 dulled = rgb * (1.0 - 0.45 * uMaterial.z);
  vec3 sheen = min(base * 2.5 + 0.01, vec3(1.0));
  rgb = mix(dulled, sheen, clamp(uMaterial.z * rim * 2.5, 0.0, 1.0));
  float alpha = uOpacity * uColor.a;
  finalColor = vec4(toDisplay(rgb) * alpha, alpha);
}
`;

let program: GlProgram | null = null;

/** The program compiles once; every petal shares it and only the uniforms differ. */
function petalProgram(): GlProgram {
  program ??= GlProgram.from({
    vertex: VERTEX,
    fragment: FRAGMENT,
    name: "petal-shade",
  });
  return program;
}

const channels = (color: number): [number, number, number] => [
  ((color >> 16) & 0xff) / 255,
  ((color >> 8) & 0xff) / 255,
  (color & 0xff) / 255,
];

/** At most MAX_STOPS stops: a longer gradient is sampled evenly along the petal. */
export function shaderStops(
  stops: readonly GradientStop[],
): readonly GradientStop[] {
  if (stops.length <= MAX_STOPS) return stops;
  return Array.from({ length: MAX_STOPS }, (_, i) => {
    const position = i / (MAX_STOPS - 1);
    return { position, color: gradientAt(stops, position) };
  });
}

export type PetalShade = {
  /** at least one stop, positions ascending in [0, 1] */
  stops: readonly GradientStop[];
  material: Material;
  translucency: number;
  opacity: number;
};

/** A petal mesh in unit flower space; scale it to the drawn radius. */
export function createPetalMesh(
  surface: PetalSurface,
  shade: PetalShade,
): Mesh<MeshGeometry, Shader> {
  const geometry = new MeshGeometry({
    positions: surface.positions,
    uvs: surface.surface,
    indices: surface.indices,
  });
  geometry.addAttribute("aNormal", {
    buffer: surface.normals,
    format: "float32x3",
  });
  const stops = shaderStops(shade.stops);
  const packed = new Float32Array(MAX_STOPS * 4);
  stops.map((stop, i) =>
    packed.set([...channels(stop.color), stop.position], i * 4),
  );
  const uniforms = new UniformGroup({
    uStops: { value: packed, type: "vec4<f32>", size: MAX_STOPS },
    uStopCount: { value: stops.length, type: "f32" },
    uLight: { value: new Float32Array(LIGHT_VECTOR), type: "vec3<f32>" },
    uMaterial: {
      value: new Float32Array([
        shade.material.specular,
        shade.material.shininess,
        shade.material.sheen,
        0,
      ]),
      type: "vec4<f32>",
    },
    uTranslucency: { value: shade.translucency, type: "f32" },
    uOpacity: { value: shade.opacity, type: "f32" },
  });
  const shader = new Shader({
    glProgram: petalProgram(),
    resources: { petal: uniforms },
  });
  return new Mesh({ geometry, shader });
}

/** A destroyed mesh leaves its geometry and shader behind; this frees them. */
export function freePetalMesh(mesh: Mesh<MeshGeometry, Shader>): void {
  mesh.geometry.destroy();
  mesh.shader?.destroy();
}
