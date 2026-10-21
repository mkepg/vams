import './canvas-pane.scss';
import { useVamsStore } from '@/core/store';
import { showsIllustration } from '@/core/store/illustration';
import { useCanvasSize } from '@/shared/lib/use-canvas-size';
import CanvasHeader from './ui/CanvasHeader';
import ProgramWindow from './ui/ProgramWindow';
import VamsCanvas from './VamsCanvas';
import PipelineDiagram from './views/PipelineDiagram';
import QuizFigure from './views/QuizFigure';
import RasterVectorView from './views/RasterVectorView';

/** The canvas column: a header like the side panels', and the program's window on a stage. */
export default function CanvasPane() {
  const illustration = useVamsStore((s) => (showsIllustration(s) ? s.pipelineMode : 'Playground'));
  // A "Which Stage?" question's picture wins over the chosen mode.
  const quizStage = useVamsStore((s) => (s.activeSection === 'Pipeline' ? s.quizPipelineStage : null));
  const size = useCanvasSize();
  const framed = quizStage === null && illustration === 'Playground';
  return (
    <div className="canvas-pane">
      <CanvasHeader />
      <div className={`canvas-stage${framed ? '' : ' canvas-stage--bare'}`}>
        {/* The canvas stays mounted under an illustration, as before, so PixiJS is not rebuilt.
            It hides by visibility, never display: none, so it keeps its size. */}
        <ProgramWindow size={size} away={!framed}>
          <VamsCanvas isHidden={!framed} />
        </ProgramWindow>
        {quizStage !== null && <QuizFigure stage={quizStage} />}
        {quizStage === null && illustration === 'Diagram' && <PipelineDiagram />}
        {quizStage === null && illustration === 'RasterVector' && <RasterVectorView />}
      </div>
    </div>
  );
}
