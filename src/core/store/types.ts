import type { InspectorGroupId } from '@/core/inspector/groups';
import type { JourneyStageId } from '@/core/inspector/journey-stage';
import type {
  PrimitiveType,
  SceneNode,
  ShadingModel,
  TransformState,
  ViewportLimits,
  LearningSettings,
  InteractionMode,
  AxisVisibility,
  PendingVertex,
  ColorMode,
  LineStipple,
  CallbackRegistration,
  CallbacksState,
  CallbackRule,
  ResizeMode,
  RuleCallbackKind,
  GlutCallbackKind,
  RenderingMode,
  BufferUsage,
  BufferUpdateMethod,
} from '@/core/types/scene';

import type {
  TextureFilter,
  TextureWrap,
  UV,
} from '@/core/types/textures';

export interface SceneSlice {
  objects: SceneNode[];
  selectedObjectId: string | null;
  setSelection: (id: string | null) => void;
  selectObject: (id: string | null) => void;
  addCustomObject: (type: PrimitiveType, vertices: PendingVertex[]) => void;
  deleteObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  updateObjectName: (id: string, name: string) => void;
  toggleObjectVisibility: (id: string) => void;
  updateObjectTransform: (id: string, update: Partial<TransformState>) => void;
  updateVertexPosition: (objectId: string, vertexId: string, x: number, y: number) => void;
  updateVertexColor: (objectId: string, vertexId: string, color: string) => void;
  setAllVertexColors: (objectId: string, color: string) => void;
  updateObjectShading: (id: string, mode: ShadingModel) => void;
  addTextObject: (text: string, x: number, y: number) => void;
  updateTextContent: (id: string, text: string) => void;
  createGroup: (objectIds: string[]) => void;
  ungroup: (groupId: string) => void;
  deleteGroup: (groupId: string) => void;
  reorderObject: (sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  updateObjectColorMode: (id: string, mode: ColorMode) => void;
  updateLineWidth: (id: string, width: number) => void;
  updateLineStipple: (id: string, stipple: LineStipple | null) => void;
  updateRenderingMode: (id: string, mode: RenderingMode) => void;
  updateBufferUsage: (id: string, usage: BufferUsage) => void;
  updateUseIndexed: (id: string, useIndexed: boolean) => void;
  updateUpdateMethod: (id: string, method: BufferUpdateMethod) => void;
  
  // Stage 5 — texture/UV ops
  attachTexture: (objectId: string, textureId: string) => void;
  detachTexture: (objectId: string) => void;
  updateTextureFilter: (objectId: string, filter: TextureFilter) => void;
  updateTextureWrap: (objectId: string, wrap: TextureWrap) => void;
  updateUV: (objectId: string, vertexIndex: number, uv: UV) => void;
  resetUVsToDefault: (objectId: string) => void;
}
export interface InteractionSlice {
  interactionMode: InteractionMode;
  selectedVertexId: string | null;
  setInteractionMode: (mode: InteractionMode) => void;
  setSelectedVertex: (vertexId: string | null) => void;
}
export interface ViewportSlice {
  viewportLimits: ViewportLimits;
  axisVisibility: AxisVisibility;
  showCoordinateTracker: boolean;
  setViewportLimits: (limits: Partial<ViewportLimits>) => void;
  setAxisVisibility: (visibility: Partial<AxisVisibility>) => void;
  setShowCoordinateTracker: (show: boolean) => void;
}
export interface SettingsSlice {
  learningSettings: LearningSettings;
  theme: 'dark' | 'light';
  canvasBackgroundColor: string;
  updateLearningSettings: (settings: Partial<LearningSettings>) => void;
  toggleTheme: () => void;
  setCanvasBackgroundColor: (color: string) => void;
}
export interface CustomShapeBuilderSlice {
  pendingShapeType: PrimitiveType | null;
  pendingVertices: PendingVertex[];
  pendingMinVertices: number;
  pendingVertexStride: number | null;
  startCustomShape: (type: PrimitiveType, minVertices: number, stride?: number | null) => void;
  cancelCustomShape: () => void;
  addPendingVertex: (x: number, y: number) => void;
  addManualVertex: () => void;
  removeLastPendingVertex: () => void;
  removePendingVertexAt: (index: number) => void;
  updatePendingVertex: (index: number, x: number, y: number) => void;
}
export interface HistorySnapshot {
  objects: SceneNode[];
  selectedObjectId: string | null;
  interactionMode: InteractionMode;
  selectedVertexId: string | null;
  pendingShapeType: PrimitiveType | null;
  pendingVertices: PendingVertex[];
  pendingMinVertices: number;
  pendingVertexStride: number | null;
  callbacks: CallbacksState;
  timestamp: number;
}
export interface HistorySlice {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  maxHistorySize: number;
  isBatchMode: boolean;
  startBatch: () => void;
  endBatch: () => void;
  pushToHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
}
export type AppMode = 'Author' | 'Lesson';
export type CurriculumSection = 'Pipeline' | 'Primitives' | 'Buffers' | 'Transforms' | 'Textures';
export type PipelineMode = 'Diagram' | 'Playground' | 'RasterVector';
/** The panels the editor rail switches between. */
export type RailPanel = 'add' | 'scene' | 'settings' | 'callbacks';
/** What the right column shows. */
export type CodePane = 'code' | 'math';

export interface RuntimeSlice {
  appMode: AppMode;
  activeSection: CurriculumSection;
  pipelineMode: PipelineMode;
  activePipelineStage: number | null;
  cursorWorld: { x: number; y: number } | null;
  /** Inspector groups that are open. Session only. */
  openGroups: InspectorGroupId[];
  /** The group the student opened most recently; the math tab and help follow it. Session only. */
  lastOpenedGroup: InspectorGroupId | null;
  /** A journey stage opened by hand; cleared by the next lesson step or opened group. Session only. */
  journeyStageOverride: JourneyStageId | null;
  learnOpen: boolean;
  /** The panel the rail shows. Session only. */
  railPanel: RailPanel;
  /** The panel is tucked away (wide screens) or the drawer is closed (narrow screens). Session only. */
  railHidden: boolean;
  /** Code or Math in the right column. Session only. */
  codePane: CodePane;
  /** The right column is tucked away to its edge tab. Session only. */
  codeHidden: boolean;
  /** The generated code changed while Math was showing. Session only. */
  codeChangedUnseen: boolean;
  /** Code folds the student opened by hand; cleared when the selection changes. Session only. */
  codeFoldsOpened: string[];
  /** The code line the explanation strip explains. Session only. */
  explainedLine: number | null;
  /** The code panel's Notes switch. Starts on; session only. */
  codeNotes: boolean;
  /** The selected object's vertex the math journey follows, 0-based. Session only. */
  journeyVertex: number;
  toggleGroup: (id: InspectorGroupId) => void;
  openGroup: (id: InspectorGroupId) => void;
  setOpenGroups: (ids: readonly InspectorGroupId[]) => void;
  setJourneyStageOverride: (stage: JourneyStageId | null) => void;
  setLearnOpen: (open: boolean) => void;
  /** Shows a panel; also opens the panel if it was hidden. */
  setRailPanel: (panel: RailPanel) => void;
  setRailHidden: (hidden: boolean) => void;
  /** Add for an empty scene, otherwise Scene. Runs once the saved scene has loaded. */
  pickOpeningPanel: () => void;
  /** Shows Code or Math; showing Code clears the change dot. */
  setCodePane: (pane: CodePane) => void;
  setCodeHidden: (hidden: boolean) => void;
  /** Marks the code as changed while Math shows; does nothing while Code shows. */
  markCodeChanged: () => void;
  /** Opens a fold, or closes it if the student opened it. */
  toggleCodeFold: (block: string) => void;
  setExplainedLine: (line: number | null) => void;
  setCodeNotes: (on: boolean) => void;
  setJourneyVertex: (index: number) => void;
  setAppMode: (mode: AppMode) => void;
  setActiveSection: (section: CurriculumSection) => void;
  setPipelineMode: (mode: PipelineMode) => void;
  setActivePipelineStage: (stageIndex: number | null) => void;
  setCursorWorld: (pos: { x: number; y: number } | null) => void;
}
export interface LessonSlice {
  activeLessonId: string | null;
  currentStepIndex: number;
  exerciseAnswers: Record<string, unknown>;
  isSuccess: boolean;
  sceneBackup: SceneNode[] | null;
  callbacksBackup: CallbacksState | null;
  canvasBackgroundColorBackup: string | null;
  viewportLimitsBackup: ViewportLimits | null;
  uploadedTexturesBackup: import('@/core/types/textures').TextureAsset[] | null;
  lessonFocusPanel: string | null;
  dmaDriverStep: number | null;
  changedCodeLines: number[]
  /** The student's Code / Math switch and Hide from before the lesson; restored when it ends. */
  codeViewBeforeLesson: { pane: CodePane; hidden: boolean } | null;
  setActiveLesson: (lessonId: string | null) => void;
  setCurrentStep: (index: number) => void;
  setExerciseAnswer: (stepId: string, answer: unknown) => void;
  setSuccessState: (success: boolean) => void;
  setLessonFocusPanel: (panelId: string | null) => void;
  setDmaDriverStep: (index: number | null) => void;
  clearLessonState: () => void;
  setChangedCodeLines: (lines: number[]) => void;
}
export interface CallbacksSlice {
  callbacks: CallbacksState;
  setCallbackHandler: (kind: GlutCallbackKind, handlerName: string) => void;
  clearCallback: (kind: GlutCallbackKind) => void;
  addCallbackRule: (kind: RuleCallbackKind, rule: CallbackRule) => void;
  updateCallbackRule: (
    kind: RuleCallbackKind,
    ruleId: string,
    patch: Partial<Pick<CallbackRule, 'objectId' | 'trigger' | 'action'>>,
    recordHistory?: boolean,
  ) => void;
  removeCallbackRule: (kind: RuleCallbackKind, ruleId: string) => void;
  setReshapeMode: (mode: ResizeMode) => void;
  getRegisteredCallbacks: () => CallbackRegistration[];
}
/** What a tour step's check compares against, captured when the step opens. */
export interface TourBaseline {
  /** The objects that existed when the Build step opened; a shape not in this list was built during the tour. */
  buildIds: string[];
  /** The object the Change step watches, and its Translate X when that step opened. */
  objectId: string | null;
  translateX: number | null;
}

/** The first-visit tour. Session-only: none of it is saved, so a reload ends the tour. */
export interface TourSlice {
  /** The open step, 0 to 5, or null when no tour runs. */
  tourStep: number | null;
  /** The rail panel shown before the tour, given back when it ends. */
  railBeforeTour: RailPanel | null;
  tourStepBaseline: TourBaseline | null;
  startTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  /** Ends the tour. The rail returns to its panel from before the tour unless `restoreRail` is false. */
  endTour: (options?: { restoreRail?: boolean }) => void;
}

export interface HelpSlice {
  isHelpOpen: boolean;
  /** Opaque topic id (a HelpTopicId from the help feature); null until resolved. */
  activeHelpTopicId: string | null;
  /** Back-stack of previously viewed topic ids within the Help Center. */
  helpHistory: string[];
  hasSeenWelcome: boolean;
  openHelp: (topicId?: string) => void;
  closeHelp: () => void;
  navigateHelp: (topicId: string) => void;
  helpBack: () => void;
  markWelcomeSeen: () => void;
}

export type { TextureSlice } from './texture-slice';

export type VamsState = SceneSlice &
  InteractionSlice &
  ViewportSlice &
  SettingsSlice &
  CustomShapeBuilderSlice &
  HistorySlice &
  RuntimeSlice &
  LessonSlice &
  CallbacksSlice &
  HelpSlice &
  TourSlice &
  import('./texture-slice').TextureSlice;