import { useEffect, useRef } from 'react';
import { runController, type Picture } from '../model/run-controller';

interface FramebufferCanvasProps {
  /** The program window's size, in its own pixels. */
  width: number;
  height: number;
  className?: string;
}

/** The program's frames, drawn as the page takes them from the shared framebuffer. */
export default function FramebufferCanvas({ width, height, className }: FramebufferCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = (picture: Picture) => {
      // A frame drawn before a reshape reaches the program keeps its own size until the next one.
      if (canvas.width !== picture.width) canvas.width = picture.width;
      if (canvas.height !== picture.height) canvas.height = picture.height;
      const context = canvas.getContext('2d');
      if (!context || typeof ImageData === 'undefined') return;
      context.putImageData(new ImageData(picture.pixels, picture.width, picture.height), 0, 0);
    };
    return runController.subscribeFrames(draw);
  }, []);

  return <canvas ref={ref} className={className} width={width} height={height} />;
}
