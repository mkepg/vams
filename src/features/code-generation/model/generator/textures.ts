import type { SceneNode } from '@/core/types/scene';
import type { TextureAsset } from '@/core/types/textures';
import { sanitizeName } from './utils';

const isTextureCandidate = (o: SceneNode) =>
  o.type !== 'GROUP' && o.type !== 'TEXT';

export function sceneNeedsTextures(allObjects: SceneNode[]): boolean {
  return allObjects.some(
    (o) =>
      isTextureCandidate(o) &&
      o.texture &&
      o.uvs &&
      o.uvs.length === o.vertices.length,
  );
}

export function generateTextureGlobals(allObjects: SceneNode[]): string {
  if (!sceneNeedsTextures(allObjects)) return '';

  const lines: string[] = [];
  lines.push('// --- Texture Handles ---');
  for (const o of allObjects) {
    if (!isTextureCandidate(o) || !o.texture) continue;
    lines.push(`GLuint tex_${sanitizeName(o.name)} = 0;`);
  }
  return lines.join('\n') + '\n\n';
}

function filterMacro(o: SceneNode): string {
  return o.texture?.filter === 'NEAREST' ? 'GL_NEAREST' : 'GL_LINEAR';
}

function wrapMacro(o: SceneNode): string {
  return o.texture?.wrap === 'CLAMP_TO_EDGE' ? 'GL_CLAMP_TO_EDGE' : 'GL_REPEAT';
}

export function generateTextureInitBody(
  allObjects: SceneNode[],
  textures: Map<string, TextureAsset>,
): string {
  if (!sceneNeedsTextures(allObjects)) return '';

  const lines: string[] = [];
  lines.push('    // --- Texture setup ---');
  // Texturing is switched on around each textured shape only. Left on here, every untextured
  // shape drawn before the first textured one would be painted with the bound image.
  // Texture replaces the fragment color outright instead of modulating it
  // with the per-vertex color. Without this, smooth-shaded vertex colors
  // (e.g. red/green/blue corners on a textured quad) bleed across the
  // sampled image, which doesn't match how the VAMS canvas renders
  // textured meshes (PixiJS samples the texture without vertex tinting).
  lines.push('    glTexEnvi(GL_TEXTURE_ENV, GL_TEXTURE_ENV_MODE, GL_REPLACE);');
  lines.push('');
  lines.push('    // OpenGL expects the 0.0 Y-coordinate to be at the bottom, but images store it at the top');
  lines.push('    stbi_set_flip_vertically_on_load(true);');

  for (const o of allObjects) {
    if (!isTextureCandidate(o) || !o.texture) continue;
    const safe = sanitizeName(o.name);
    const asset = textures.get(o.texture.textureId);
    const filter = filterMacro(o);
    const wrap = wrapMacro(o);
    const fileHint = asset ? `${asset.name}.png` : 'image.png';

    lines.push('');
    lines.push(`    // ${o.name} — texture object`);
    lines.push(`    glGenTextures(1, &tex_${safe});`);
    lines.push(`    glBindTexture(GL_TEXTURE_2D, tex_${safe});`);
    lines.push(`    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, ${wrap});`);
    lines.push(`    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, ${wrap});`);
    lines.push(`    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, ${filter});`);
    lines.push(`    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, ${filter});`);
    
    // Scoped block to prevent variable redefinition errors if there are multiple textures
    lines.push(`    {`);
    lines.push(`        int width, height, channels;`);
    lines.push(`        // IMPORTANT: Replace the placeholder below with the FULL ABSOLUTE FILE PATH to your image.`);
    lines.push(`        // Using a relative path may fail if the working directory differs when running the executable.`);
    lines.push(`        unsigned char* data = stbi_load("C:\\\\path\\\\to\\\\your\\\\${fileHint}", &width, &height, &channels, 4);`);
    lines.push(`        if (data) {`);
    lines.push(`            glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);`);
    lines.push(`            stbi_image_free(data);`);
    lines.push(`        }`);
    lines.push(`    }`);
  }

  lines.push('');
  return lines.join('\n');
}