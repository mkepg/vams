import { useEffect, useRef, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import type { RuleCallbackKind } from '@/core/types/scene';
import { MAX_RULES, newRuleId } from '@/core/callbacks/callbacks-model';
import { Button } from '@/shared/ui/controls';
import { actionSentence, newRule, ruleLabel, triggerChip } from '../model/rule-copy';
import { RuleForm } from './RuleForm';

export function RuleList({ kind, label }: { kind: RuleCallbackKind; label: string }) {
  const rules = useVamsStore((s) => s.callbacks[kind].rules);
  const objects = useVamsStore((s) => s.objects);
  const addRule = useVamsStore((s) => s.addCallbackRule);
  const [openId, setOpenId] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const lines = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!pendingFocus.current) return;
    lines.current.get(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  }, [openId]);

  const names = new Map(objects.map((o) => [o.id, o.name]));
  const full = rules.length >= MAX_RULES;
  const empty = objects.length === 0;
  const close = (id: string) => { pendingFocus.current = id; setOpenId(null); };
  const onAdd = () => {
    const rule = newRule(kind, rules, objects, newRuleId());
    if (!rule) return;
    addRule(kind, rule);
    setOpenId(rule.id);
  };

  return (
    <div className="cb-rules">
      {rules.length > 0 && (
        <ul className="cb-rule-list" aria-label={`${label} rules`}>
          {rules.map((rule) => {
            const name = names.get(rule.objectId) ?? 'an object';
            const open = openId === rule.id;
            return (
              <li key={rule.id} className="cb-rule">
                <button
                  type="button"
                  ref={(el) => { if (el) lines.current.set(rule.id, el); else lines.current.delete(rule.id); }}
                  className={open ? 'cb-rule__line is-open' : 'cb-rule__line'}
                  aria-expanded={open}
                  aria-label={ruleLabel(rule, name)}
                  onClick={() => (open ? close(rule.id) : setOpenId(rule.id))}
                >
                  <span className="cb-rule__chip" aria-hidden="true">{triggerChip(rule.trigger)}</span>
                  <span className="cb-rule__text" aria-hidden="true">
                    {actionSentence(rule.action, name)}
                    {rule.action.type === 'setColor' && (
                      <span className="cb-rule__swatch" style={{ background: rule.action.color }} />
                    )}
                  </span>
                  <Pencil size={12} aria-hidden="true" />
                </button>
                {open && <RuleForm kind={kind} rule={rule} objects={objects} onClose={() => close(rule.id)} />}
              </li>
            );
          })}
        </ul>
      )}
      <Button variant="quiet" className="cb-add-rule" icon={<Plus />} disabled={full || empty} onClick={onAdd}>
        {full ? '8 rules is the limit' : empty ? 'Add a shape first' : 'Add rule'}
      </Button>
    </div>
  );
}
