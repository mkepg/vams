import { useVamsStore } from '@/core/store';
import type { CallbackRule, RuleAction, RuleActionType, RuleCallbackKind, SceneNode } from '@/core/types/scene';
import { Button, ColorField, NumberField, SegmentedControl, SelectField } from '@/shared/ui/controls';
import {
  ACTION_LABELS, availableActionTypes, defaultAction, eligibleTargets, targetOptions, triggerFromValue,
  triggerOptionLabel, triggerOptions, triggerValue,
} from '../model/rule-copy';

interface RuleFormProps {
  kind: RuleCallbackKind;
  rule: CallbackRule;
  objects: SceneNode[];
  onClose: () => void;
  /** After Delete has removed the rule. */
  onDeleted: () => void;
}

export function RuleForm({ kind, rule, objects, onClose, onDeleted }: RuleFormProps) {
  const update = useVamsStore((s) => s.updateCallbackRule);
  const remove = useVamsStore((s) => s.removeCallbackRule);
  const pushToHistory = useVamsStore((s) => s.pushToHistory);
  const targets = targetOptions(rule, objects);
  const live = (action: RuleAction) => update(kind, rule.id, { action }, false);
  const action = rule.action;

  const changeType = (type: RuleActionType) => {
    const choices = eligibleTargets(type, objects);
    const target = choices.find((o) => o.id === rule.objectId) ?? choices[0];
    if (!target) return;
    update(kind, rule.id, { action: defaultAction(type, kind, target), objectId: target.id });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  return (
    <div className="cb-rule-form" role="group" aria-label="Edit rule" onKeyDown={onKeyDown}>
      {kind !== 'motion' && kind !== 'idle' && (
        <SelectField
          label="When"
          value={triggerValue(rule.trigger)}
          options={triggerOptions(kind).map((t) => ({ value: triggerValue(t), label: triggerOptionLabel(t) }))}
          onChange={(value) => update(kind, rule.id, { trigger: triggerFromValue(kind, value) })}
        />
      )}
      <SelectField
        label="Do"
        value={action.type}
        options={availableActionTypes(kind, objects).map((type) => ({ value: type, label: ACTION_LABELS[type] }))}
        onChange={changeType}
      />
      <SelectField
        label="Object"
        value={rule.objectId}
        options={targets.map((o) => ({ value: o.id, label: o.name }))}
        onChange={(objectId) => update(kind, rule.id, { objectId })}
      />
      {action.type === 'translate' && (
        <div className="cb-rule-form__pair">
          <NumberField label="dx" tag="dx" value={action.dx} min={-10} max={10} step={0.01} precision={2}
            onBeginChange={pushToHistory} onChange={(dx) => live({ ...action, dx })} />
          <NumberField label="dy" tag="dy" value={action.dy} min={-10} max={10} step={0.01} precision={2}
            onBeginChange={pushToHistory} onChange={(dy) => live({ ...action, dy })} />
        </div>
      )}
      {action.type === 'rotate' && (
        <NumberField label="Degrees" tag="deg" value={action.degrees} min={-360} max={360} step={1} precision={0} unit="°"
          onBeginChange={pushToHistory} onChange={(degrees) => live({ ...action, degrees })} />
      )}
      {action.type === 'scale' && (
        <div className="cb-rule-form__pair">
          <NumberField label="sx" tag="sx" value={action.sx} min={0.1} max={10} step={0.01} precision={2}
            onBeginChange={pushToHistory} onChange={(sx) => live({ ...action, sx })} />
          <NumberField label="sy" tag="sy" value={action.sy} min={0.1} max={10} step={0.01} precision={2}
            onBeginChange={pushToHistory} onChange={(sy) => live({ ...action, sy })} />
        </div>
      )}
      {action.type === 'setColor' && (
        <ColorField label="Colour" value={action.color} glCall="glColor3f" showRecent={false}
          onBeginChange={pushToHistory} onChange={(color) => live({ type: 'setColor', color })} />
      )}
      {action.type === 'visibility' && (
        <SegmentedControl
          label="Visibility"
          value={action.mode}
          options={[{ value: 'show', label: 'Show' }, { value: 'hide', label: 'Hide' }, { value: 'toggle', label: 'Toggle' }]}
          onChange={(mode) => update(kind, rule.id, { action: { type: 'visibility', mode } })}
        />
      )}
      <div className="cb-rule-form__actions">
        <Button variant="quiet" onClick={() => { remove(kind, rule.id); onDeleted(); }}>Delete</Button>
        <Button variant="primary" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
