import './logo.scss';

interface LogoProps {
  className?: string;
  /** Accessible name. */
  title?: string;
}

/** The pixel wordmark: "VAMS" set in Minecrafter. Size it with the parent's font-size. */
export default function Logo({ className, title = 'VAMS' }: LogoProps) {
  const classes = ['vams-logo', className].filter(Boolean).join(' ');
  return (
    <span className={classes} role="img" aria-label={title}>
      <span className="vams-logo__word" aria-hidden="true">VAMS</span>
    </span>
  );
}
