import { LAB_ENABLED } from '@/shared/config/lab';
import './tool-switch.scss';

export type Tool = 'editor' | 'lab';

export const TOOLS: readonly { tool: Tool; href: string; label: string }[] = [
  { tool: 'editor', href: '/app', label: 'Editor' },
  { tool: 'lab', href: '/lab', label: 'Lab' },
];

interface ToolSwitchProps {
  /** The tool this top bar belongs to: its segment is raised, and pressing it does nothing. */
  current: Tool;
  /** Whether this build has the Lab; without it there is nothing to switch to. */
  labOn?: boolean;
}

/**
 * The editor and the Lab as one switch, the same in both top bars. Each opens with a full page
 * load: the Lab needs the server's isolation headers, and the editor goes back to a page without
 * them. Both keep their work in the browser, so switching loses nothing.
 */
export default function ToolSwitch({ current, labOn = LAB_ENABLED }: ToolSwitchProps) {
  if (!labOn) return null;
  return (
    <nav className="tool-switch" aria-label="Tools">
      {TOOLS.map(({ tool, href, label }) => (
        <a
          key={tool}
          className="tool-switch__link"
          href={href}
          target="_top"
          aria-current={tool === current ? 'page' : undefined}
          onClick={tool === current ? (event) => event.preventDefault() : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
