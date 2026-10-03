import './logo.scss';

type LogoVariant = 'mark' | 'full' | 'tagline';

interface LogoProps {
  variant?: LogoVariant;
  className?: string;
  /** Accessible name. */
  title?: string;
}

export function VertexMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="vams-logo__mark"
      width={size}
      height={Math.round(size * 0.9)}
      viewBox="0 0 40 36"
      aria-hidden="true"
      focusable="false"
    >
      <polygon className="vams-logo__fill" points="4,32 36,32 20,4" />
      <polygon className="vams-logo__stroke" points="4,32 36,32 20,4" />
      <circle className="vams-logo__vertex" cx="4" cy="32" r="3" />
      <circle className="vams-logo__vertex" cx="36" cy="32" r="3" />
      <circle className="vams-logo__vertex vams-logo__vertex--selected" cx="20" cy="4" r="3.6" />
    </svg>
  );
}

export default function Logo({ variant = 'full', className, title = 'VAMS' }: LogoProps) {
  const classes = ['vams-logo', `vams-logo--${variant}`, className].filter(Boolean).join(' ');
  return (
    <span className={classes} role="img" aria-label={title}>
      <VertexMark />
      {variant !== 'mark' && (
        <span className="vams-logo__text" aria-hidden="true">
          <span className="vams-logo__word">VAMS</span>
          {variant === 'tagline' && <span className="vams-logo__tagline">See the OpenGL</span>}
        </span>
      )}
    </span>
  );
}
