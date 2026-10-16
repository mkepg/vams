import type { SceneNode, ViewportLimits } from '@/core/types/scene';
import type { TextureAsset } from '@/core/types/textures';
import { PROGRAM_WINDOW_TITLE } from '@/shared/lib/program-window';
import { sanitizeName } from './generator/utils';
import { generateState } from './generator/state';
import { generateObjectDrawBody, type DrawEffects } from './generator/render';
import {
  generateHandlers,
  generateRegistrations,
  generateViewGlobals,
  generateWindowToWorld,
  type CallbackPlan,
} from './generator/handlers';
import {
  generateBufferGlobals,
  generateInitBody,
  generateUpdateBuffersBody,
  sceneNeedsBufferUpdates
} from './generator/buffers';
import {
  generateTextureGlobals,
  generateTextureInitBody,
  sceneNeedsTextures
} from './generator/textures';
export function generateAppOutput(
  rootObjects: SceneNode[],
  allObjects: SceneNode[],
  canvasBackgroundColor: string,
  canvasSize: { width: number; height: number },
  emptySceneComment: string,
  plan: CallbackPlan,
  viewportLimits?: ViewportLimits,
  textures: Map<string, TextureAsset> = new Map(),
): string {
  const limits = viewportLimits ?? { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  const effects: DrawEffects = { colorIds: plan.colorIds, visibilityIds: plan.visibilityIds };
  const hasTextures = sceneNeedsTextures(allObjects);
  const needsBufferUpdate = sceneNeedsBufferUpdates(allObjects);
  // GLEW must be included BEFORE freeglut.h so that VBO entry points
  // (glGenBuffers, glBindBuffer, glBufferData, glMapBuffer, ...) and the
  // GL_*_BUFFER / GL_*_DRAW constants are visible to the compiler.
  let code = `#include <GL/glew.h>\n#include <GL/freeglut.h>\n#include <cmath>\n`;
  if (hasTextures) {
    code += `#include <iostream>\n\n`;
    code += `// 1. Define the implementation macro BEFORE including the header\n`;
    code += `#define STB_IMAGE_IMPLEMENTATION\n`;
    code += `#include "stb_image.h"\n`;
  }
  code += `\n`;
  code += generateState(allObjects, { extended: plan.extendedState, resetIds: plan.resetIds });
  code += generateViewGlobals(plan, limits);
  code += generateBufferGlobals(allObjects);
  if (hasTextures) {
    code += generateTextureGlobals(allObjects);
  }
  allObjects.forEach((obj) => {
    if (obj.type !== 'GROUP' && obj.type !== 'TEXT') {
      code += `void draw_${sanitizeName(obj.name)}();\n`;
    }
  });
  if (needsBufferUpdate) {
    code += `void update_buffers();\n`;
  }
  code += `void init();\n\n`;
  allObjects.forEach((obj) => {
    if (obj.type !== 'GROUP' && obj.type !== 'TEXT') {
      code += `void draw_${sanitizeName(obj.name)}()\n{\n`;
      code += generateObjectDrawBody(obj, allObjects, effects);
      code += `}\n\n`;
    }
  });
  code += `void draw()\n{\n`;
  if (rootObjects.length === 0) {
    code += emptySceneComment;
  } else {
    [...rootObjects].reverse().forEach((obj) => {
      const name = sanitizeName(obj.name);
      const guarded = plan.visibilityIds.has(obj.id);
      if (obj.type === 'GROUP' || obj.type === 'TEXT') {
        const block = generateObjectDrawBody(obj, allObjects, effects);
        if (guarded) {
          const indented = block
            .split('\n')
            .map((line) => (line ? `    ${line}` : line))
            .join('\n');
          code += `    if (state_${name}.visible) {\n${indented}    }\n`;
        } else {
          code += block;
        }
      } else {
        code += guarded
          ? `    if (state_${name}.visible) draw_${name}();\n`
          : `    draw_${name}();\n`;
      }
    });
  }
  code += `}\n\n`;
  if (needsBufferUpdate) {
    code += `void update_buffers()\n{\n`;
    code += generateUpdateBuffersBody(allObjects);
    code += `}\n\n`;
  }
  code += `void display()\n{\n`;
  code += `    glClear(GL_COLOR_BUFFER_BIT);\n\n`;
  code += `    // 2D orthographic projection — see glOrtho editor in VAMS\n`;
  code += `    glMatrixMode(GL_PROJECTION);\n`;
  code += `    glLoadIdentity();\n`;
  if (plan.needsView) {
    code += `    glOrtho(viewMinX, viewMaxX, viewMinY, viewMaxY, -1.0, 1.0);\n\n`;
  } else if (viewportLimits) {
    const { minX, maxX, minY, maxY } = viewportLimits;
    code += `    glOrtho(${minX.toFixed(4)}, ${maxX.toFixed(4)}, ${minY.toFixed(4)}, ${maxY.toFixed(4)}, -1.0, 1.0);\n\n`;
  } else {
    code += `    glOrtho(-1.0000, 1.0000, -1.0000, 1.0000, -1.0, 1.0);\n\n`;
  }
  code += `    // Switch to the modelview stack for object transforms\n`;
  code += `    glMatrixMode(GL_MODELVIEW);\n`;
  code += `    glLoadIdentity();\n\n`;
  code += `    draw();\n`;
  code += `    glutSwapBuffers();\n`;
  code += `}\n\n`;
  code += generateWindowToWorld(plan);
  code += generateHandlers(plan, limits);
  code += `// One-time setup, called once before the main loop\n`;
  code += `void init()\n{\n`;
  const initBuffers = generateInitBody(allObjects);
  if (initBuffers.trim()) {
    code += initBuffers;
  } else {
    code += `    // No GPU buffers to upload\n`;
  }
  if (hasTextures) {
    code += generateTextureInitBody(allObjects, textures);
  }
  code += `}\n\n`;
  const idleCb = plan.registered.find((cb) => cb.kind === 'idle');
  const needsIdle = needsBufferUpdate || idleCb;
  if (needsIdle) {
    code += `// Internal VAMS wrapper: run per-frame animation and updates\n`;
    code += `void _vams_idle()\n{\n`;
    // Per-frame buffer work, then the student's idle handler, then a redraw request.
    if (needsBufferUpdate) code += `    update_buffers();\n`;
    if (idleCb) code += `    ${idleCb.handlerName}();\n`;
    // A registered handler's stub already calls glutPostRedisplay; otherwise
    // we must request the redraw ourselves so the motion is visible.
    if (!idleCb) code += `    glutPostRedisplay();\n`;
    code += `}\n\n`;
  }
  code += `int main(int argc, char** argv)\n{\n`;
  code += `    glutInit(&argc, argv);\n`;
  code += `    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB | GLUT_MULTISAMPLE);\n`;
  code += `    glutInitWindowSize(${canvasSize.width}, ${canvasSize.height});\n`;
  code += `    glutCreateWindow("${PROGRAM_WINDOW_TITLE}");\n\n`;
  // Resolve modern-GL entry points (VBOs, glMapBuffer, etc.) BEFORE init().
  // glewExperimental = GL_TRUE is required on some drivers / core profiles.
  code += `    glewExperimental = GL_TRUE;\n`;
  code += `    if (glewInit() != GLEW_OK) {\n`;
  code += `        return 1; // GLEW failed to load OpenGL extensions\n`;
  code += `    }\n\n`;
  const r = (parseInt(canvasBackgroundColor.slice(1, 3), 16) / 255).toFixed(2);
  const g = (parseInt(canvasBackgroundColor.slice(3, 5), 16) / 255).toFixed(2);
  const b = (parseInt(canvasBackgroundColor.slice(5, 7), 16) / 255).toFixed(2);
  code += `    glClearColor(${r}f, ${g}f, ${b}f, 1.0f);\n\n`;
  code += `    init();\n\n`;
  code += `    glutDisplayFunc(display);\n`;
  code += generateRegistrations(plan);
  if (needsIdle) {
    code += `    glutIdleFunc(_vams_idle);\n`;
  }
  code += `\n    glutMainLoop();\n`;
  code += `    return 0;\n`;
  code += `}\n`;
  return code;
}