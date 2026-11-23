import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchGoldSync } from './worker.mjs';

test('Cloudflare scheduler targets only the gold data update workflow', async () => {
  let result;
  await dispatchGoldSync({ GITHUB_DISPATCH_TOKEN: 'dummy-test-token' }, async (url, options) => {
    result = { url, options };
    return { status: 204 };
  });
  assert.match(result.url, /\/ludanBig\/goldview\/actions\/workflows\/refresh-data\.yml\/dispatches$/);
  assert.equal(result.options.method, 'POST');
  assert.equal(result.options.headers.Authorization, 'Bearer dummy-test-token');
  assert.deepEqual(JSON.parse(result.options.body), { ref: 'main' });
});

test('Cloudflare scheduler requires a secret and catches API failures', async () => {
  await assert.rejects(dispatchGoldSync({}, async () => ({ status: 204 })), /not configured/);
  await assert.rejects(dispatchGoldSync({ GITHUB_DISPATCH_TOKEN: 'dummy' }, async () => ({ status: 403 })), /HTTP 403/);
});
