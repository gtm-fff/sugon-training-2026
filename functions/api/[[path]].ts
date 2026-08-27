import { strToU8, zipSync } from 'fflate';
import {
  clearAdminCookie,
  createAdminCookie,
  isAdmin,
  requireAdmin,
  validAdminLogin,
} from '../../lib/admin';
import {
  ALLOWED_MEDIA_TYPES,
  type AppEnv,
  cleanText,
  ensureSchema,
  errorMessage,
  extensionFor,
  json,
  MAX_FILE_SIZE,
  normalizeCode,
  publicSubmission,
  randomCredential,
  sha256,
  type SubmissionRow,
  validCompany,
} from '../../lib/data';
import { matchRoute } from './router';

const MAX_THUMBNAIL_SIZE = 1024 * 1024;
const MAX_DISPLAY_IMAGE_SIZE = 2 * 1024 * 1024;
const VOTER_COOKIE = 'sugon_voter';

function notAllowed(...methods: string[]) {
  return new Response('Method not allowed', { status: 405, headers: { Allow: methods.join(', ') } });
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100) || 'image';
}

function voterId(request: Request) {
  const prefix = `${VOTER_COOKIE}=`;
  return request.headers.get('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith(prefix))?.slice(prefix.length, prefix.length + 100) || '';
}

function voterCookie(request: Request, value: string) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${VOTER_COOKIE}=${value}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}`;
}

function publicRows(rows: SubmissionRow[]) {
  return rows.map(publicSubmission);
}

async function findSubmission(env: AppEnv, credential: string) {
  await ensureSchema(env);
  const hash = await sha256(normalizeCode(credential));
  return env.DB.prepare('SELECT * FROM submissions WHERE credential_hash = ?').bind(hash).first<SubmissionRow>();
}

function thumbnailKey(imageKey: string) {
  return `${imageKey}.preview.webp`;
}

function displayKey(imageKey: string) {
  return `${imageKey}.display.webp`;
}

async function objectResponse(object: R2ObjectBody | null, cacheControl: string) {
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('cache-control', cacheControl);
  headers.set('x-content-type-options', 'nosniff');
  return new Response(object.body, { headers });
}

async function mediaResponse(env: AppEnv, row: SubmissionRow | null, cacheControl: string) {
  return objectResponse(row ? await env.FILES.get(row.image_key) : null, cacheControl);
}

async function displayResponse(env: AppEnv, row: SubmissionRow | null, cacheControl: string) {
  if (!row) return new Response('Not found', { status: 404 });
  if (!row.image_type.startsWith('image/')) return mediaResponse(env, row, cacheControl);
  const display = await env.FILES.get(displayKey(row.image_key));
  return objectResponse(display || await env.FILES.get(row.image_key), cacheControl);
}

async function thumbnailResponse(env: AppEnv, row: SubmissionRow | null) {
  if (!row || !row.image_type.startsWith('image/')) return new Response('Not found', { status: 404 });
  const preview = await env.FILES.get(thumbnailKey(row.image_key));
  return objectResponse(preview || await env.FILES.get(row.image_key), 'public, max-age=31536000, immutable');
}

async function deleteMedia(env: AppEnv, imageKey: string) {
  await Promise.all([
    env.FILES.delete(imageKey),
    env.FILES.delete(displayKey(imageKey)),
    env.FILES.delete(thumbnailKey(imageKey)),
  ]);
}

function validateImageVariants(image: File, display: File | null, thumbnail: File | null) {
  if (!image.type.startsWith('image/')) {
    return display || thumbnail ? json({ error: '视频不接受图片展示图或缩略图' }, 400) : null;
  }
  if (display && display.type !== 'image/webp') return json({ error: '展示图必须为 WebP' }, 415);
  if (display && display.size > MAX_DISPLAY_IMAGE_SIZE) return json({ error: '展示图超过 2MB' }, 413);
  if (thumbnail && thumbnail.type !== 'image/webp') return json({ error: '缩略图必须为 WebP' }, 415);
  if (thumbnail && thumbnail.size > MAX_THUMBNAIL_SIZE) return json({ error: '缩略图超过 1MB' }, 413);
  return null;
}

async function createSubmission(env: AppEnv, request: Request) {
  await ensureSchema(env);
  const form = await request.formData();
  const company = cleanText(form.get('company'), 20);
  const title = cleanText(form.get('title'), 60);
  const description = cleanText(form.get('description'), 300);
  const image = form.get('image');
  const displayValue = form.get('display');
  const display = displayValue instanceof File && displayValue.size > 0 ? displayValue : null;
  const thumbnailValue = form.get('thumbnail');
  const thumbnail = thumbnailValue instanceof File && thumbnailValue.size > 0 ? thumbnailValue : null;

  if (!validCompany(company)) return json({ error: '请选择正确的连队' }, 400);
  if (!(image instanceof File) || image.size === 0) return json({ error: '请选择照片或视频' }, 400);
  if (image.size > MAX_FILE_SIZE) return json({ error: '文件超过 25MB' }, 413);
  if (!ALLOWED_MEDIA_TYPES.has(image.type)) return json({ error: '只支持 JPEG、PNG、WebP、MP4、MOV 或 WebM' }, 415);
  const variantsError = validateImageVariants(image, display, thumbnail);
  if (variantsError) return variantsError;

  const id = crypto.randomUUID();
  const credential = randomCredential();
  const credentialHash = await sha256(credential);
  const now = new Date().toISOString();
  const imageKey = `submissions/${id}/${crypto.randomUUID()}.${extensionFor(image.type)}`;

  try {
    await Promise.all([
      env.FILES.put(imageKey, image.stream(), {
        httpMetadata: { contentType: image.type },
        customMetadata: { originalName: image.name.slice(0, 180) },
      }),
      display && env.FILES.put(displayKey(imageKey), display.stream(), { httpMetadata: { contentType: 'image/webp' } }),
      thumbnail && env.FILES.put(thumbnailKey(imageKey), thumbnail.stream(), { httpMetadata: { contentType: 'image/webp' } }),
    ]);
  } catch (error) {
    await deleteMedia(env, imageKey);
    throw error;
  }

  try {
    await env.DB.prepare(`INSERT INTO submissions (
      id, credential_hash, company, title, description,
      image_key, image_name, image_type, image_size, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      id, credentialHash, company, title, description,
      imageKey, image.name.slice(0, 180), image.type, image.size, now, now,
    ).run();
  } catch (error) {
    await deleteMedia(env, imageKey);
    throw error;
  }

  const row = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first<SubmissionRow>();
  return json({ credential, submission: row ? publicSubmission(row) : undefined }, 201);
}

