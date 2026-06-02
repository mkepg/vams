import { useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { topicForSection } from '@/features/help/model/help-content';

/**
 * Top-bar trigger for the Help Center. Also registers the global ?/F1 hotkey so
 * Help is reachable from any screen. Both entry points deep-link to the topic
 * for the current curriculum section.
 */
export default function HelpButton() {
  const openHelp = useVamsStore((state) => state.openHelp);
  const isHelpOpen = useVamsStore((state) => state.isHelpOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isHelpOpen) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;
      if (isTyping) return;

      const isHelpKey = event.key === 'F1' || (event.key === '?' && !event.ctrlKey && !event.metaKey);
      if (isHelpKey) {
        event.preventDefault();
        const { activeSection } = useVamsStore.getState();
        openHelp(topicForSection(activeSection));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHelpOpen, openHelp]);

  const handleClick = () => {
    const { activeSection } = useVamsStore.getState();
    openHelp(topicForSection(activeSection));
  };

  return (
    <button
      className="icon-btn"
      onClick={handleClick}
      title="Help (?)"
      aria-label="Open Help Center"
      aria-haspopup="dialog"
      type="button"
    >
      <HelpCircle size={16} />
    </button>
  );
}
