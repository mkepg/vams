import { GraduationCap, type LucideIcon } from 'lucide-react';

export interface NavLink {
  href: string;
  label: string;
  icon?: LucideIcon;
}

/** Only finished pages appear here. Add a link together with its route in ROUTES. */
export const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/learn', label: 'Learn', icon: GraduationCap },
  { href: '/about', label: 'About' },
];
