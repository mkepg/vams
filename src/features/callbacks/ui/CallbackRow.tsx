import {
  Activity, ArrowRightLeft, Keyboard, Maximize, MousePointer, Move, type LucideIcon,
} from 'lucide-react';
import { useVamsStore } from '@/core/store';
import type { GlutCallbackKind } from '@/core/types/scene';
import { isCallbackValid, isRegistered } from '@/core/callbacks/callbacks-model';
import { Button, GlHint, SegmentedControl } from '@/shared/ui/controls';
import { invalidNameMessage, type CallbackDef } from '../model/rule-copy';
import { RuleList } from './RuleList';

const ICONS: Record<GlutCallbackKind, LucideIcon> = {
  keyboard: Keyboard, special: ArrowRightLeft, mouse: MousePointer, motion: Move, reshape: Maximize, idle: Activity,
};

export function CallbackRow({ def }: { def: CallbackDef }) {
  const callbacks = useVamsStore((s) => s.callbacks);
  const setCallbackHandler = useVamsStore((s) => s.setCallbackHandler);
  const clearCallback = useVamsStore((s) => s.clearCallback);
  const setReshapeMode = useVamsStore((s) => s.setReshapeMode);
  const Icon = ICONS[def.kind];
  const value = callbacks[def.kind].handlerName;
  const isActive = isRegistered(callbacks[def.kind]);
  const isInvalid = isActive && !isCallbackValid(callbacks, def.kind);

  return (
    <li className={`cb-item ${isActive ? 'active' : ''} ${isInvalid ? 'invalid' : ''}`}>
      <div className="cb-head">
        <span className="cb-icon" aria-hidden="true"><Icon size={14} /></span>
        <div className="cb-meta">
          <span className="cb-label">{def.label}</span>
          <span className="cb-desc">{def.description}</span>
        </div>
        <Button
          variant="secondary"
          className="cb-toggle"
          onClick={() => (isActive ? clearCallback(def.kind) : setCallbackHandler(def.kind, def.defaultName))}
          aria-pressed={isActive}
          title={isActive ? 'Clear handler' : `Register with default name "${def.defaultName}"`}
        >
          <span className="cb-dot" aria-hidden="true" />
          <span>{isActive ? 'On' : 'Off'}</span>
        </Button>
      </div>
      <GlHint call={def.glutFn} args="handler" />
      <input
        type="text"
        value={value}
        placeholder={def.defaultName}
        spellcheck={false}
        autoCapitalize="off"
        aria-label={`${def.label} handler`}
        aria-invalid={isInvalid || undefined}
        onChange={(e) => setCallbackHandler(def.kind, e.currentTarget.value)}
        className="vfield-input cb-input"
      />
      {isInvalid && <div className="cb-error">{invalidNameMessage(def.defaultName)}</div>}
      {isActive && def.kind === 'reshape' && (
        <SegmentedControl
          label="Resize"
          value={callbacks.reshape.resize}
          options={[{ value: 'keep', label: 'Keep proportions' }, { value: 'stretch', label: 'Stretch' }]}
          onChange={setReshapeMode}
        />
      )}
      {isActive && def.kind !== 'reshape' && <RuleList kind={def.kind} label={def.label} />}
    </li>
  );
}
