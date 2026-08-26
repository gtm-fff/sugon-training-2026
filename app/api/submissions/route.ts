import { env } from 'cloudflare:workers';
import {
  ALLOWED_MEDIA_TYPES,
  cleanText,
  ensureSchema,
  errorMessage,
  extensionFor,
  json,
  MAX_FILE_SIZE,
  publicSubmission,
  randomCredential,
  sha256,
  SubmissionRow,
  validCompany,
} from '../../../lib/data';

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const form = await request.formData();
    const company = cleanText(form.get('company'), 20);
    const title = cleanText(form.get('title'), 60);
    const description = cleanText(form.get('description'), 300);
    const image = form.get('image');

    if (!validCompany(company)) return json({ error: '请选择正确的连队' }, 400);
    if (!(image instanceof File) || image.size === 0) return json({ error: '请选择照片或视频' }, 400);
    if (image.size > MAX_FILE_SIZE) return json({ error: '文件超过 10MB' }, 413);
    if (!ALLOWED_MEDIA_TYPES.has(image.type)) return json({ error: '只支持 JPEG、PNG、WebP、MP4、MOV 或 WebM' }, 415);

    const id = crypto.randomUUID();
    const credential = randomCredential();
    const credentialHash = await sha256(credential);
    const now = new Date().toISOString();
    const imageKey = `submissions/${id}/${crypto.randomUUID()}.${extensionFor(image.type)}`;

    await env.FILES.put(imageKey, image.stream(), {
      httpMetadata: { contentType: image.type },
      customMetadata: { originalName: image.name.slice(0, 180) },
    });

    try {
      await env.DB.prepare(`INSERT INTO submissions (
          id, credential_hash, company, title, description,
          image_key, image_name, image_type, image_size, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
          id, credentialHash, company, title, description,
          imageKey, image.name.slice(0, 180), image.type, image.size, now, now,
        ).run();
    } catch (error) {
      await env.FILES.delete(imageKey);
      throw error;
    }

    const row = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first<SubmissionRow>();
    return json({ credential, submission: row ? publicSubmission(row) : undefined }, 201);
  } catch (error) {
    const message = errorMessage(error);
    return json({ error: message }, 500);
  }
}
