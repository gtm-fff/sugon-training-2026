import { clearAdminCookie } from '../../../../lib/admin';
import { json } from '../../../../lib/data';

export async function POST() {
  return json({ ok: true }, 200, { 'Set-Cookie': clearAdminCookie() });
}
