import './logo.scss';

interface LogoProps {
  className?: string;
  /** Accessible name. */
  title?: string;
  /** On light paper, set the wordmark on an ink plate (the bar's colour). Use it outside the ink bar. */
  plate?: boolean;
}

/** The pixel wordmark: "VAMS" set in Minecrafter. Size it with the parent's font-size. */
export default function Logo({ className, title = 'VAMS', plate = false }: LogoProps) {
  const classes = ['vams-logo', plate && 'vams-logo--plate', className].filter(Boolean).join(' ');
  return (
    <span className={classes} role="img" aria-label={title}>
      <span className="vams-logo__word" aria-hidden="true">VAMS</span>
    </span>
  );
}
