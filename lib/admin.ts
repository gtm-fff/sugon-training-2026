import type { AppEnv } from './data';

const COOKIE_NAME = 'training_admin';
const encoder = new TextEncoder();

export type AdminSession = { role: 'system' | 'company'; company: string; expires: number };

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function signature(env: AppEnv, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.SESSION_SECRET || 'local-demo-session-secret-change-me'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
}

function sameText(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function validAdminLogin(env: AppEnv, username: string, password: string) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) return false;
  return sameText(username, env.ADMIN_USERNAME) && sameText(password, env.ADMIN_PASSWORD);
}

export async function companyDefaultPassword(env: AppEnv, company: string) {
  return `SG26-${(await signature(env, `company-default:${company}`)).slice(0, 10)}`;
}

export async function companyPasswordHash(env: AppEnv, username: string, password: string) {
  return signature(env, `company-password:${username}:${password}`);
}

export async function validCompanyPassword(env: AppEnv, username: string, password: string, expected: string) {
  return sameText(await companyPasswordHash(env, username, password), expected);
}

export async function createAdminCookie(env: AppEnv, request: Request, role: AdminSession['role'] = 'system', company = '') {
  const payload = `${Date.now() + 8 * 60 * 60 * 1000}:${role}:${encodeURIComponent(company)}`;
  const token = `${payload}.${await signature(env, payload)}`;
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secure}`;
}

export function clearAdminCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function getCookie(request: Request) {
  const source = request.headers.get('cookie') || '';
  return source.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1) || '';
}

export async function isAdmin(env: AppEnv, request: Request) {
  return (await getAdminSession(env, request))?.role === 'system';
}

export async function getAdminSession(env: AppEnv, request: Request): Promise<AdminSession | null> {
  const [payload, providedSignature] = getCookie(request).split('.');
  if (!payload || !providedSignature || !sameText(providedSignature, await signature(env, payload))) return null;
  const [expires, role = 'system', company = ''] = payload.split(':');
  if (Number(expires) < Date.now() || !['system', 'company'].includes(role)) return null;
  return { role: role as AdminSession['role'], company: decodeURIComponent(company), expires: Number(expires) };
}

export async function requireAdmin(env: AppEnv, request: Request) {
  if (await getAdminSession(env, request)) return null;
  return Response.json({ error: '管理员登录已失效，请重新登录' }, { status: 401 });
}

export async function requireSystemAdmin(env: AppEnv, request: Request) {
  if (await isAdmin(env, request)) return null;
  return Response.json({ error: '仅系统管理员可执行此操作' }, { status: 403 });
}
