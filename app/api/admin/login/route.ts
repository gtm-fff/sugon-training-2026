import { createAdminCookie, validAdminLogin } from '../../../../lib/admin';
import { json } from '../../../../lib/data';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { username?: string; password?: string };
  if (!validAdminLogin(body.username || '', body.password || '')) return json({ error: '账号或密码错误' }, 401);
  return json({ ok: true }, 200, { 'Set-Cookie': await createAdminCookie(request) });
}
