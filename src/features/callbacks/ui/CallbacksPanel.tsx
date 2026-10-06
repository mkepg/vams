import './callbacks-panel.scss';
import {
  Keyboard, MousePointer, Maximize, Move, Activity, Plug, Info,
  type LucideIcon,
} from 'lucide-react';
import { useVamsStore } from '@/core/store';
import CollapsibleSection from '@/shared/ui/collapsible-section/CollapsibleSection';
import { Button, GlHint } from '@/shared/ui/controls';
import type { GlutCallbackKind } from '@/core/types/scene';

interface CallbackDef {
  kind: GlutCallbackKind;
  glutFn: string;
  label: string;
  description: string;
  defaultName: string;
  icon: LucideIcon;
}

const CALLBACKS: CallbackDef[] = [
  { kind: 'keyboard', glutFn: 'glutKeyboardFunc', label: 'Keyboard',  description: 'Fires on key press.',          defaultName: 'onKey',     icon: Keyboard },
  { kind: 'mouse',    glutFn: 'glutMouseFunc',    label: 'Mouse',     description: 'Fires on button down/up.',     defaultName: 'onMouse',   icon: MousePointer },
  { kind: 'motion',   glutFn: 'glutMotionFunc',   label: 'Motion',    description: 'Fires while dragging.',        defaultName: 'onMotion',  icon: Move },
  { kind: 'reshape',  glutFn: 'glutReshapeFunc',  label: 'Reshape',   description: 'Fires on window resize.',      defaultName: 'onReshape', icon: Maximize },
  { kind: 'idle',     glutFn: 'glutIdleFunc',     label: 'Idle',      description: 'Fires every frame when idle.', defaultName: 'onIdle',    icon: Activity },
];

// C++ identifier sanity: starts with a letter or underscore, then alphanumerics/underscore.
const VALID_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export default function CallbacksPanel() {
  const callbacks = useVamsStore((s) => s.callbacks);
  const setCallbackHandler = useVamsStore((s) => s.setCallbackHandler);
  const clearCallback = useVamsStore((s) => s.clearCallback);

  const handleNameChange = (kind: GlutCallbackKind, raw: string) => {
    setCallbackHandler(kind, raw);
  };

  const handleQuickRegister = (def: CallbackDef) => {
    const current = callbacks[def.kind];
    if (current && current.trim().length > 0) {
      clearCallback(def.kind);
    } else {
      setCallbackHandler(def.kind, def.defaultName);
    }
  };

  return (
    <CollapsibleSection panelId="callbacks-panel" title="Callbacks" icon={<Plug size={14} />} defaultOpen={false}>
      <div className="callbacks-panel">

        <div className="cb-info" role="note">
          <Info size={13} className="cb-info-icon" aria-hidden />
          <p>
            Registering a callback inserts the matching <code>glut*Func</code> call and an empty
            handler stub into your generated code. To actually run those handlers — react to keys,
            clicks, or window changes — compile the exported program and run it locally.
          </p>
        </div>

        <ul className="cb-list">
          {CALLBACKS.map((def) => {
            const Icon = def.icon;
            const value = callbacks[def.kind] ?? '';
            const isActive = value.trim().length > 0;
            const isInvalid = isActive && !VALID_NAME.test(value.trim());

            return (
              <li key={def.kind} className={`cb-item ${isActive ? 'active' : ''} ${isInvalid ? 'invalid' : ''}`}>
                <div className="cb-head">
                  <span className="cb-icon" aria-hidden="true"><Icon size={14} /></span>
                  <div className="cb-meta">
                    <span className="cb-label">{def.label}</span>
                    <span className="cb-desc">{def.description}</span>
                  </div>
                  <Button
                    variant="secondary"
                    className="cb-toggle"
                    onClick={() => handleQuickRegister(def)}
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
                  onChange={(e) => handleNameChange(def.kind, e.currentTarget.value)}
                  className="vfield-input cb-input"
                />

                {isInvalid && (
                  <div className="cb-error">Handler name must be a valid C++ identifier.</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </CollapsibleSection>
  );
}