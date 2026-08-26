import { env } from 'cloudflare:workers';

const COOKIE_NAME = 'training_admin';
const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function signature(payload: string) {
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

export function validAdminLogin(username: string, password: string) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) return false;
  return sameText(username, env.ADMIN_USERNAME) && sameText(password, env.ADMIN_PASSWORD);
}

export async function createAdminCookie(request: Request) {
  const payload = `${Date.now() + 8 * 60 * 60 * 1000}`;
  const token = `${payload}.${await signature(payload)}`;
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

export async function isAdmin(request: Request) {
  const [expires, providedSignature] = getCookie(request).split('.');
  if (!expires || !providedSignature || Number(expires) < Date.now()) return false;
  return sameText(providedSignature, await signature(expires));
}

export async function requireAdmin(request: Request) {
  if (await isAdmin(request)) return null;
  return Response.json({ error: '管理员登录已失效，请重新登录' }, { status: 401 });
}
