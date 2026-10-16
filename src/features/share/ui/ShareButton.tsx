import { Share2 } from 'lucide-react';
import { Button } from '@/shared/ui/controls';
import { useShareDialog } from '../model/dialog-store';

export default function ShareButton() {
  const show = useShareDialog((s) => s.show);
  return (
    <Button variant="primary" className="share-button" icon={<Share2 />} aria-haspopup="dialog" onClick={show}>
      Share
    </Button>
  );
}
