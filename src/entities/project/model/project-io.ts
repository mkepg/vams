import type { VamsState } from '@/core/store/types';
import type {
  AxisVisibility,
  BufferUpdateMethod,
  BufferUsage,
  ColorMode,
  GlutCallbackKind,
  InteractionMode,
  LearningSettings,
  LineStipple,
  AnimationMotion,
  ObjectAnimation,
  PendingVertex,
  PrimitiveType,
  RenderingMode,
  ShadingModel,
  TransformState,
  SceneNode,
  SceneNodeType,
  Vertex,
  ViewportLimits,
} from '@/core/types/scene';
import type {
  TextureAsset,
  TextureAttachment,
  TextureFilter,
  TextureWrap,
  UV,
} from '@/core/types/textures';

// v8 adds the optional per-object `animation` descriptor. Additive and
// backward-compatible: v7 files simply have no animation (sanitized to null).
export const VAMS_PROJECT_SCHEMA_VERSION = 8;
export type VamsProjectData = {
  objects: SceneNode[];
  viewportLimits: ViewportLimits;
  axisVisibility: AxisVisibility;
  showCoordinateTracker: boolean;
  learningSettings: LearningSettings;
  theme: 'dark' | 'light';
  canvasBackgroundColor: string;
  selectedObjectId: string | null;
  interactionMode: InteractionMode;
  selectedVertexId: string | null;
  pendingShapeType: PrimitiveType | null;
  pendingVertices: PendingVertex[];
  pendingMinVertices: number;
  pendingVertexStride: number | null;
  callbacks: Record<GlutCallbackKind, string>;
  uploadedTextures: TextureAsset[];
};
export type VamsProjectFile = {
  app: 'VAMS';
  schemaVersion: number;
  exportedAt: string;
  data: VamsProjectData;
};
const ALLOWED_OBJECT_TYPES: ReadonlySet<SceneNodeType> = new Set([
  'POINTS', 'LINES', 'LINE_STRIP', 'LINE_LOOP',
  'TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN',
  'QUADS', 'QUAD_STRIP', 'POLYGON',
  'TEXT', 'GROUP',
]);
const CALLBACK_KINDS: GlutCallbackKind[] = [
  'keyboard', 'mouse', 'reshape', 'motion', 'idle',
];
const DEFAULT_VIEWPORT: ViewportLimits = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
const DEFAULT_AXIS: AxisVisibility = { showGlobalAxes: true, showLocalAxes: true, showOriginMarker: true, showGridlines: true };
const DEFAULT_LEARNING: LearningSettings = { gridSnapping: false, snapIncrement: 0.1 };
const DEFAULT_TRANSFORM: TransformState = { translateX: 0, translateY: 0, rotate: 0, scaleX: 1, scaleY: 1 };
const DEFAULT_CALLBACKS: Record<GlutCallbackKind, string> = {
  keyboard: '', mouse: '', reshape: '', motion: '', idle: '',
};
const DEFAULT_DATA: VamsProjectData = {
  objects: [],
  viewportLimits: DEFAULT_VIEWPORT,
  axisVisibility: DEFAULT_AXIS,
  showCoordinateTracker: false,
  learningSettings: DEFAULT_LEARNING,
  theme: 'dark',
  canvasBackgroundColor: '#000000',
  selectedObjectId: null,
  interactionMode: 'SELECT',
  selectedVertexId: null,
  pendingShapeType: null,
  pendingVertices: [],
  pendingMinVertices: 1,
  pendingVertexStride: null,
  callbacks: { ...DEFAULT_CALLBACKS },
  uploadedTextures: [],
};
function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null; }
function toNumber(v: unknown, fallback: number): number { return typeof v === 'number' && Number.isFinite(v) ? v : fallback; }
function toBoolean(v: unknown, fallback: boolean): boolean { return typeof v === 'boolean' ? v : fallback; }
function toString(v: unknown, fallback: string): string { return typeof v === 'string' ? v : fallback; }
function toTheme(v: unknown): 'dark' | 'light' { return v === 'light' ? 'light' : 'dark'; }
function toShading(v: unknown): ShadingModel { return v === 'FLAT' ? 'FLAT' : 'SMOOTH'; }
function toColorMode(v: unknown): ColorMode { return v === 'BYTE' ? 'BYTE' : 'FLOAT'; }
function toRenderingMode(v: unknown): RenderingMode {
  if (v === 'VERTEX_ARRAY') return 'VERTEX_ARRAY';
  if (v === 'VBO') return 'VBO';
  return 'IMMEDIATE';
}
function toBufferUsage(v: unknown): BufferUsage {
  if (v === 'DYNAMIC') return 'DYNAMIC';
  if (v === 'STREAM') return 'STREAM';
  return 'STATIC';
}
function toUpdateMethod(v: unknown): BufferUpdateMethod {
  return v === 'MAP_BUFFER' ? 'MAP_BUFFER' : 'BUFFER_SUB_DATA';
}
function toInteractionMode(v: unknown): InteractionMode {
  if (v === 'CUSTOM_SHAPE_PLACE') return 'VERTEX_PLACE';
  const allowed: InteractionMode[] = ['SELECT', 'VERTEX_PLACE', 'VERTEX_EDIT'];
  return allowed.includes(v as InteractionMode) ? (v as InteractionMode) : 'SELECT';
}
function toPrimitiveType(v: unknown): PrimitiveType | null {
  if (typeof v !== 'string') return null;
  const allowed: PrimitiveType[] = [
    'POINTS', 'LINES', 'LINE_STRIP', 'LINE_LOOP',
    'TRIANGLES', 'TRIANGLE_STRIP', 'TRIANGLE_FAN',
    'QUADS', 'QUAD_STRIP', 'POLYGON',
  ];
  return allowed.includes(v as PrimitiveType) ? (v as PrimitiveType) : null;
}
function sanitizeViewport(v: unknown): ViewportLimits {
  if (!isRecord(v)) return DEFAULT_VIEWPORT;
  return { minX: toNumber(v.minX, DEFAULT_VIEWPORT.minX), maxX: toNumber(v.maxX, DEFAULT_VIEWPORT.maxX), minY: toNumber(v.minY, DEFAULT_VIEWPORT.minY), maxY: toNumber(v.maxY, DEFAULT_VIEWPORT.maxY) };
}
function sanitizeAxis(v: unknown): AxisVisibility {
  if (!isRecord(v)) return DEFAULT_AXIS;
  return { showGlobalAxes: toBoolean(v.showGlobalAxes, DEFAULT_AXIS.showGlobalAxes), showLocalAxes: toBoolean(v.showLocalAxes, DEFAULT_AXIS.showLocalAxes), showOriginMarker: toBoolean(v.showOriginMarker, DEFAULT_AXIS.showOriginMarker), showGridlines: toBoolean(v.showGridlines, DEFAULT_AXIS.showGridlines) };
}
function sanitizeLearning(v: unknown): LearningSettings {
  if (!isRecord(v)) return DEFAULT_LEARNING;
  return { gridSnapping: toBoolean(v.gridSnapping, DEFAULT_LEARNING.gridSnapping), snapIncrement: toNumber(v.snapIncrement, DEFAULT_LEARNING.snapIncrement) };
}
function sanitizeTransform(v: unknown): TransformState {
  if (!isRecord(v)) return DEFAULT_TRANSFORM;
  return {
    translateX: toNumber(v.translateX, DEFAULT_TRANSFORM.translateX),
    translateY: toNumber(v.translateY, DEFAULT_TRANSFORM.translateY),
    rotate:     toNumber(v.rotate,     DEFAULT_TRANSFORM.rotate),
    scaleX:     toNumber(v.scaleX ?? v.scale, DEFAULT_TRANSFORM.scaleX),
    scaleY:     toNumber(v.scaleY ?? v.scale, DEFAULT_TRANSFORM.scaleY),
  };
}
function sanitizeVertex(v: unknown, idx: number): Vertex {
  if (!isRecord(v)) return { id: `v${idx}`, x: 0, y: 0, color: '#ffffff' };
  return { id: toString(v.id, `v${idx}`), x: toNumber(v.x, 0), y: toNumber(v.y, 0), color: toString(v.color, '#ffffff') };
}
function sanitizeStipple(v: unknown): LineStipple | null {
  if (!isRecord(v)) return null;
  const factor = Math.max(1, Math.min(256, Math.floor(toNumber(v.factor, 1))));
  const pattern = Math.floor(toNumber(v.pattern, 0xFFFF)) & 0xFFFF;
  return { factor, pattern };
}
const ALLOWED_MOTIONS = new Set<AnimationMotion>(['rotate', 'pulse', 'slide', 'orbit']);
function sanitizeAnimation(v: unknown): ObjectAnimation | null {
  if (!isRecord(v)) return null;
  const motion = v.motion as AnimationMotion;
  if (!ALLOWED_MOTIONS.has(motion)) return null;
  const speed = Math.max(0.1, Math.min(10, toNumber(v.speed, 1)));
  return { motion, speed };
}
function toFilter(v: unknown): TextureFilter {
  return v === 'NEAREST' ? 'NEAREST' : 'LINEAR';
}
function toWrap(v: unknown): TextureWrap {
  return v === 'CLAMP_TO_EDGE' ? 'CLAMP_TO_EDGE' : 'REPEAT';
}
function sanitizeTextureAttachment(v: unknown): TextureAttachment | null {
  if (!isRecord(v)) return null;
  const id = typeof v.textureId === 'string' ? v.textureId : null;
  if (!id) return null;
  return { textureId: id, filter: toFilter(v.filter), wrap: toWrap(v.wrap) };
}
function sanitizeUVs(v: unknown): UV[] | null {
  if (!Array.isArray(v)) return null;
  const out: UV[] = [];
  for (const item of v) {
    if (!isRecord(item)) continue;
    out.push({ u: toNumber(item.u, 0), v: toNumber(item.v, 0) });
  }
  return out;
}
function sanitizeTextureAsset(v: unknown): TextureAsset | null {
  if (!isRecord(v)) return null;
  const id      = toString(v.id, '');
  const dataUrl = toString(v.dataUrl, '');
  if (!id || !dataUrl.startsWith('data:image/')) return null;
  return {
    id,
    name:   toString(v.name, 'untitled'),
    dataUrl,
    width:  Math.max(1, Math.floor(toNumber(v.width, 1))),
    height: Math.max(1, Math.floor(toNumber(v.height, 1))),
    isSample: false,
  };
}
function sanitizeObject(v: unknown, idx: number): SceneNode | null {
  if (!isRecord(v)) return null;
  const typeRaw = v.type;
  const type = (typeof typeRaw === 'string' ? typeRaw : '') as SceneNodeType;
  if (!ALLOWED_OBJECT_TYPES.has(type)) return null;
  const verticesRaw = Array.isArray(v.vertices) ? v.vertices : [];
  const visibleRaw = v.visible ?? v.isVisible;
  const childrenRaw = Array.isArray(v.children)
    ? v.children
    : Array.isArray(v.childIds) ? v.childIds : [];
  return {
    id: toString(v.id, `obj-${idx}`),
    name: toString(v.name, `${type}_${idx + 1}`),
    type,
    visible: toBoolean(visibleRaw, true),
    shading: toShading(v.shading),
    vertices: verticesRaw.map((vv, i) => sanitizeVertex(vv, i)),
    transform: sanitizeTransform(v.transform),
    textContent: typeof v.textContent === 'string' ? v.textContent : undefined,
    rasterPosition: isRecord(v.rasterPosition) ? { x: toNumber(v.rasterPosition.x, 0), y: toNumber(v.rasterPosition.y, 0) } : undefined,
    parentId: typeof v.parentId === 'string' ? v.parentId : null,
    children: (childrenRaw as unknown[]).filter((id) => typeof id === 'string') as string[],
    colorMode: toColorMode(v.colorMode),
    lineWidth: typeof v.lineWidth === 'number' && Number.isFinite(v.lineWidth)
      ? Math.max(0.5, Math.min(20, v.lineWidth))
      : undefined,
    lineStipple: v.lineStipple == null ? null : sanitizeStipple(v.lineStipple),
    renderingMode: toRenderingMode(v.renderingMode),
    bufferUsage: toBufferUsage(v.bufferUsage),
    useIndexed: toBoolean(v.useIndexed, false),
    updateMethod: toUpdateMethod(v.updateMethod),
    texture: sanitizeTextureAttachment(v.texture),
    uvs:     sanitizeUVs(v.uvs),
    animation: sanitizeAnimation(v.animation),
  };
}
function fixHierarchy(objects: SceneNode[]): SceneNode[] {
  const ids = new Set(objects.map((o) => o.id));
  let normalized = objects.map((o) => ({ ...o, parentId: o.parentId && ids.has(o.parentId) ? o.parentId : null }));
  normalized = normalized.map((o) => {
    if (o.type !== 'GROUP') return o;
    const children = normalized.filter((child) => child.parentId === o.id).map((child) => child.id);
    return { ...o, children };
  });
  return normalized;
}
function sanitizeCallbacks(v: unknown): Record<GlutCallbackKind, string> {
  const out: Record<GlutCallbackKind, string> = { ...DEFAULT_CALLBACKS };
  if (!isRecord(v)) return out;
  CALLBACK_KINDS.forEach((k) => {
    const raw = v[k];
    out[k] = typeof raw === 'string' ? raw : '';
  });
  return out;
}
export function buildProjectFile(state: VamsState & { uploadedTextures: TextureAsset[] }): VamsProjectFile {
  const data: VamsProjectData = {
    objects: state.objects,
    viewportLimits: state.viewportLimits,
    axisVisibility: state.axisVisibility,
    showCoordinateTracker: state.showCoordinateTracker,
    learningSettings: state.learningSettings,
    theme: state.theme,
    canvasBackgroundColor: state.canvasBackgroundColor,
    selectedObjectId: state.selectedObjectId,
    interactionMode: state.interactionMode,
    selectedVertexId: state.selectedVertexId,
    pendingShapeType: state.pendingShapeType,
    pendingVertices: state.pendingVertices,
    pendingMinVertices: state.pendingMinVertices,
    pendingVertexStride: state.pendingVertexStride,
    callbacks: state.callbacks,
    uploadedTextures: state.uploadedTextures,
  };
  return {
    app: 'VAMS',
    schemaVersion: VAMS_PROJECT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}
export function createDefaultProjectFilename(prefix = 'vams-project'): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(
    d.getMinutes()
  )}-${pad(d.getSeconds())}`;
  return `${prefix}-${stamp}.vams`;
}
export function downloadJSON(filename: string, payload: unknown) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
export async function parseProjectFromFile(file: File): Promise<VamsProjectData> {
  return new Promise((resolve, reject) => {
    const workerCode = `
      self.onmessage = async function(e) {
        try {
          const file = e.data;
          const text = await file.text();
          const parsed = JSON.parse(text);
          self.postMessage({ success: true, data: parsed });
        } catch (err) {
          self.postMessage({ success: false, error: err.message });
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    worker.onmessage = (e) => {
      URL.revokeObjectURL(workerUrl);
      worker.terminate();
      if (e.data.success) {
        setTimeout(() => {
          try {
            let rawData = e.data.data;
            if (rawData && typeof rawData === 'object' && 'data' in rawData) {
              rawData = rawData.data;
            }
            resolve(sanitizeProjectData(rawData));
          } catch (err) {
            reject(err);
          }
        }, 0);
      } else {
        reject(new Error(e.data.error));
      }
    };
    worker.onerror = (err) => {
      URL.revokeObjectURL(workerUrl);
      worker.terminate();
      reject(err);
    };
    worker.postMessage(file);
  });
}
export function sanitizeProjectData(raw: unknown): VamsProjectData {
  if (!isRecord(raw)) return { ...DEFAULT_DATA };
  const objectsRaw = Array.isArray(raw.objects) ? raw.objects : [];
  const objects = fixHierarchy(
    objectsRaw.map((o, i) => sanitizeObject(o, i)).filter((o): o is SceneNode => o !== null)
  );
  const viewportLimits = sanitizeViewport(raw.viewportLimits);
  const axisVisibility = sanitizeAxis(raw.axisVisibility);
  const learningSettings = sanitizeLearning(raw.learningSettings);
  const pendingShapeType = toPrimitiveType(raw.pendingShapeType);
  const pendingVertices = Array.isArray(raw.pendingVertices)
    ? raw.pendingVertices
        .filter(isRecord)
        .map((v) => ({ x: toNumber(v.x, 0), y: toNumber(v.y, 0) }))
    : [];
  const selectedObjectIdRaw = typeof raw.selectedObjectId === 'string' ? raw.selectedObjectId : null;
  const selectedObjectId =
    selectedObjectIdRaw && objects.some((o) => o.id === selectedObjectIdRaw) ? selectedObjectIdRaw : null;
  const pendingVertexStrideRaw = raw.pendingVertexStride;
  const pendingVertexStride =
    typeof pendingVertexStrideRaw === 'number' && Number.isFinite(pendingVertexStrideRaw) && pendingVertexStrideRaw > 0
      ? Math.floor(pendingVertexStrideRaw)
      : null;
  const uploadedTextures = Array.isArray(raw.uploadedTextures)
    ? raw.uploadedTextures
        .map(sanitizeTextureAsset)
        .filter((a): a is TextureAsset => a !== null)
    : [];
  return {
    objects,
    viewportLimits,
    axisVisibility,
    showCoordinateTracker: toBoolean(raw.showCoordinateTracker, DEFAULT_DATA.showCoordinateTracker),
    learningSettings,
    theme: toTheme(raw.theme),
    canvasBackgroundColor: toString(raw.canvasBackgroundColor, DEFAULT_DATA.canvasBackgroundColor),
    selectedObjectId,
    interactionMode: toInteractionMode(raw.interactionMode),
    selectedVertexId: typeof raw.selectedVertexId === 'string' ? raw.selectedVertexId : null,
    pendingShapeType,
    pendingVertices,
    pendingMinVertices: Math.max(1, Math.floor(toNumber(raw.pendingMinVertices, DEFAULT_DATA.pendingMinVertices))),
    pendingVertexStride,
    callbacks: sanitizeCallbacks(raw.callbacks),
    uploadedTextures,
  };
}
export function toStorePatchFromProject(data: VamsProjectData): Partial<VamsState> {
  return {
    objects: data.objects,
    viewportLimits: data.viewportLimits,
    axisVisibility: data.axisVisibility,
    showCoordinateTracker: data.showCoordinateTracker,
    learningSettings: data.learningSettings,
    theme: data.theme,
    canvasBackgroundColor: data.canvasBackgroundColor,
    selectedObjectId: data.selectedObjectId,
    interactionMode: data.interactionMode,
    selectedVertexId: data.selectedVertexId,
    pendingShapeType: data.pendingShapeType,
    pendingVertices: data.pendingVertices,
    pendingMinVertices: data.pendingMinVertices,
    pendingVertexStride: data.pendingVertexStride,
    callbacks: data.callbacks,
    uploadedTextures: data.uploadedTextures,
  };
}