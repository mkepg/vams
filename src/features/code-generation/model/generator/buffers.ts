import type { SceneNode, Vertex } from '@/core/types/scene';
import type { UV } from '@/core/types/textures';
import { deduplicate, hasTexture } from '@/entities/scene/model/vertex-dedup';
import { sanitizeName, getGlPrimitive, rasterStateAfter, rasterStateBefore } from './utils';
function isPrimitive(o: SceneNode): boolean {
  return o.type !== 'GROUP' && o.type !== 'TEXT';
}
function bufferUsageMacro(o: SceneNode): string {
  switch (o.bufferUsage) {
    case 'DYNAMIC': return 'GL_DYNAMIC_DRAW';
    case 'STREAM':  return 'GL_STREAM_DRAW';
    case 'STATIC':
    default:        return 'GL_STATIC_DRAW';
  }
}
function effectiveVerts(o: SceneNode): Vertex[] {
  return deduplicate(o)?.uniqueVerts ?? o.vertices;
}
// UVs aligned to whatever effectiveVerts returns (deduped or raw).
function effectiveUvs(o: SceneNode): UV[] | null {
  if (!hasTexture(o)) return null;
  return deduplicate(o)?.uniqueUvs ?? o.uvs!;
}
function needsPerFrameUpdate(o: SceneNode): boolean {
  if (!isPrimitive(o)) return false;
  if (o.renderingMode !== 'VBO') return false;
  return o.bufferUsage === 'DYNAMIC' || o.bufferUsage === 'STREAM';
}
export function sceneNeedsBufferUpdates(allObjects: SceneNode[]): boolean {
  return allObjects.some(needsPerFrameUpdate);
}
export function generateBufferGlobals(allObjects: SceneNode[]): string {
  const arrays: string[] = [];
  const handles: string[] = [];
  for (const o of allObjects) {
    if (!isPrimitive(o)) continue;
    const mode = o.renderingMode ?? 'IMMEDIATE';
    if (mode === 'IMMEDIATE') continue;
    const safe = sanitizeName(o.name);
    const verts = effectiveVerts(o);
    if (verts.length === 0) continue;
    const posStr = verts.map(v => `${v.x.toFixed(4)}f, ${v.y.toFixed(4)}f`).join(', ');
    arrays.push(`GLfloat verts_${safe}[] = { ${posStr} };`);
    const colorStr = verts
      .map(v => {
        const r = (parseInt(v.color.slice(1, 3), 16) / 255).toFixed(2);
        const g = (parseInt(v.color.slice(3, 5), 16) / 255).toFixed(2);
        const b = (parseInt(v.color.slice(5, 7), 16) / 255).toFixed(2);
        return `${r}f, ${g}f, ${b}f`;
      })
      .join(', ');
    arrays.push(`GLfloat colors_${safe}[] = { ${colorStr} };`);
    const uvsForObj = effectiveUvs(o);
    if (uvsForObj) {
      const uvStr = uvsForObj
        .map((uv) => `${uv.u.toFixed(4)}f, ${uv.v.toFixed(4)}f`)
        .join(', ');
      arrays.push(`GLfloat uvs_${safe}[] = { ${uvStr} };`);
    }
    const dedup = deduplicate(o);
    if (dedup) {
      arrays.push(`GLuint indices_${safe}[] = { ${dedup.indices.join(', ')} };`);
    }
    if (mode === 'VBO') {
      handles.push(`GLuint vbo_${safe} = 0;`);
      handles.push(`GLuint cbo_${safe} = 0;`);
      if (uvsForObj) handles.push(`GLuint uvbo_${safe} = 0;`);
      if (dedup) handles.push(`GLuint ebo_${safe} = 0;`);
    }
  }
  if (arrays.length === 0 && handles.length === 0) return '';
  let out = `// --- Buffer Data ---\n`;
  if (arrays.length > 0) out += arrays.join('\n') + '\n';
  if (handles.length > 0) out += '\n// --- VBO Handles ---\n' + handles.join('\n') + '\n';
  return out + '\n';
}
export function generateInitBody(allObjects: SceneNode[]): string {
  const lines: string[] = [];
  for (const o of allObjects) {
    if (!isPrimitive(o)) continue;
    if (o.renderingMode !== 'VBO') continue;
    const verts = effectiveVerts(o);
    if (verts.length === 0) continue;
    const safe = sanitizeName(o.name);
    const usage = bufferUsageMacro(o);
    const dedup = deduplicate(o);
    lines.push(`    // ${o.name} — upload to GPU`);
    lines.push(`    glGenBuffers(1, &vbo_${safe});`);
    lines.push(`    glBindBuffer(GL_ARRAY_BUFFER, vbo_${safe});`);
    lines.push(`    glBufferData(GL_ARRAY_BUFFER, sizeof(verts_${safe}), verts_${safe}, ${usage});`);
    lines.push(`    glGenBuffers(1, &cbo_${safe});`);
    lines.push(`    glBindBuffer(GL_ARRAY_BUFFER, cbo_${safe});`);
    lines.push(`    glBufferData(GL_ARRAY_BUFFER, sizeof(colors_${safe}), colors_${safe}, ${usage});`);
    if (effectiveUvs(o)) {
      lines.push(`    glGenBuffers(1, &uvbo_${safe});`);
      lines.push(`    glBindBuffer(GL_ARRAY_BUFFER, uvbo_${safe});`);
      lines.push(`    glBufferData(GL_ARRAY_BUFFER, sizeof(uvs_${safe}), uvs_${safe}, ${usage});`);
    }
    if (dedup) {
      lines.push(`    glGenBuffers(1, &ebo_${safe});`);
      lines.push(`    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo_${safe});`);
      lines.push(`    glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices_${safe}), indices_${safe}, ${usage});`);
    }
    lines.push('');
  }
  if (lines.length === 0) {
    return '    // No VBO primitives to initialise\n';
  }
  return lines.join('\n') + '\n' + unbindBuffers(lines);
}

