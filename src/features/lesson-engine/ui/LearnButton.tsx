import { GraduationCap } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { Button } from '@/shared/ui/controls';

export default function LearnButton() {
  const setLearnOpen = useVamsStore((s) => s.setLearnOpen);
  return (
    <Button className="learn-trigger" data-tour-anchor="learn" icon={<GraduationCap />} aria-haspopup="dialog" title="Sections and lessons" onClick={() => setLearnOpen(true)}>
      Learn
    </Button>
  );
}
