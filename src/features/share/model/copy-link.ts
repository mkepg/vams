import { toast } from 'sonner';

/** Writes the link to the clipboard and says whether it worked. */
export function copyLink(url: string): Promise<void> {
  return navigator.clipboard.writeText(url).then(
    () => void toast.success('Link copied'),
    () => void toast.error('Couldn’t copy. Select the link and copy it.'),
  );
}