async function updateSubmission(env: AppEnv, request: Request, credential: string) {
  const row = await findSubmission(env, credential);
  if (!row) return json({ error: '上传码无效，没有找到投稿' }, 404);

  const form = await request.formData();
  const company = cleanText(form.get('company'), 20);
  const title = cleanText(form.get('title'), 60);
  const description = cleanText(form.get('description'), 300);
  const image = form.get('image');
  const displayValue = form.get('display');
  const display = displayValue instanceof File && displayValue.size > 0 ? displayValue : null;
  const thumbnailValue = form.get('thumbnail');
  const thumbnail = thumbnailValue instanceof File && thumbnailValue.size > 0 ? thumbnailValue : null;
  if (!validCompany(company)) return json({ error: '请选择正确的连队' }, 400);
  if ((display || thumbnail) && (!(image instanceof File) || image.size === 0)) return json({ error: '展示图和缩略图必须和新原图一起上传' }, 400);

  let imageKey = row.image_key;
  let imageName = row.image_name;
  let imageType = row.image_type;
  let imageSize = row.image_size;
  let newImageKey = '';

  if (image instanceof File && image.size > 0) {
    if (image.size > MAX_FILE_SIZE) return json({ error: '文件超过 25MB' }, 413);
    if (!ALLOWED_MEDIA_TYPES.has(image.type)) return json({ error: '只支持 JPEG、PNG、WebP、MP4、MOV 或 WebM' }, 415);
    const variantsError = validateImageVariants(image, display, thumbnail);
    if (variantsError) return variantsError;
    newImageKey = `submissions/${row.id}/${crypto.randomUUID()}.${extensionFor(image.type)}`;
    try {
      await Promise.all([
        env.FILES.put(newImageKey, image.stream(), { httpMetadata: { contentType: image.type } }),
        display && env.FILES.put(displayKey(newImageKey), display.stream(), { httpMetadata: { contentType: 'image/webp' } }),
        thumbnail && env.FILES.put(thumbnailKey(newImageKey), thumbnail.stream(), { httpMetadata: { contentType: 'image/webp' } }),
      ]);
    } catch (error) {
      await deleteMedia(env, newImageKey);
      throw error;
    }
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
    if (newImageKey) await deleteMedia(env, newImageKey);
    throw error;
  }
  if (newImageKey) await deleteMedia(env, row.image_key);

  const updated = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(row.id).first<SubmissionRow>();
  return json(publicSubmission(updated!));
}

async function galleryPopularity(env: AppEnv, request: Request) {
  const counts = await env.DB.prepare('SELECT company, COUNT(*) AS likes FROM company_votes GROUP BY company').all<{ company: string; likes: number }>();
  const voter = voterId(request);
  const liked = voter
    ? (await env.DB.prepare('SELECT company FROM company_votes WHERE voter_hash = ?').bind(await sha256(voter)).all<{ company: string }>()).results.map((row) => row.company)
    : [];
  return {
    likes: Object.fromEntries(counts.results.map((row) => [row.company, row.likes])),
    likedCompanies: liked,
  };
}