/**
 * Unbinds what the lines above left bound. While a buffer is bound, glVertexPointer reads its
 * pointer as an offset into that buffer, so a client-side array drawn next would draw nothing.
 */
function unbindBuffers(lines: string[]): string {
  let out = '    // Unbind, so client-side arrays read from memory again\n';
  out += '    glBindBuffer(GL_ARRAY_BUFFER, 0);\n';
  if (lines.some((l) => l.includes('glBindBuffer(GL_ELEMENT_ARRAY_BUFFER'))) out += '    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0);\n';
  return out;
}
export function generateUpdateBuffersBody(allObjects: SceneNode[]): string {
  const lines: string[] = [];
  for (const o of allObjects) {
    if (!needsPerFrameUpdate(o)) continue;
    const safe = sanitizeName(o.name);
    if (effectiveVerts(o).length === 0) continue;
    if (o.bufferUsage === 'STREAM') {
      const usage = bufferUsageMacro(o);
      lines.push(`    // ${o.name} — re-upload every frame (GL_STREAM_DRAW)`);
      lines.push(`    glBindBuffer(GL_ARRAY_BUFFER, vbo_${safe});`);
      lines.push(`    // Regenerate your data here (e.g. particles, deforming mesh):`);
      lines.push(`    glBufferData(GL_ARRAY_BUFFER, sizeof(verts_${safe}), verts_${safe}, ${usage});`);
      lines.push('');
      continue;
    }
    // DYNAMIC: branch on updateMethod
    const method = o.updateMethod ?? 'BUFFER_SUB_DATA';
    if (method === 'MAP_BUFFER') {
      lines.push(`    // ${o.name} — update via mapped pointer (DYNAMIC)`);
      lines.push(`    glBindBuffer(GL_ARRAY_BUFFER, vbo_${safe});`);
      lines.push(`    {`);
      lines.push(`        GLfloat* ptr = (GLfloat*)glMapBuffer(GL_ARRAY_BUFFER, GL_WRITE_ONLY);`);
      lines.push(`        if (ptr != NULL) {`);
      lines.push(`            // Edit individual cells in place — no full re-upload:`);
      lines.push(`            // ptr[0] = newX0;`);
      lines.push(`            // ptr[1] = newY0;`);
      lines.push(`            glUnmapBuffer(GL_ARRAY_BUFFER);`);
      lines.push(`        }`);
      lines.push(`    }`);
      lines.push('');
    } else {
      lines.push(`    // ${o.name} — push updated bytes to the GPU (DYNAMIC)`);
      lines.push(`    glBindBuffer(GL_ARRAY_BUFFER, vbo_${safe});`);
      lines.push(`    // Modify verts_${safe}[...] above, then push the changed range:`);
      lines.push(`    glBufferSubData(GL_ARRAY_BUFFER, 0, sizeof(verts_${safe}), verts_${safe});`);
      lines.push('');
    }
  }
  if (lines.length === 0) {
    // The function was emitted but had nothing to do. This shouldn't normally
    return '    // No DYNAMIC or STREAM buffers to refresh\n';
  }
  return lines.join('\n') + '\n' + unbindBuffers(lines);
}
function transformPrelude(o: SceneNode): string {
  const safe = sanitizeName(o.name);
  let out = '';
  out += `    // ${o.name}\n`;
  out += `    glPushMatrix();\n`;
  out += `    glTranslatef(state_${safe}.x, state_${safe}.y, 0.0f);\n`;
  out += `    glRotatef(state_${safe}.rotation, 0.0f, 0.0f, 1.0f);\n`;
  out += `    glScalef(state_${safe}.scaleX, state_${safe}.scaleY, 1.0f);\n`;
  return out;
}
function shadingLine(o: SceneNode): string {
  return `    glShadeModel(${o.shading === 'FLAT' ? 'GL_FLAT' : 'GL_SMOOTH'});\n`;
}
export function generateVertexArrayDrawBody(o: SceneNode, recolor = false): string {
  const safe = sanitizeName(o.name);
  const verts = effectiveVerts(o);
  const dedup = deduplicate(o);
  const textured = hasTexture(o);
  const prim = getGlPrimitive(o.type as Exclude<SceneNode['type'], 'GROUP' | 'TEXT'>);
  let out = transformPrelude(o);
  out += shadingLine(o);
  out += rasterStateBefore(o);
  out += `\n    // Bind client-side arrays\n`;
  out += `    glEnableClientState(GL_VERTEX_ARRAY);\n`;
  out += recolor
    ? `    if (state_${safe}.useColor) glColor3f(state_${safe}.r, state_${safe}.g, state_${safe}.b);\n    else glEnableClientState(GL_COLOR_ARRAY);\n`
    : `    glEnableClientState(GL_COLOR_ARRAY);\n`;
  if (textured) {
    out += `    glEnableClientState(GL_TEXTURE_COORD_ARRAY);\n`;
    out += `    glEnable(GL_TEXTURE_2D);\n`;
    out += `    glBindTexture(GL_TEXTURE_2D, tex_${safe});\n`;
  }
  out += `    glVertexPointer(2, GL_FLOAT, 0, verts_${safe});\n`;
  out += `    glColorPointer(3, GL_FLOAT, 0, colors_${safe});\n`;
  if (textured) {
    out += `    glTexCoordPointer(2, GL_FLOAT, 0, uvs_${safe});\n`;
  }
  out += `\n`;
  if (dedup) {
    out += `    glDrawElements(${prim}, ${dedup.indices.length}, GL_UNSIGNED_INT, indices_${safe});\n`;
  } else {
    out += `    glDrawArrays(${prim}, 0, ${verts.length});\n`;
  }
  if (textured) {
    out += `\n    glDisableClientState(GL_TEXTURE_COORD_ARRAY);\n`;
    out += `    glDisable(GL_TEXTURE_2D);\n`;
    out += `    glDisableClientState(GL_COLOR_ARRAY);\n`;
  } else {
    out += `\n    glDisableClientState(GL_COLOR_ARRAY);\n`;
  }
  out += `    glDisableClientState(GL_VERTEX_ARRAY);\n`;
  out += rasterStateAfter(o);
  out += `    glPopMatrix();\n`;
  return out;
}
export function generateVBODrawBody(o: SceneNode, recolor = false): string {
  const safe = sanitizeName(o.name);
  const verts = effectiveVerts(o);
  const dedup = deduplicate(o);
  const textured = hasTexture(o);
  const prim = getGlPrimitive(o.type as Exclude<SceneNode['type'], 'GROUP' | 'TEXT'>);
  let out = transformPrelude(o);
  out += shadingLine(o);
  out += rasterStateBefore(o);
  out += `\n    // Bind GPU buffers\n`;
  out += `    glEnableClientState(GL_VERTEX_ARRAY);\n`;
  out += recolor
    ? `    if (state_${safe}.useColor) glColor3f(state_${safe}.r, state_${safe}.g, state_${safe}.b);\n    else glEnableClientState(GL_COLOR_ARRAY);\n`
    : `    glEnableClientState(GL_COLOR_ARRAY);\n`;
  if (textured) {
    out += `    glEnableClientState(GL_TEXTURE_COORD_ARRAY);\n`;
    out += `    glEnable(GL_TEXTURE_2D);\n`;
    out += `    glBindTexture(GL_TEXTURE_2D, tex_${safe});\n`;
  }
  out += `\n    glBindBuffer(GL_ARRAY_BUFFER, vbo_${safe});\n`;
  out += `    glVertexPointer(2, GL_FLOAT, 0, 0);\n\n`;
  out += `    glBindBuffer(GL_ARRAY_BUFFER, cbo_${safe});\n`;
  out += `    glColorPointer(3, GL_FLOAT, 0, 0);\n`;
  if (textured) {
    out += `\n    glBindBuffer(GL_ARRAY_BUFFER, uvbo_${safe});\n`;
    out += `    glTexCoordPointer(2, GL_FLOAT, 0, 0);\n`;
  }
  out += `\n`;
  if (dedup) {
    out += `    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo_${safe});\n`;
    out += `    glDrawElements(${prim}, ${dedup.indices.length}, GL_UNSIGNED_INT, 0);\n`;
  } else {
    out += `    glDrawArrays(${prim}, 0, ${verts.length});\n`;
  }
  out += `\n    glBindBuffer(GL_ARRAY_BUFFER, 0);\n`;
  if (dedup) out += `    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0);\n`;
  if (textured) {
    out += `    glDisableClientState(GL_TEXTURE_COORD_ARRAY);\n`;
    out += `    glDisable(GL_TEXTURE_2D);\n`;
  }
  out += `    glDisableClientState(GL_COLOR_ARRAY);\n`;
  out += `    glDisableClientState(GL_VERTEX_ARRAY);\n`;
  out += rasterStateAfter(o);
  out += `    glPopMatrix();\n`;
  return out;
}