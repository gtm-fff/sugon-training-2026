export type AppEnv = {
  DB: D1Database;
  FILES: R2Bucket;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
};

export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const VISUAL_MEDIA_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp',
  'video/mp4', 'video/quicktime', 'video/webm',
]);
export const AUDIO_MEDIA_TYPES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac',
  'audio/wav', 'audio/x-wav', 'audio/wave',
]);
export const ALLOWED_MEDIA_TYPES = new Set([...VISUAL_MEDIA_TYPES, ...AUDIO_MEDIA_TYPES]);
export const COMPANIES = new Set([
  '一连', '二连', '三连', '四连', '五连', '六连', '七连', '八连',
  '九连', '十连', '十一连', '十二连', '十三连', '十四连', '十五连', '十六连',
]);

export type SubmissionRow = {
  id: string;
  credential_hash: string;
  company: string;
  title: string;
  description: string;
  image_key: string;
  image_name: string;
  image_type: string;
  image_size: number;
  created_at: string;
  updated_at: string;
};

let schemaReady = false;

export async function ensureSchema(env: AppEnv) {
  if (schemaReady) return;
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      credential_hash TEXT NOT NULL UNIQUE,
      company TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      image_key TEXT NOT NULL,
      image_name TEXT NOT NULL,
      image_type TEXT NOT NULL,
      image_size INTEGER NOT NULL CHECK(image_size <= 26214400),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_credential_hash ON submissions(credential_hash)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS submission_media (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      image_key TEXT NOT NULL,
      image_name TEXT NOT NULL,
      image_type TEXT NOT NULL,
      image_size INTEGER NOT NULL CHECK(image_size <= 26214400),
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (submission_id, position)
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_submission_media_submission ON submission_media(submission_id)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS company_songs (
      company TEXT PRIMARY KEY,
      owner_submission_id TEXT NOT NULL UNIQUE,
      audio_key TEXT NOT NULL,
      audio_name TEXT NOT NULL,
      audio_type TEXT NOT NULL,
      audio_size INTEGER NOT NULL CHECK(audio_size <= 26214400),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_company_songs_owner ON company_songs(owner_submission_id)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS company_admins (
      company TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS company_votes (
      company TEXT NOT NULL,
      voter_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (company, voter_hash)
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_company_votes_company ON company_votes(company)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS company_views (
      company TEXT NOT NULL,
      viewer_hash TEXT NOT NULL,
      view_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (company, viewer_hash, view_date)
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_company_views_company ON company_views(company)'),
  ]);
  const table = await db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'submissions'").first<{ sql: string }>();
  if (table?.sql.includes('10485760')) {
    await db.batch([
      db.prepare('ALTER TABLE submissions RENAME TO submissions_10mb'),
      db.prepare(`CREATE TABLE submissions (
        id TEXT PRIMARY KEY,
        credential_hash TEXT NOT NULL UNIQUE,
        company TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        image_key TEXT NOT NULL,
        image_name TEXT NOT NULL,
        image_type TEXT NOT NULL,
        image_size INTEGER NOT NULL CHECK(image_size <= 26214400),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      db.prepare('INSERT INTO submissions SELECT * FROM submissions_10mb'),
      db.prepare('DROP TABLE submissions_10mb'),
      db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_credential_hash ON submissions(credential_hash)'),
    ]);
  }
  schemaReady = true;
}

export function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function randomCredential(prefix = '') {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const body = [...bytes].map((byte) => alphabet[byte % alphabet.length]);
  const chunks = [body.slice(0, 4).join(''), body.slice(4, 8).join(''), body.slice(8, 12).join('')];
  return prefix ? `${prefix}-${chunks.join('-')}` : chunks.join('-');
}

export function cleanText(value: FormDataEntryValue | null, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

export function validCompany(value: string) {
  return COMPANIES.has(value);
}

export function extensionFor(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/gif') return 'gif';
  if (type === 'image/avif') return 'avif';
  if (type === 'image/bmp') return 'bmp';
  if (type === 'video/mp4') return 'mp4';
  if (type === 'video/quicktime') return 'mov';
  if (type === 'video/webm') return 'webm';
  if (type === 'audio/mpeg' || type === 'audio/mp3') return 'mp3';
  if (type === 'audio/mp4' || type === 'audio/x-m4a') return 'm4a';
  if (type === 'audio/aac') return 'aac';
  if (type === 'audio/wav' || type === 'audio/x-wav' || type === 'audio/wave') return 'wav';
  return 'jpg';
}

export function publicSubmission(row: SubmissionRow) {
  return {
    id: row.id,
    company: row.company,
    title: row.title,
    description: row.description,
    imageName: row.image_name,
    mediaType: row.image_type,
    imageSize: row.image_size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers });
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '服务器暂时无法处理请求';
}
