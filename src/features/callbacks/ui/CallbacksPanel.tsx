import './callbacks-panel.scss';
import { Info, Play, Plug } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { Button } from '@/shared/ui/controls';
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { CALLBACK_DEFS, CALLBACKS_NOTE } from '../model/rule-copy';
import { CallbackRow } from './CallbackRow';
import { canRun, runController } from '../model/run-controller';
import { RUN_DISABLED_TITLE } from './RunOverlay';

export default function CallbacksPanel() {
  const runnable = useVamsStore((s) => canRun(s));
  return (
    <CollapsibleSection panelId="callbacks-panel" title="Callbacks" icon={<Plug size={14} />} defaultOpen={false}>
      <div className="callbacks-panel">
        <div className="cb-info" role="note">
          <Info size={13} className="cb-info-icon" aria-hidden />
          <p>{CALLBACKS_NOTE}</p>
          <Button
            variant="quiet"
            className="cb-try"
            icon={<Play />}
            disabled={!runnable}
            title={runnable ? undefined : RUN_DISABLED_TITLE}
            onClick={() => runController.start()}
          >
            Try it
          </Button>
        </div>
        <ul className="cb-list">
          {CALLBACK_DEFS.map((def) => <CallbackRow key={def.kind} def={def} />)}
        </ul>
      </div>
    </CollapsibleSection>
  );
}
