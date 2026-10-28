import type { SceneNode, Vertex } from '@/core/types/scene';
import { sanitizeName, hexToGlColor, hexToGlByteColor, getGlPrimitive, rasterStateAfter, rasterStateBefore } from './utils';
import { generateVertexArrayDrawBody, generateVBODrawBody } from './buffers';
import { effectiveScaleY, rasterLineYs, textLineStep, textLines } from '@/shared/lib/text-raster';
function emitColor(
  v: Vertex,
  colorMode: 'FLOAT' | 'BYTE' | undefined,
  indent = '        ',
  guard: string | null = null,
): string {
  const prefix = guard ? `if (!${guard}.useColor) ` : '';
  if (colorMode === 'BYTE') {
    return `${indent}${prefix}glColor3ub(${hexToGlByteColor(v.color)});\n`;
  }
  return `${indent}${prefix}glColor3f(${hexToGlColor(v.color)});\n`;
}
export interface DrawEffects {
  colorIds: ReadonlySet<string>;
  visibilityIds: ReadonlySet<string>;
}
export const NO_EFFECTS: DrawEffects = { colorIds: new Set(), visibilityIds: new Set() };
/** Window pixels per object unit along y for the default 800 × 600 window and a -1..1 volume. */
export const DEFAULT_PIXELS_PER_UNIT_Y = 300;
export const generateObjectDrawBody = (
  object: SceneNode,
  allObjects: SceneNode[],
  effects: DrawEffects = NO_EFFECTS,
  pixelsPerUnitY: number = DEFAULT_PIXELS_PER_UNIT_Y,
): string => {
  if (object.type === 'GROUP' || object.type === 'TEXT') {
    return generateImmediateDrawBody(object, allObjects, effects, pixelsPerUnitY);
  }
  const mode = object.renderingMode ?? 'IMMEDIATE';
  if (mode === 'VERTEX_ARRAY') return generateVertexArrayDrawBody(object, effects.colorIds.has(object.id));
  if (mode === 'VBO')          return generateVBODrawBody(object, effects.colorIds.has(object.id));
  return generateImmediateDrawBody(object, allObjects, effects, pixelsPerUnitY);
};
/** Indents every non-empty line of a draw block by one level. */
export const indentBlock = (block: string): string =>
  block.split('\n').map((line) => (line ? `    ${line}` : line)).join('\n');
const generateImmediateDrawBody = (
  object: SceneNode,
  allObjects: SceneNode[],
  effects: DrawEffects,
  pixelsPerUnitY: number,
): string => {
  let drawBody = '';
  const safeName = sanitizeName(object.name);
  const S = `state_${safeName}`;
  const recolor = effects.colorIds.has(object.id);
  drawBody += `    // ${object.name}\n`;
  drawBody += `    glPushMatrix();\n`;
  drawBody += `    // Transform\n`;
  drawBody += `    glTranslatef(state_${safeName}.x, state_${safeName}.y, 0.0f);\n`;
  drawBody += `    glRotatef(state_${safeName}.rotation, 0.0f, 0.0f, 1.0f);\n`;
  drawBody += `    glScalef(state_${safeName}.scaleX, state_${safeName}.scaleY, 1.0f);\n\n`;
  if (object.type === 'GROUP') {
    drawBody += `    // Children\n`;
    const children = allObjects.filter(o => o.parentId === object.id);
    [...children].reverse().forEach(child => {
      const childName = sanitizeName(child.name);
      const guarded = effects.visibilityIds.has(child.id);
      // Text and groups have no draw_ function of their own: their block goes inline, as in draw().
      if (child.type === 'GROUP' || child.type === 'TEXT') {
        const block = generateImmediateDrawBody(child, allObjects, effects, pixelsPerUnitY);
        drawBody += guarded ? `    if (state_${childName}.visible) {\n${indentBlock(block)}    }\n` : block;
        return;
      }
      drawBody += guarded
        ? `    if (state_${childName}.visible) draw_${childName}();\n`
        : `    draw_${childName}();\n`;
    });
  } else if (object.type === 'TEXT') {
    const textContent = object.textContent || '';
    // A carriage return would end the // comment early, so it goes; newlines are written as \n.
    const safeTextComment = textContent.replace(/\r/g, '').replace(/\n/g, '\\n');
    const colorHex = object.vertices[0]?.color || '#ffffff';
    const useByte = object.colorMode === 'BYTE';
    drawBody += `    // Text: "${safeTextComment}"\n`;
    const guardText = recolor ? `if (!${S}.useColor) ` : '';
    drawBody += useByte
      ? `    ${guardText}glColor3ub(${hexToGlByteColor(colorHex)});\n`
      : `    ${guardText}glColor3f(${hexToGlColor(colorHex)});\n`;
    if (recolor) drawBody += `    if (${S}.useColor) glColor3f(${S}.r, ${S}.g, ${S}.b);\n`;
    // Bitmap fonts only render printable glyphs; textLines strips the rest.
    const lines = textLines(textContent);
    // Lines start TEXT_LINE_PIXELS apart in the window, whatever the text's scale.
    const ys = rasterLineYs(lines.length, textLineStep(pixelsPerUnitY, effectiveScaleY(object, allObjects)));
    lines.forEach((line, index) => {
      const safeLine = line.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      drawBody += `    glRasterPos2f(0.0f, ${ys[index].toFixed(4)}f);\n`;
      drawBody += `    {\n`;
      drawBody += `        const char* textLine = "${safeLine}";\n`;
      drawBody += `        for (const char* c = textLine; *c != '\\0'; c++) {\n`;
      drawBody += `            glutBitmapCharacter(GLUT_BITMAP_9_BY_15, *c);\n`;
      drawBody += `        }\n`;
      drawBody += `    }\n`;
    });
  } else {
    drawBody += `    // Render\n`;
    drawBody += `    glShadeModel(${object.shading === 'FLAT' ? 'GL_FLAT' : 'GL_SMOOTH'});\n`;
    drawBody += rasterStateBefore(object);
    const hasTexture =
      object.texture &&
      object.uvs &&
      object.uvs.length === object.vertices.length;

    if (hasTexture) {
      drawBody += `    glEnable(GL_TEXTURE_2D);\n`;
      drawBody += `    glBindTexture(GL_TEXTURE_2D, tex_${safeName});\n`;
    }

    drawBody += `\n`;
    if (recolor) drawBody += `    if (${S}.useColor) glColor3f(${S}.r, ${S}.g, ${S}.b);\n`;
    drawBody += `    glBegin(${getGlPrimitive(object.type)});\n`;
    object.vertices.forEach((v, i) => {
      drawBody += emitColor(v, object.colorMode, '        ', recolor ? S : null);
      if (hasTexture) {
        const uv = object.uvs![i];
        drawBody += `        glTexCoord2f(${uv.u.toFixed(4)}f, ${uv.v.toFixed(4)}f);\n`;
      }
      drawBody += `        glVertex2f(${v.x.toFixed(4)}f, ${v.y.toFixed(4)}f);\n`;
    });
    drawBody += `    glEnd();\n`;

    if (hasTexture) {
      drawBody += `    glDisable(GL_TEXTURE_2D);\n`;
    }
    drawBody += rasterStateAfter(object);
  }
  drawBody += `    glPopMatrix();\n`;
  return drawBody;
};