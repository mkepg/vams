import { useVamsStore } from '@/core/store';
import VamsCanvas from './VamsCanvas';
import PipelineDiagram from './views/PipelineDiagram';
import RasterVectorView from './views/RasterVectorView';
import { showsIllustration } from './illustration';

/** The editor always shows the scene; the Pipeline illustrations belong to Pipeline lessons. */
export default function ViewportRouter() {
  const illustration = useVamsStore((s) => (showsIllustration(s) ? s.pipelineMode : 'Playground'));
  return (
    <>
      <VamsCanvas isHidden={illustration !== 'Playground'} />
      {illustration === 'Diagram' && <PipelineDiagram />}
      {illustration === 'RasterVector' && <RasterVectorView />}
    </>
  );
}
