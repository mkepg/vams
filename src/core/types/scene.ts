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
  | 'special'
  | 'mouse'
  | 'motion'
  | 'reshape'
  | 'idle';
/** The callbacks that hold rules. Reshape holds a resize choice instead. */
export type RuleCallbackKind = Exclude<GlutCallbackKind, 'reshape'>;
export interface CallbackRegistration {
  kind: GlutCallbackKind;
  handlerName: string;
}
export type SpecialKey = 'up' | 'down' | 'left' | 'right';
export type MouseButton = 'left' | 'middle' | 'right';
export type MouseState = 'down' | 'up';
export type RuleTrigger =
  | { kind: 'keyboard'; key: string } // a–z, 0–9 or ' '; letters stored lower case
  | { kind: 'special'; key: SpecialKey }
  | { kind: 'mouse'; button: MouseButton; state: MouseState }
  | { kind: 'motion' }
  | { kind: 'idle' };
export type RuleAction =
  | { type: 'translate'; dx: number; dy: number }
  | { type: 'rotate'; degrees: number }
  | { type: 'scale'; sx: number; sy: number }
  | { type: 'moveToPointer' }
  | { type: 'reset' }
  | { type: 'setColor'; color: string }
  | { type: 'visibility'; mode: 'show' | 'hide' | 'toggle' };
export type RuleActionType = RuleAction['type'];
export interface CallbackRule {
  id: string;
  objectId: string;
  trigger: RuleTrigger;
  action: RuleAction;
}
export type ResizeMode = 'keep' | 'stretch';
export interface RuleCallback {
  handlerName: string;
  rules: CallbackRule[];
}
export interface ReshapeCallback {
  handlerName: string;
  resize: ResizeMode;
}
export interface CallbacksState {
  keyboard: RuleCallback;
  special: RuleCallback;
  mouse: RuleCallback;
  motion: RuleCallback;
  reshape: ReshapeCallback;
  idle: RuleCallback;
}
export type RenderingMode = 'IMMEDIATE' | 'VERTEX_ARRAY' | 'VBO';
export type BufferUsage = 'STATIC' | 'DYNAMIC' | 'STREAM';
export type BufferUpdateMethod = 'BUFFER_SUB_DATA' | 'MAP_BUFFER';