import { Sun, Moon } from 'lucide-react';
import { toggleTheme, useSiteTheme } from '@/shared/lib/theme';

export default function ThemeToggleButton({ className = 'icon-btn' }: { className?: string }) {
  const theme = useSiteTheme();
  const isBlueprint = theme === 'blueprint';
  return (
    <button
      type="button"
      className={className}
      onClick={() => toggleTheme()}
      title={isBlueprint ? 'Switch to the light theme' : 'Switch to the dark theme'}
      aria-label={isBlueprint ? 'Switch to the light theme' : 'Switch to the dark theme'}
    >
      {isBlueprint ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
    </button>
  );
}
