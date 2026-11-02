/**
 * A software rasteriser for the Lab's OpenGL 1.5: points, lines and polygons in window
 * coordinates, drawn into an RGBA8 framebuffer by the specification's rules (3.3 to 3.5), with
 * the multisample rules (4 samples a pixel) when the program asks for GLUT_MULTISAMPLE. Depth is
 * carried on vertices and not tested.
 */
export { clearFramebuffer, createFramebuffer, type Framebuffer } from './framebuffer';
export type { Box, Scissor } from './clip';
export {
  defaultRasterState,
  type BlendFactor,
  type EnvMode,
  type Face,
  type PolygonMode,
  type RasterState,
  type RGBA,
  type TextureUnit,
  type WinVertex,
  type Wrap,
} from './fragment';
export { rasterPoint } from './points';
export { rasterLine } from './lines';
export { rasterPolygon, rasterTriangle } from './polygons';
