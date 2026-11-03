import { GraduationCap, type LucideIcon } from 'lucide-react';
import { LAB_ENABLED } from '@/shared/config/lab';

export interface NavLink {
  href: string;
  label: string;
  icon?: LucideIcon;
  /** Opens with a full page load, so the server's headers reach the page; the router leaves it alone. */
  native?: boolean;
}

/** Only finished pages appear here. Add a link together with its route in ROUTES. The Lab link appears when the Lab is on. */
export function navLinks(labOn: boolean): NavLink[] {
  return [
    { href: '/', label: 'Home' },
    { href: '/learn', label: 'Learn', icon: GraduationCap },
    { href: '/gallery', label: 'Gallery' },
    ...(labOn ? [{ href: '/lab', label: 'Lab', native: true }] : []),
    { href: '/guide', label: 'Guide' },
    { href: '/about', label: 'About' },
  ];
}

export const NAV_LINKS: NavLink[] = navLinks(LAB_ENABLED);
