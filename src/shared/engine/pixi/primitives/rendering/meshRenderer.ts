import * as PIXI from "pixi.js";
import type { SceneNode } from "@/core/types/scene";
import { colorToRGB } from "../utils/color-utils";
import { polygonTriangles, type FillMode, type Rgba, type Triangles } from "@/shared/lib/gl-geometry";

export interface MeshCreationResult {
  mesh: PIXI.Mesh<PIXI.MeshGeometry, PIXI.Shader>;
}

/** Draws each vertex in its own colour; the geometry carries positions and colours only. */
export const VERTEX_COLOR_SHADER: PIXI.Shader = createVertexColorShader();

const FILL_MODES: ReadonlySet<string> = new Set(['TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN', 'QUADS', 'QUAD_STRIP', 'POLYGON']);

export function toRgba(color: string): Rgba {
  const [r, g, b] = colorToRGB(color);
  return [r, g, b, 1];
}

/** Unindexed triangles as a geometry for VERTEX_COLOR_SHADER. */
export function vertexColorGeometry(triangles: Triangles): PIXI.MeshGeometry {
  const count = triangles.positions.length / 2;
  const geometry = new PIXI.MeshGeometry({
    positions: new Float32Array(triangles.positions),
    uvs: new Float32Array(count * 2),
    indices: Uint32Array.from({ length: count }, (_, i) => i),
    topology: 'triangle-list',
  });
  // MeshGeometry always adds UVs, but the vertex-colour shader never reads them; left in, PixiJS warns
  // on every draw. Meshes with their own shader are never batched, so nothing else reads them either.
  delete geometry.attributes.aUV;
  geometry.addAttribute('aColor', {
    buffer: new PIXI.Buffer({
      data: new Float32Array(triangles.colors),
      usage: PIXI.BufferUsage.VERTEX | PIXI.BufferUsage.COPY_DST,
    }),
    format: 'float32x4',
    stride: 4 * 4,
    offset: 0,
    instance: false,
  });
  return geometry;
}

/** A filled primitive as a mesh, blended for SMOOTH and one colour per primitive for FLAT. */
export function createMesh(o: SceneNode): MeshCreationResult | null {
  if (!FILL_MODES.has(o.type)) return null;
  const vertices = o.vertices.map((v) => ({ x: v.x, y: v.y, color: toRgba(v.color) }));
  const triangles = polygonTriangles(o.type as FillMode, vertices, o.shading === 'FLAT' ? 'FLAT' : 'SMOOTH');
  if (triangles.positions.length === 0) return null;
  return { mesh: new PIXI.Mesh({ geometry: vertexColorGeometry(triangles), shader: VERTEX_COLOR_SHADER }) };
}

function createVertexColorShader(): PIXI.Shader {
  return PIXI.Shader.from({
    gl: {
      vertex: `
        attribute vec2 aPosition;
        attribute vec4 aColor;

        uniform mat3 uProjectionMatrix;
        uniform mat3 uWorldTransformMatrix;
        uniform mat3 uTransformMatrix;

        varying vec4 vColor;

        void main() {
          mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
          gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
          vColor = aColor;
        }
      `,
      fragment: `
        precision mediump float;
        varying vec4 vColor;

        void main() {
          gl_FragColor = vColor;
        }
      `,
    },
    gpu: {
      vertex: {
        entryPoint: 'main',
        source: `
          struct GlobalUniforms {
            uProjectionMatrix: mat3x3<f32>,
            uWorldTransformMatrix: mat3x3<f32>,
            uTransformMatrix: mat3x3<f32>,
          };

          @group(0) @binding(0) var<uniform> globalUniforms : GlobalUniforms;

          struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) vColor: vec4<f32>,
          };

          @vertex
          fn main(@location(0) aPosition: vec2<f32>, @location(1) aColor: vec4<f32>) -> VertexOutput {
            var output: VertexOutput;
            let mvp = globalUniforms.uProjectionMatrix * globalUniforms.uWorldTransformMatrix * globalUniforms.uTransformMatrix;
            let pos = mvp * vec3<f32>(aPosition, 1.0);
            
            output.position = vec4<f32>(pos.xy, 0.0, 1.0);
            output.vColor = aColor;
            return output;
          }
        `,
      },
      fragment: {
        entryPoint: 'main',
        source: `
          @fragment
          fn main(@location(0) vColor: vec4<f32>) -> @location(0) vec4<f32> {
            return vColor;
          }
        `,
      },
    },
  });
}