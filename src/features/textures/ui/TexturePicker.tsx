import './textures-panels.scss';
import { useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { readImageFile } from '../lib/read-image-file';

/**
 * The image on the selected shape: None, the samples, the student's uploads and an Upload tile,
 * with the chosen image's name and size underneath.
 */
export default function TexturePicker() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selected = useVamsStore((s) => s.objects.find((o) => o.id === s.selectedObjectId));
  const getAllTextures = useVamsStore((s) => s.getAllTextures);
  const attachTexture = useVamsStore((s) => s.attachTexture);
  const detachTexture = useVamsStore((s) => s.detachTexture);
  const addUploadedTexture = useVamsStore((s) => s.addUploadedTexture);
  const removeUploadedTexture = useVamsStore((s) => s.removeUploadedTexture);
  const pushToHistory = useVamsStore((s) => s.pushToHistory);
  const startBatch = useVamsStore((s) => s.startBatch);
  const endBatch = useVamsStore((s) => s.endBatch);
  // Subscribe to uploads so the tiles re-render on add and remove.
  useVamsStore((s) => s.uploadedTextures);

  if (!selected) return null;
  const textures = getAllTextures();
  const attachedId = selected.texture?.textureId ?? null;
  const attached = attachedId ? textures.find((t) => t.id === attachedId) : undefined;

  // Uploading and attaching the new image is one undo step.
  const handleFileChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const asset = await readImageFile(file);
      pushToHistory();
      startBatch();
      addUploadedTexture(asset);
      attachTexture(selected.id, asset.id);
      endBatch();
      toast.success(`Loaded "${asset.name}"`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="tx-picker">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        hidden
      />
      <div className="tx-tiles" role="group" aria-label="Texture image">
        <button
          type="button"
          className="tx-tile tx-tile--none"
          aria-pressed={attachedId === null}
          onClick={() => attachedId !== null && detachTexture(selected.id)}
        >
          None
        </button>
        {textures.map((t) => (
          <div key={t.id} className="tx-tile-wrap">
            <button
              type="button"
              className="tx-tile"
              aria-pressed={attachedId === t.id}
              aria-label={t.name}
              title={`${t.name} · ${t.width} × ${t.height}`}
              onClick={() => attachedId !== t.id && attachTexture(selected.id, t.id)}
            >
              <img src={t.dataUrl} alt="" />
            </button>
            {!t.isSample && (
              <button
                type="button"
                className="tx-tile-remove"
                aria-label={`Remove ${t.name}`}
                title={`Remove ${t.name}`}
                onClick={() => {
                  removeUploadedTexture(t.id);
                  toast.info(`Removed "${t.name}"`);
                }}
              >
                <X size={11} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="tx-tile tx-tile--upload"
          aria-label="Upload an image"
          title="Upload an image (PNG, JPEG or WebP, up to 4 MB)"
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      <p className="tx-picker-name">
        {attached ? (
          <>
            <strong>{attached.name}</strong> · {attached.width} × {attached.height} · {attached.isSample ? 'sample' : 'uploaded'}
          </>
        ) : (
          <strong>None</strong>
        )}
      </p>
    </div>
  );
}
