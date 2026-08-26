import { env } from 'cloudflare:workers';
import { requireAdmin } from '../../../../lib/admin';
import { ensureSchema, json, SubmissionRow } from '../../../../lib/data';

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  await ensureSchema();
  const company = new URL(request.url).searchParams.get('company') || '';
  const query = company
    ? env.DB.prepare('SELECT * FROM submissions WHERE company = ? ORDER BY created_at DESC').bind(company)
    : env.DB.prepare('SELECT * FROM submissions ORDER BY created_at DESC');
  const result = await query.all<SubmissionRow>();
  return json({ submissions: result.results.map((row) => ({
    id: row.id,
    company: row.company,
    title: row.title,
    description: row.description,
    imageName: row.image_name,
    mediaType: row.image_type,
    imageSize: row.image_size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) });
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  await ensureSchema();
  const body = await request.json().catch(() => ({})) as { ids?: string[] };
  const ids = [...new Set((body.ids || []).filter((id) => typeof id === 'string'))].slice(0, 100);
  if (!ids.length) return json({ error: '请选择要删除的投稿' }, 400);

  const placeholders = ids.map(() => '?').join(',');
  const rows = await env.DB.prepare(`SELECT * FROM submissions WHERE id IN (${placeholders})`).bind(...ids).all<SubmissionRow>();
  const statements = rows.results.map((row) => env.DB.prepare('DELETE FROM submissions WHERE id = ?').bind(row.id));
  if (statements.length) await env.DB.batch(statements);
  await Promise.all(rows.results.map((row) => env.FILES.delete(row.image_key)));
  return json({ deleted: rows.results.length });
}
