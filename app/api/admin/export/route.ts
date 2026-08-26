import { env } from 'cloudflare:workers';
import { strToU8, zipSync } from 'fflate';
import { requireAdmin } from '../../../../lib/admin';
import { ensureSchema, SubmissionRow } from '../../../../lib/data';

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100) || 'image';
}

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  await ensureSchema();
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
  return new Response(archive, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      'cache-control': 'no-store',
    },
  });
}
