import assert from 'node:assert/strict';
import test from 'node:test';
import { matchRoute } from '../functions/api/router.ts';
import { companyDefaultPassword, companyPasswordHash, createAdminCookie, getAdminSession, validCompanyPassword } from '../lib/admin.ts';
import type { AppEnv } from '../lib/data.ts';
import { extensionFor } from '../lib/data.ts';

test('Pages API routes keep dynamic credentials and ids', () => {
  assert.deepEqual(matchRoute('/api/gallery'), { name: 'gallery' });
  assert.deepEqual(matchRoute('/api/gallery/like'), { name: 'gallery-like' });
  assert.deepEqual(matchRoute('/api/gallery/record-id/thumbnail'), { name: 'gallery-thumbnail', value: 'record-id' });
  assert.deepEqual(matchRoute('/api/gallery/%E4%B8%80%E8%BF%9E/song'), { name: 'gallery-song', value: '一连' });
  assert.deepEqual(matchRoute('/api/submissions/ABCD-EFGH-JKLM'), { name: 'submission', value: 'ABCD-EFGH-JKLM' });
  assert.deepEqual(matchRoute('/api/admin/submissions/record-id/image'), { name: 'admin-submission-media', value: 'record-id' });
  assert.deepEqual(matchRoute('/api/admin/company-admins/%E4%B8%80%E8%BF%9E/reset'), { name: 'admin-company-admin-reset', value: '一连' });
  assert.deepEqual(matchRoute('/api/admin/song'), { name: 'admin-song' });
  assert.equal(matchRoute('/api/unknown'), null);
  assert.equal(extensionFor('image/gif'), 'gif');
  assert.equal(extensionFor('image/avif'), 'avif');
  assert.equal(extensionFor('image/bmp'), 'bmp');
  assert.equal(extensionFor('audio/mpeg'), 'mp3');
  assert.equal(extensionFor('audio/x-m4a'), 'm4a');
  assert.equal(extensionFor('audio/wave'), 'wav');
});

test('company admin defaults and signed scope stay server-side', async () => {
  const env = { SESSION_SECRET: 'test-session-secret' } as AppEnv;
  const password = await companyDefaultPassword(env, '一连');
  assert.match(password, /^SG26-[A-Za-z0-9_-]{10}$/);
  assert.notEqual(password, await companyDefaultPassword(env, '二连'));
  const hash = await companyPasswordHash(env, 'company01', password);
  assert.equal(await validCompanyPassword(env, 'company01', password, hash), true);
  assert.equal(await validCompanyPassword(env, 'company01', 'wrong', hash), false);

  const cookie = await createAdminCookie(env, new Request('https://example.com'), 'company', '一连');
  const session = await getAdminSession(env, new Request('https://example.com', { headers: { cookie } }));
  assert.deepEqual({ role: session?.role, company: session?.company }, { role: 'company', company: '一连' });
});
