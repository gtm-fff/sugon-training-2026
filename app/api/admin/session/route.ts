import { isAdmin } from '../../../../lib/admin';
import { json } from '../../../../lib/data';

export async function GET(request: Request) {
  return (await isAdmin(request)) ? json({ authenticated: true }) : json({ authenticated: false }, 401);
}
