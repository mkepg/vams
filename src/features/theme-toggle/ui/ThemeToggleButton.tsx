import { Sun, Moon } from 'lucide-react';
import { toggleTheme, useSiteTheme } from '@/shared/lib/theme';

export default function ThemeToggleButton({ className = 'icon-btn' }: { className?: string }) {
  const theme = useSiteTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className={className}
      onClick={() => toggleTheme()}
      title={isDark ? 'Switch to the light theme' : 'Switch to the dark theme'}
      aria-label={isDark ? 'Switch to the light theme' : 'Switch to the dark theme'}
    >
      {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
    </button>
  );
}
