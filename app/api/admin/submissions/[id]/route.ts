import { env } from 'cloudflare:workers';
import { requireAdmin } from '../../../../../lib/admin';
import { ensureSchema, json, SubmissionRow, validCompany } from '../../../../../lib/data';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  await ensureSchema();
  const { id } = await context.params;
  const body = await request.json().catch(() => ({})) as { company?: string; title?: string; description?: string };
  const company = (body.company || '').trim();
  if (!validCompany(company)) return json({ error: '连队无效' }, 400);
  const title = (body.title || '').trim().slice(0, 60);
  const description = (body.description || '').trim().slice(0, 300);
  const updatedAt = new Date().toISOString();
  const result = await env.DB.prepare('UPDATE submissions SET company = ?, title = ?, description = ?, updated_at = ? WHERE id = ?')
    .bind(company, title, description, updatedAt, id).run();
  return result.meta.changes ? json({ ok: true, updatedAt }) : json({ error: '投稿不存在' }, 404);
}

export async function DELETE(request: Request, context: Context) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  await ensureSchema();
  const { id } = await context.params;
  const row = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first<SubmissionRow>();
  if (!row) return json({ error: '投稿不存在' }, 404);
  await env.DB.prepare('DELETE FROM submissions WHERE id = ?').bind(id).run();
  await env.FILES.delete(row.image_key);
  return json({ ok: true });
}
