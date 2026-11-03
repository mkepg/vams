import { GraduationCap, type LucideIcon } from 'lucide-react';

export interface NavLink {
  href: string;
  label: string;
  icon?: LucideIcon;
  /** Opens with a full page load, so the server's headers reach the page; the router leaves it alone. */
  native?: boolean;
}

/** Only finished pages appear here. Add a link together with its route in ROUTES. */
export const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/learn', label: 'Learn', icon: GraduationCap },
  { href: '/gallery', label: 'Gallery' },
  { href: '/lab', label: 'Lab', native: true },
  { href: '/guide', label: 'Guide' },
  { href: '/about', label: 'About' },
];
