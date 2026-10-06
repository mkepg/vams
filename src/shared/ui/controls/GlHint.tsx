import './gl-hint.scss';

export interface GlHintProps {
  /** The GL function exactly as the code generator emits it, e.g. `glTranslatef`. */
  call: string;
  /** Parameter names in place of values, e.g. `x, y, 0.0f`. Omit to show the bare name. */
  args?: string;
  className?: string;
}

/** Names the OpenGL call a control group drives. Visual only: the code panel carries the same text. */
export function GlHint({ call, args, className }: GlHintProps) {
  return (
    <p className={className ? `gl-hint ${className}` : 'gl-hint'} aria-hidden="true">
      <code>
        <span className="gl-hint__fn">{call}</span>
        {args !== undefined && `(${args})`}
      </code>
    </p>
  );
}
