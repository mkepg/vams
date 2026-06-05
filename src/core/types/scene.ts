import type { TextureAttachment, UV } from './textures';

export type PrimitiveType =
  | 'POINTS'
  | 'LINES'
  | 'LINE_STRIP'
  | 'LINE_LOOP'
  | 'TRIANGLES'
  | 'TRIANGLE_STRIP'
  | 'TRIANGLE_FAN'
  | 'QUADS'
  | 'QUAD_STRIP'
  | 'POLYGON';
export type SceneNodeType = PrimitiveType | 'TEXT' | 'GROUP';
export type ShadingModel = 'FLAT' | 'SMOOTH';
export type ColorMode = 'FLOAT' | 'BYTE';
export interface LineStipple {
  factor: number;
  pattern: number;
}
export interface ViewportLimits {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
export interface Vertex {
  id: string;
  x: number;
  y: number;
  color: string;
}
export interface TransformState {
  translateX: number;
  translateY: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
}
/**
 * A simple, single-object transform animation. A declarative property of a
 * scene object (like its transform), saved with the project and compiled into
 * a real GLUT idle callback. It is intentionally NOT a keyframe timeline — the
 * full timeline/easing/export system remains future work (Recommendation 6).
 */
export type AnimationMotion = 'rotate' | 'pulse' | 'slide' | 'orbit';
export interface ObjectAnimation {
  motion: AnimationMotion;
  speed: number;
}
export interface SceneNode {
  id: string;
  name: string;
  type: SceneNodeType;
  visible: boolean;
  shading: ShadingModel;
  vertices: Vertex[];
  transform: TransformState;
  textContent?: string;
  rasterPosition?: { x: number; y: number };
  parentId?: string | null;
  children?: string[];
  colorMode?: ColorMode;
  lineWidth?: number;
  lineStipple?: LineStipple | null;
  renderingMode?: RenderingMode;
  bufferUsage?: BufferUsage;
  useIndexed?: boolean;
  updateMethod?: BufferUpdateMethod;
  // --- Stage 5 additions ---
  /** Active texture attachment. `null` / undefined means no texture. */
  texture?: TextureAttachment | null;

  /** Per-vertex UV coordinates. One entry per vertex.
   *  Defaults to a unit-square mapping derived from the bounding box. */
  uvs?: UV[] | null;

  /** Saved single-object transform animation. `null`/undefined means none. */
  animation?: ObjectAnimation | null;
}
export interface LearningSettings {
  gridSnapping: boolean;
  snapIncrement: number;
}
export type InteractionMode =
  | 'SELECT'
  | 'VERTEX_PLACE'
  | 'VERTEX_EDIT';
export type AxisVisibility = {
  showGlobalAxes: boolean;
  showLocalAxes: boolean;
  showOriginMarker: boolean;
  showGridlines: boolean;
};
export interface ProjectExportOptions {
  includeCPP: boolean;
  includeJSON: boolean;
  includeScaffold: boolean;
}
export interface PendingVertex {
  x: number;
  y: number;
}
export type GlutCallbackKind =
  | 'keyboard'
  | 'mouse'
  | 'reshape'
  | 'motion'
  | 'idle';
export interface CallbackRegistration {
  kind: GlutCallbackKind;
  handlerName: string;
}
export type RenderingMode = 'IMMEDIATE' | 'VERTEX_ARRAY' | 'VBO';
export type BufferUsage = 'STATIC' | 'DYNAMIC' | 'STREAM';
export type BufferUpdateMethod = 'BUFFER_SUB_DATA' | 'MAP_BUFFER';