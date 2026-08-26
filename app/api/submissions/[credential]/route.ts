import { env } from 'cloudflare:workers';
import {
  ALLOWED_MEDIA_TYPES,
  cleanText,
  ensureSchema,
  errorMessage,
  extensionFor,
  json,
  MAX_FILE_SIZE,
  normalizeCode,
  publicSubmission,
  sha256,
  SubmissionRow,
  validCompany,
} from '../../../../lib/data';

type Context = { params: Promise<{ credential: string }> };

async function findSubmission(credential: string) {
  await ensureSchema();
  const hash = await sha256(normalizeCode(credential));
  return env.DB.prepare('SELECT * FROM submissions WHERE credential_hash = ?').bind(hash).first<SubmissionRow>();
}

export async function GET(_: Request, context: Context) {
  const { credential } = await context.params;
  const row = await findSubmission(credential);
  return row ? json(publicSubmission(row)) : json({ error: '上传码无效，没有找到投稿' }, 404);
}

export async function PUT(request: Request, context: Context) {
  try {
    const { credential } = await context.params;
    const row = await findSubmission(credential);
    if (!row) return json({ error: '上传码无效，没有找到投稿' }, 404);

    const form = await request.formData();
    const company = cleanText(form.get('company'), 20);
    const title = cleanText(form.get('title'), 60);
    const description = cleanText(form.get('description'), 300);
    const image = form.get('image');
    if (!validCompany(company)) return json({ error: '请选择正确的连队' }, 400);

    let imageKey = row.image_key;
    let imageName = row.image_name;
    let imageType = row.image_type;
    let imageSize = row.image_size;
    let newImageKey = '';

    if (image instanceof File && image.size > 0) {
      if (image.size > MAX_FILE_SIZE) return json({ error: '文件超过 10MB' }, 413);
      if (!ALLOWED_MEDIA_TYPES.has(image.type)) return json({ error: '只支持 JPEG、PNG、WebP、MP4、MOV 或 WebM' }, 415);
      newImageKey = `submissions/${row.id}/${crypto.randomUUID()}.${extensionFor(image.type)}`;
      await env.FILES.put(newImageKey, image.stream(), { httpMetadata: { contentType: image.type } });
      imageKey = newImageKey;
      imageName = image.name.slice(0, 180);
      imageType = image.type;
      imageSize = image.size;
    }

    const updatedAt = new Date().toISOString();
    try {
      await env.DB.prepare(`UPDATE submissions SET company = ?, title = ?, description = ?,
        image_key = ?, image_name = ?, image_type = ?, image_size = ?, updated_at = ? WHERE id = ?`)
        .bind(company, title, description, imageKey, imageName, imageType, imageSize, updatedAt, row.id).run();
    } catch (error) {
      if (newImageKey) await env.FILES.delete(newImageKey);
      throw error;
    }
    if (newImageKey) await env.FILES.delete(row.image_key);

    const updated = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(row.id).first<SubmissionRow>();
    return json(publicSubmission(updated!));
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
}
