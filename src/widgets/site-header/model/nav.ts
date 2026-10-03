export interface NavLink {
  href: string;
  label: string;
}

/** Only finished pages appear here. Add a link together with its route in ROUTES. */
export const NAV_LINKS: NavLink[] = [];
