import type { TextureAsset } from '@/core/types/textures';

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB ceiling per upload

/** Reads an uploaded image into a texture asset, or rejects with a message for a toast. */
export function readImageFile(file: File): Promise<TextureAsset> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_BYTES) {
      reject(new Error('Image is too large (max 4 MB).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        resolve({
          id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          dataUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = () => reject(new Error('Could not decode that image.'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}
