import type { TextureAsset } from '@/core/types/textures';

/** The sari-sari store's painted sign, 64 × 16 pixels. */
export const SIGN_TEXTURE: TextureAsset = {
  id: 'tex-sari-sari',
  name: 'Sari-sari sign',
  dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAQCAIAAAAphe5+AAAA/klEQVR4nGPks9JiGMqAhYGBgd9QlWFogo/nb4M8QCR4lPEPwpCbwQThwhnIgshqqKIXPyBBKcRoZBcgW4nsFKwuoEQvHkBCDOAKMOQQxVSMpp5IvcQDEnTCgxDORWYjuwlZPTxcSdJLPEAYtPPM3Z1n7uJR+ijjH0GbIAowlVGiFw2guZORz0oLUgpBRN1NlBkGN9iJ5M6P52+Tn/gGCWCh3IhH/XMhDLnCZPxsucJkNPUMVPQAJYkH7hSIW9G4mFKUON0d1Z3USUKP+ufCHYpHDdzdBBUTD6jgAbnCZGJCFC02GAZhHiBeCjlLUAgQxegQbsx9PH97oF1CPgAAUk+wXYmwZeoAAAAASUVORK5CYII=',
  width: 64,
  height: 16,
  isSample: false,
};

/** A 32 × 32 sky tile with clouds, drawn to repeat; its sky is the Pixel fox sample's background. */
export const CLOUD_TEXTURE: TextureAsset = {
  id: 'tex-clouds',
  name: 'Cloud tile',
  dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAuklEQVR4nGOsOPGagZaAiaamM4xaQARgwS/dbi4CZ1eefENNC5CNRhYh1RoWYoxGBu3mInA74Crx2MqIlg/wm44fYLUGkQ/azUUoMZ0Bh+OgFlBoNB5XQuPg5fe/DLQBLBBqwqX3DlKcVDHxwLPvWCzAlKAWYKKFochg1AKCYDSIKK0P8ABiilIyLWhHLW3w1xOkRXI77hIXlzhpPnhJeplImgUTcJeJuIoykuPgAIll4mhGIwiGfhABAFP0ORlb1FzJAAAAAElFTkSuQmCC',
  width: 32,
  height: 32,
  isSample: false,
};
