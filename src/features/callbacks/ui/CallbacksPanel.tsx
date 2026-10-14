import './callbacks-panel.scss';
import { CALLBACK_DEFS } from '../model/rule-copy';
import { CallbackRow } from './CallbackRow';

/** The six GLUT callbacks in table order, each with its switch, handler name, GLUT call and rules. */
export default function CallbacksPanel() {
  return (
    <div className="callbacks-panel" data-panel-id="callbacks-panel">
      <ul className="cb-list">
        {CALLBACK_DEFS.map((def) => <CallbackRow key={def.kind} def={def} />)}
      </ul>
    </div>
  );
}
