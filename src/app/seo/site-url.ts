import { DEFAULT_SITE_URL } from '@/app/routes/route-meta';

export const SITE_URL: string =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.trim() || DEFAULT_SITE_URL;
