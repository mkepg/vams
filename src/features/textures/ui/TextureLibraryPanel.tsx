import './textures-panels.scss';
import { useRef } from 'react';
import { Image as ImageIcon, Upload, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { Button } from '@/shared/ui/controls';
import type { TextureAsset } from '@/core/types/textures';

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB ceiling per upload

function readImageFile(file: File): Promise<TextureAsset> {
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

export default function TextureLibraryPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const getAllTextures = useVamsStore((s) => s.getAllTextures);
  const addUploadedTexture = useVamsStore((s) => s.addUploadedTexture);
  const removeUploadedTexture = useVamsStore((s) => s.removeUploadedTexture);
  const activeTextureId = useVamsStore((s) => s.activeTextureId);
  const setActiveTexture = useVamsStore((s) => s.setActiveTexture);

  // Subscribe to uploads so the list re-renders on add/remove.
  useVamsStore((s) => s.uploadedTextures);

  const textures = getAllTextures();
  const samples = textures.filter((t) => t.isSample);
  const uploads = textures.filter((t) => !t.isSample);

  const handleUpload = async (file: File) => {
    try {
      const asset = await readImageFile(file);
      addUploadedTexture(asset);
      toast.success(`Loaded "${asset.name}"`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleFileChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) await handleUpload(file);
  };

  return (
    <CollapsibleSection
      panelId="texture-library"
      title="Texture Library"
      icon={<ImageIcon size={14} />}
      defaultOpen={true}
    >
      <div className="tx-library">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <Button
          className="tx-upload-btn"
          icon={<Upload size={13} />}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Image
        </Button>

        <div className="tx-section-label">
          <Sparkles size={11} />
          <span>Samples</span>
        </div>
        <div className="tx-grid">
          {samples.map((t) => (
            <TextureCard
              key={t.id}
              asset={t}
              active={activeTextureId === t.id}
              onSelect={() => setActiveTexture(t.id)}
            />
          ))}
        </div>

        <div className="tx-section-label">
          <ImageIcon size={11} />
          <span>Uploaded</span>
          <span className="tx-count">{uploads.length}</span>
        </div>
        {uploads.length === 0 ? (
          <div className="tx-empty">
            Drop your own image here using <em>Upload Image</em> above.
          </div>
        ) : (
          <div className="tx-grid">
            {uploads.map((t) => (
              <TextureCard
                key={t.id}
                asset={t}
                active={activeTextureId === t.id}
                onSelect={() => setActiveTexture(t.id)}
                onDelete={() => {
                  removeUploadedTexture(t.id);
                  toast.info(`Removed "${t.name}"`);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

interface CardProps {
  asset: TextureAsset;
  active: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}

function TextureCard({ asset, active, onSelect, onDelete }: CardProps) {
  return (
    <div className={`tx-card ${active ? 'active' : ''}`}>
      <button
        type="button"
        className="tx-card-thumb"
        onClick={onSelect}
        title={`${asset.name} · ${asset.width}×${asset.height}`}
      >
        <img src={asset.dataUrl} alt={asset.name} />
      </button>
      <div className="tx-card-meta">
        <span className="tx-card-name" title={asset.name}>{asset.name}</span>
        {onDelete && (
          <Button
            variant="quiet"
            iconOnly
            label={`Remove ${asset.name}`}
            icon={<Trash2 size={13} />}
            className="tx-card-del"
            onClick={onDelete}
          />
        )}
      </div>
    </div>
  );
}
