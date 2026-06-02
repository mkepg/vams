import { Sun, Moon } from 'lucide-react';
import { useVamsStore } from '@/core/store';

export default function ThemeToggleButton() {
  const theme = useVamsStore((state) => state.theme);
  const toggleTheme = useVamsStore((state) => state.toggleTheme);

  return (
    <button
      className="icon-btn"
      onClick={toggleTheme}
      title="Toggle Theme"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
