import * as PIXI from "pixi.js";
import type { SceneNode } from "@/core/types/scene";
import { colorToRGB } from "../utils/color-utils";

export interface MeshCreationResult {
  mesh: PIXI.Mesh<PIXI.MeshGeometry, PIXI.Shader>;
}

const VERTEX_COLOR_SHADER: PIXI.Shader = createVertexColorShader();

export function createMesh(o: SceneNode): MeshCreationResult | null {
  const { positions, colors, indices, topology } = buildMeshData(o);

  if (positions.length === 0) {
    return null;
  }

  const geometry = new PIXI.MeshGeometry({
    positions: new Float32Array(positions),
    uvs: new Float32Array(positions.length).fill(0),
    indices: new Uint32Array(indices),
    topology: topology,
  });

  const colorBuffer = new PIXI.Buffer({
    data: new Float32Array(colors),
    usage: PIXI.BufferUsage.VERTEX | PIXI.BufferUsage.COPY_DST,
  });

  // MeshGeometry always adds UVs, but the vertex-colour shader never reads them; left in, PixiJS warns
  // on every draw. Meshes with their own shader are never batched, so nothing else reads them either.
  delete geometry.attributes.aUV;

  geometry.addAttribute('aColor', {
    buffer: colorBuffer,
    format: 'float32x4',
    stride: 4 * 4,
    offset: 0,
    instance: false,
  });

  const mesh = new PIXI.Mesh({ geometry, shader: VERTEX_COLOR_SHADER });
  return { mesh };
}

function buildMeshData(o: SceneNode): {
  positions: number[];
  colors: number[];
  indices: number[];
  topology: 'triangle-list' | 'triangle-strip' | 'line-list' | 'line-strip';
} {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let topology: 'triangle-list' | 'triangle-strip' | 'line-list' | 'line-strip' = 'triangle-list';

  const pushVerts = () => {
    for (const v of o.vertices) {
      positions.push(v.x, v.y);
      const rgb = colorToRGB(v.color);
      colors.push(rgb[0], rgb[1], rgb[2], 1.0);
    }
  };

  const n = o.vertices.length;

  switch (o.type) {
    case "LINES":
      topology = 'line-list';
      pushVerts();
      for (let i = 0; i + 1 < n; i += 2) {
        indices.push(i, i + 1);
      }
      break;
    case "LINE_LOOP":
      topology = 'line-strip';
      pushVerts();
      for (let i = 0; i < n; i++) indices.push(i);
      if (n > 0) indices.push(0); // Connect back to the first vertex
      break;
    case "LINE_STRIP":
      topology = 'line-strip';
      pushVerts();
      for (let i = 0; i < n; i++) indices.push(i);
      break;
    case "TRIANGLE_STRIP":
      topology = 'triangle-strip';
      pushVerts();
      for (let i = 0; i < n; i++) indices.push(i);
      break;
    case "TRIANGLES":
      pushVerts();
      for (let i = 0; i + 2 < n; i += 3) {
        indices.push(i, i + 1, i + 2);
      }
      break;
    case "TRIANGLE_FAN":
      pushVerts();
      for (let i = 1; i < n - 1; i++) {
        indices.push(0, i, i + 1);
      }
      break;
    case "QUADS":
      pushVerts();
      for (let i = 0; i + 3 < n; i += 4) {
        // Correct OpenGL Triangulation for QUADS: (i, i+1, i+3) and (i+1, i+2, i+3)
        indices.push(i, i + 1, i + 3, i + 1, i + 2, i + 3);
      }
      break;
    case "QUAD_STRIP":
      pushVerts();
      for (let i = 0; i + 3 < n; i += 2) {
        // Correct OpenGL Triangulation for QUAD_STRIP: (i, i+1, i+3) and (i, i+3, i+2)
        indices.push(i, i + 1, i + 3, i, i + 3, i + 2);
      }
      break;
    case "POLYGON":
      pushVerts();
      for (let i = 1; i < n - 1; i++) {
        indices.push(0, i, i + 1);
      }
      break;
  }

  return { positions, colors, indices, topology };
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