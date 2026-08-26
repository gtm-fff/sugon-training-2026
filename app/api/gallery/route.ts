import { env } from 'cloudflare:workers';
import { ensureSchema, json, SubmissionRow } from '../../../lib/data';

export async function GET() {
  await ensureSchema();
  const result = await env.DB.prepare('SELECT * FROM submissions ORDER BY created_at DESC').all<SubmissionRow>();
  return json({ items: result.results.map((row) => ({
    id: row.id,
    company: row.company,
    title: row.title,
    description: row.description,
    mediaType: row.image_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) });
}
