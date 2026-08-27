export type ApiRoute =
  | { name: 'gallery' | 'gallery-like' | 'submissions' | 'admin-login' | 'admin-logout' | 'admin-session' | 'admin-submissions' | 'admin-export' | 'admin-company-admins' | 'admin-song' }
  | { name: 'gallery-media' | 'gallery-thumbnail' | 'gallery-song' | 'submission' | 'submission-media' | 'admin-submission' | 'admin-submission-media' | 'admin-company-admin-reset'; value: string };

export function matchRoute(pathname: string): ApiRoute | null {
  const parts = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const path = parts.join('/');
  if (path === 'gallery') return { name: 'gallery' };
  if (path === 'gallery/like') return { name: 'gallery-like' };
  if (path === 'submissions') return { name: 'submissions' };
  if (path === 'admin/login') return { name: 'admin-login' };
  if (path === 'admin/logout') return { name: 'admin-logout' };
  if (path === 'admin/session') return { name: 'admin-session' };
  if (path === 'admin/submissions') return { name: 'admin-submissions' };
  if (path === 'admin/export') return { name: 'admin-export' };
  if (path === 'admin/company-admins') return { name: 'admin-company-admins' };
  if (path === 'admin/song') return { name: 'admin-song' };
  if (parts[0] === 'gallery' && parts[2] === 'media' && parts.length === 3) return { name: 'gallery-media', value: parts[1] };
  if (parts[0] === 'gallery' && parts[2] === 'thumbnail' && parts.length === 3) return { name: 'gallery-thumbnail', value: parts[1] };
  if (parts[0] === 'gallery' && parts[2] === 'song' && parts.length === 3) return { name: 'gallery-song', value: parts[1] };
  if (parts[0] === 'submissions' && parts[2] === 'image' && parts.length === 3) return { name: 'submission-media', value: parts[1] };
  if (parts[0] === 'submissions' && parts.length === 2) return { name: 'submission', value: parts[1] };
  if (parts[0] === 'admin' && parts[1] === 'submissions' && parts[3] === 'image' && parts.length === 4) return { name: 'admin-submission-media', value: parts[2] };
  if (parts[0] === 'admin' && parts[1] === 'submissions' && parts.length === 3) return { name: 'admin-submission', value: parts[2] };
  if (parts[0] === 'admin' && parts[1] === 'company-admins' && parts[3] === 'reset' && parts.length === 4) return { name: 'admin-company-admin-reset', value: parts[2] };
  return null;
}
