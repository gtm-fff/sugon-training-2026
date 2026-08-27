import assert from 'node:assert/strict';
import test from 'node:test';
import { matchRoute } from '../functions/api/router.ts';

test('Pages API routes keep dynamic credentials and ids', () => {
  assert.deepEqual(matchRoute('/api/gallery'), { name: 'gallery' });
  assert.deepEqual(matchRoute('/api/gallery/record-id/thumbnail'), { name: 'gallery-thumbnail', value: 'record-id' });
  assert.deepEqual(matchRoute('/api/submissions/ABCD-EFGH-JKLM'), { name: 'submission', value: 'ABCD-EFGH-JKLM' });
  assert.deepEqual(matchRoute('/api/admin/submissions/record-id/image'), { name: 'admin-submission-media', value: 'record-id' });
  assert.equal(matchRoute('/api/unknown'), null);
});
