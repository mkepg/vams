/**
 * A software rasteriser for the Lab's OpenGL 1.5: points, lines and polygons in window
 * coordinates, drawn into an RGBA8 framebuffer by the specification's rules (3.3 to 3.5), with
 * the multisample rules (4 samples a pixel) when the program asks for GLUT_MULTISAMPLE. Depth is
 * carried on vertices and not tested. GLContext puts the GL state machine in front of it.
 */
export { GL, GLContext, MAX_STACK_DEPTH, MAX_VIEWPORT_SIZE, type GLContextOptions, type Pointer } from './context';
export { MAX_LIST_NESTING } from './lists';
export { clearFramebuffer, createFramebuffer, type Framebuffer } from './framebuffer';
export type { Box, Scissor } from './clip';
export {
  defaultRasterState,
  type BlendFactor,
  type EnvMode,
  type Filter,
  type Face,
  type PolygonMode,
  type RasterState,
  type RGBA,
  type TextureBase,
  type TextureUnit,
  type WinVertex,
  type Wrap,
} from './fragment';
export { rasterPoint } from './points';
export { rasterLine } from './lines';
export { rasterPolygon, rasterTriangle } from './polygons';
