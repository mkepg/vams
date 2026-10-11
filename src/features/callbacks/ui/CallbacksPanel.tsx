import './callbacks-panel.scss';
import { Info, Plug } from 'lucide-react';
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { CALLBACK_DEFS, CALLBACKS_NOTE } from '../model/rule-copy';
import { CallbackRow } from './CallbackRow';

export default function CallbacksPanel() {
  return (
    <CollapsibleSection panelId="callbacks-panel" title="Callbacks" icon={<Plug size={14} />} defaultOpen={false}>
      <div className="callbacks-panel">
        <div className="cb-info" role="note">
          <Info size={13} className="cb-info-icon" aria-hidden />
          <p>{CALLBACKS_NOTE}</p>
        </div>
        <ul className="cb-list">
          {CALLBACK_DEFS.map((def) => <CallbackRow key={def.kind} def={def} />)}
        </ul>
      </div>
    </CollapsibleSection>
  );
}
