import { env } from 'cloudflare:workers';
import { ensureSchema, SubmissionRow } from '../../../../../lib/data';

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  await ensureSchema();
  const { id } = await context.params;
  const row = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first<SubmissionRow>();
  if (!row) return new Response('Not found', { status: 404 });
  const object = await env.FILES.get(row.image_key);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('cache-control', 'public, max-age=300');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
}