async function likeCompany(env: AppEnv, request: Request) {
  await ensureSchema(env);
  const body = await request.json().catch(() => ({})) as { company?: string };
  const company = (body.company || '').trim();
  if (!validCompany(company)) return json({ error: '连队无效' }, 400);

  const existingVoter = voterId(request);
  const voter = existingVoter || crypto.randomUUID();
  const result = await env.DB.prepare('INSERT OR IGNORE INTO company_votes (company, voter_hash, created_at) VALUES (?, ?, ?)')
    .bind(company, await sha256(voter), new Date().toISOString()).run();
  const count = await env.DB.prepare('SELECT COUNT(*) AS likes FROM company_votes WHERE company = ?').bind(company).first<{ likes: number }>();
  return json(
    { company, likes: count?.likes || 0, liked: true, added: result.meta.changes > 0 },
    200,
    existingVoter ? undefined : { 'Set-Cookie': voterCookie(request, voter) },
  );
}

async function listAdminSubmissions(env: AppEnv, request: Request) {
  const denied = await requireAdmin(env, request);
  if (denied) return denied;
  await ensureSchema(env);
  const search = new URL(request.url).searchParams;
  const company = search.get('company') || '';
  const limit = Math.min(100, Math.max(1, Number(search.get('limit')) || 48));
  const offset = Math.max(0, Number(search.get('offset')) || 0);
  const query = company
    ? env.DB.prepare('SELECT * FROM submissions WHERE company = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(company, limit + 1, offset)
    : env.DB.prepare('SELECT * FROM submissions ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(limit + 1, offset);
  const result = await query.all<SubmissionRow>();
  const filteredTotal = company
    ? await env.DB.prepare('SELECT COUNT(*) AS total FROM submissions WHERE company = ?').bind(company).first<{ total: number }>()
    : await env.DB.prepare('SELECT COUNT(*) AS total FROM submissions').first<{ total: number }>();
  const stats = await env.DB.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(image_size), 0) AS usedSpace,
    COUNT(DISTINCT company) AS companyCount FROM submissions`).first<{ total: number; usedSpace: number; companyCount: number }>();
  return json({
    submissions: publicRows(result.results.slice(0, limit)),
    hasMore: result.results.length > limit,
    filteredTotal: filteredTotal?.total || 0,
    stats: stats || { total: 0, usedSpace: 0, companyCount: 0 },
  });
}

async function deleteAdminSubmissions(env: AppEnv, request: Request) {
  const denied = await requireAdmin(env, request);
  if (denied) return denied;
  await ensureSchema(env);
  const body = await request.json().catch(() => ({})) as { ids?: string[] };
  const ids = [...new Set((body.ids || []).filter((id) => typeof id === 'string'))].slice(0, 100);
  if (!ids.length) return json({ error: '请选择要删除的投稿' }, 400);

  const placeholders = ids.map(() => '?').join(',');
  const rows = await env.DB.prepare(`SELECT * FROM submissions WHERE id IN (${placeholders})`).bind(...ids).all<SubmissionRow>();
  const statements = rows.results.map((row) => env.DB.prepare('DELETE FROM submissions WHERE id = ?').bind(row.id));
  if (statements.length) await env.DB.batch(statements);
  await Promise.all(rows.results.map((row) => deleteMedia(env, row.image_key)));
  return json({ deleted: rows.results.length });
}

async function editAdminSubmission(env: AppEnv, request: Request, id: string) {
  const denied = await requireAdmin(env, request);
  if (denied) return denied;
  await ensureSchema(env);
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

async function deleteAdminSubmission(env: AppEnv, request: Request, id: string) {
  const denied = await requireAdmin(env, request);
  if (denied) return denied;
  await ensureSchema(env);
  const row = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first<SubmissionRow>();
  if (!row) return json({ error: '投稿不存在' }, 404);
  await env.DB.prepare('DELETE FROM submissions WHERE id = ?').bind(id).run();
  await deleteMedia(env, row.image_key);
  return json({ ok: true });
}

async function exportAdminSubmissions(env: AppEnv, request: Request) {
  const denied = await requireAdmin(env, request);
  if (denied) return denied;
  await ensureSchema(env);
  const company = new URL(request.url).searchParams.get('company') || '';
  const query = company
    ? env.DB.prepare('SELECT * FROM submissions WHERE company = ? ORDER BY created_at').bind(company)
    : env.DB.prepare('SELECT * FROM submissions ORDER BY company, created_at');
  const rows = (await query.all<SubmissionRow>()).results;

  const header = ['投稿ID', '连队', '标题', '说明', '素材文件名', '文件大小', '上传时间', '修改时间'];
  const csv = [header, ...rows.map((row) => [
    row.id, row.company, row.title, row.description,
    row.image_name, row.image_size, row.created_at, row.updated_at,
  ])].map((line) => line.map(csvCell).join(',')).join('\r\n');

  const files: Record<string, Uint8Array> = { '投稿清单.csv': strToU8(`\uFEFF${csv}`) };
  for (const row of rows) {
    const object = await env.FILES.get(row.image_key);
    if (object) files[`${safeName(row.company)}/${row.id}_${safeName(row.image_name)}`] = new Uint8Array(await object.arrayBuffer());
  }
  const archive = zipSync(files, { level: 0 });
  const name = `${company || '全部连队'}_集训素材.zip`;
  return new Response(archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      'cache-control': 'no-store',
    },
  });
}

export const onRequest: PagesFunction<AppEnv> = async ({ request, env }) => {
  try {
    const route = matchRoute(new URL(request.url).pathname);
    if (!route) return new Response('Not found', { status: 404 });

    switch (route.name) {
      case 'gallery': {
        if (request.method !== 'GET') return notAllowed('GET');
        await ensureSchema(env);
        const result = await env.DB.prepare('SELECT * FROM submissions ORDER BY created_at DESC').all<SubmissionRow>();
        const popularity = await galleryPopularity(env, request);
        return json({
          items: result.results.map((row) => ({
            id: row.id,
            company: row.company,
            title: row.title,
            description: row.description,
            mediaType: row.image_type,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          })),
          ...popularity,
        });
      }
      case 'gallery-like':
        return request.method === 'POST' ? likeCompany(env, request) : notAllowed('POST');
      case 'gallery-media': {
        if (request.method !== 'GET') return notAllowed('GET');
        await ensureSchema(env);
        const row = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(route.value).first<SubmissionRow>();
        return displayResponse(env, row, 'public, max-age=31536000, immutable');
      }
      case 'gallery-thumbnail': {
        if (request.method !== 'GET') return notAllowed('GET');
        await ensureSchema(env);
        const row = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(route.value).first<SubmissionRow>();
        return thumbnailResponse(env, row);
      }
      case 'submissions':
        return request.method === 'POST' ? createSubmission(env, request) : notAllowed('POST');
      case 'submission': {
        if (request.method === 'GET') {
          const row = await findSubmission(env, route.value);
          return row ? json(publicSubmission(row)) : json({ error: '上传码无效，没有找到投稿' }, 404);
        }
        return request.method === 'PUT' ? updateSubmission(env, request, route.value) : notAllowed('GET', 'PUT');
      }
      case 'submission-media': {
        if (request.method !== 'GET') return notAllowed('GET');
        return displayResponse(env, await findSubmission(env, route.value), 'private, max-age=60');
      }
      case 'admin-login': {
        if (request.method !== 'POST') return notAllowed('POST');
        const body = await request.json().catch(() => ({})) as { username?: string; password?: string };
        if (!validAdminLogin(env, body.username || '', body.password || '')) return json({ error: '账号或密码错误' }, 401);
        return json({ ok: true }, 200, { 'Set-Cookie': await createAdminCookie(env, request) });
      }
      case 'admin-logout':
        return request.method === 'POST' ? json({ ok: true }, 200, { 'Set-Cookie': clearAdminCookie() }) : notAllowed('POST');
      case 'admin-session': {
        if (request.method !== 'GET') return notAllowed('GET');
        return (await isAdmin(env, request)) ? json({ authenticated: true }) : json({ authenticated: false }, 401);
      }
      case 'admin-submissions':
        if (request.method === 'GET') return listAdminSubmissions(env, request);
        return request.method === 'DELETE' ? deleteAdminSubmissions(env, request) : notAllowed('GET', 'DELETE');
      case 'admin-submission':
        if (request.method === 'PATCH') return editAdminSubmission(env, request, route.value);
        return request.method === 'DELETE' ? deleteAdminSubmission(env, request, route.value) : notAllowed('PATCH', 'DELETE');
      case 'admin-submission-media': {
        if (request.method !== 'GET') return notAllowed('GET');
        const denied = await requireAdmin(env, request);
        if (denied) return denied;
        await ensureSchema(env);
        const row = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(route.value).first<SubmissionRow>();
        return mediaResponse(env, row, 'private, max-age=60');
      }
      case 'admin-export':
        return request.method === 'GET' ? exportAdminSubmissions(env, request) : notAllowed('GET');
    }
  } catch (error) {
    return json({ error: errorMessage(error) }, 500);
  }
};
