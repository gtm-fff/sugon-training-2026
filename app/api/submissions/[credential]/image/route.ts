import { env } from 'cloudflare:workers';
import { ensureSchema, normalizeCode, sha256, SubmissionRow } from '../../../../../lib/data';

type Context = { params: Promise<{ credential: string }> };

export async function GET(_: Request, context: Context) {
  await ensureSchema();
  const { credential } = await context.params;
  const hash = await sha256(normalizeCode(credential));
  const row = await env.DB.prepare('SELECT * FROM submissions WHERE credential_hash = ?').bind(hash).first<SubmissionRow>();
  if (!row) return new Response('Not found', { status: 404 });
  const object = await env.FILES.get(row.image_key);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('cache-control', 'private, max-age=60');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
}
