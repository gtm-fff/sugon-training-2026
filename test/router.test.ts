import assert from 'node:assert/strict';
import test from 'node:test';
import { matchRoute } from '../functions/api/router.ts';
import { extensionFor } from '../lib/data.ts';

test('Pages API routes keep dynamic credentials and ids', () => {
  assert.deepEqual(matchRoute('/api/gallery'), { name: 'gallery' });
  assert.deepEqual(matchRoute('/api/gallery/like'), { name: 'gallery-like' });
  assert.deepEqual(matchRoute('/api/gallery/record-id/thumbnail'), { name: 'gallery-thumbnail', value: 'record-id' });
  assert.deepEqual(matchRoute('/api/gallery/%E4%B8%80%E8%BF%9E/song'), { name: 'gallery-song', value: '一连' });
  assert.deepEqual(matchRoute('/api/submissions/ABCD-EFGH-JKLM'), { name: 'submission', value: 'ABCD-EFGH-JKLM' });
  assert.deepEqual(matchRoute('/api/admin/submissions/record-id/image'), { name: 'admin-submission-media', value: 'record-id' });
  assert.equal(matchRoute('/api/unknown'), null);
  assert.equal(extensionFor('image/gif'), 'gif');
  assert.equal(extensionFor('image/avif'), 'avif');
  assert.equal(extensionFor('image/bmp'), 'bmp');
  assert.equal(extensionFor('audio/mpeg'), 'mp3');
  assert.equal(extensionFor('audio/x-m4a'), 'm4a');
  assert.equal(extensionFor('audio/wave'), 'wav');
});
