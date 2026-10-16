import './canvas-window.scss';
import type { ComponentChildren } from 'preact';
import { PROGRAM_WINDOW_TITLE } from '@/shared/lib/program-window';

interface CanvasWindowProps {
  size: { width: number; height: number };
  running: boolean;
  children: ComponentChildren;
}

/** The program's window: a quiet title bar with what glutCreateWindow and glutInitWindowSize set. */
export default function CanvasWindow({ size, running, children }: CanvasWindowProps) {
  return (
    <div className="canvas-window">
      <div className="canvas-window__bar">
        <span className="canvas-window__title">{PROGRAM_WINDOW_TITLE}</span>
        <span className="canvas-window__size">{`${size.width} × ${size.height}`}</span>
        {running && (
          <span className="canvas-window__running">
            <span className="canvas-window__dot" aria-hidden="true" />running
          </span>
        )}
      </div>
      <div className="canvas-window__body">{children}</div>
    </div>
  );
}
