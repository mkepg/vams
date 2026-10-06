import { FilePlus } from 'lucide-react';
import { Button } from '@/shared/ui/controls';
import { useNewWorkspace } from '../model/useNewWorkspace';

interface NewWorkspaceButtonProps {
  /** Keeps the current scene in My scenes. A rejection cancels the reset. */
  beforeReset: () => Promise<unknown>;
}

export default function NewWorkspaceButton({ beforeReset }: NewWorkspaceButtonProps) {
  const newWorkspace = useNewWorkspace(beforeReset);
  return (
    <Button variant="quiet" iconOnly label="New workspace" icon={<FilePlus />} onClick={() => void newWorkspace()} />
  );
}
