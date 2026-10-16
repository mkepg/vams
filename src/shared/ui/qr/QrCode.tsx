import { useMemo } from 'react';
import './qr-code.scss';
import { qrSvg } from '@/shared/lib/qr';

interface QrCodeProps {
  text: string;
  /** What the code opens, for screen readers. */
  label: string;
  size?: number;
  className?: string;
}

/** A QR code for `text`, drawn as SVG so it stays sharp at any size and prerenders. */
export default function QrCode({ text, label, size = 132, className }: QrCodeProps) {
  const svg = useMemo(() => qrSvg(text), [text]);
  return (
    <div
      className={`qr-code${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={label}
      style={{ width: `${size}px`, height: `${size}px` }}
      // The SVG is generated from our own text by qrSvg; it holds no markup from outside.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
