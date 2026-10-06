import SceneCodePanel from '@/features/code-generation/ui/SceneCodePanel';
import MathPanel from '@/features/math-panel/ui/MathPanel';
import './code-math-column.scss';

/** The right column: generated code above, the math behind it below, each scrolling on its own. */
export default function CodeMathColumn() {
  return (
    <div className="code-math-column">
      <div className="code-math-column__code">
        <SceneCodePanel />
      </div>
      <div className="code-math-column__math">
        <MathPanel />
      </div>
    </div>
  );
}
