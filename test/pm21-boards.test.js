// AI-generated with Codex and expanded with Opencode. Prompt: test the missing
// PM2.1 Greenhouse/Lever adapter, including normalization, role selection,
// missing dates, isolated failures, and unsupported providers.
// See docs/ai/PM2.2-ai-usage.md and docs/ai/PM2.3-ai-usage.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {fetchBoards} from '../src/sources/boards.js';

test('career boards normalize dates, defaults, and co-ops without accepting nontechnical internships', async t => {
  const urls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    urls.push(url);
    return {ok: true, json: async () => url.includes('greenhouse') ? {jobs: [
      {title: 'Software Engineering Co-op', absolute_url: 'https://example.test/co-op', first_published: '2026-10-01T00:00:00Z'},
      {title: 'Marketing Intern'},
      {title: 'Software Engineer'},
      {title: 'Internal Software Engineer'},
      {title: 'Data Intern', first_published: 'invalid', updated_at: '2026-11-01T00:00:00Z'},
      null,
    ]} : [{text: 'Security Internship', applyUrl: 'https://example.test/apply', categories: {commitment: 'Internship'}}]};
  });
  const {jobs, errors} = await fetchBoards();
  assert.deepEqual(errors, []);
  assert.equal(urls.length, 5);
  assert.ok(urls.includes('https://api.lever.co/v0/postings/palantir?mode=json'));
  assert.equal(jobs.length, 9);
  const coOp = jobs.find(job => job.title.includes('Co-op'));
  assert.equal(coOp.datePosted.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(coOp.location, 'Unspecified');
  assert.equal(coOp.terms, 'Unspecified');
  assert.equal(coOp.tags, `${coOp.title} ${coOp.company}`.toLowerCase());
  assert.ok(jobs.filter(job => job.title === 'Data Intern').every(job => job.datePosted === null));
  const lever = jobs.find(job => job.source.startsWith('Lever:'));
  assert.equal(lever.url, 'https://example.test/apply');
  assert.equal(lever.terms, 'Internship');
  assert.equal(lever.datePosted, null);
});

test('career boards report HTTP and malformed payload errors per company while retaining healthy sources', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.includes('cloudflare')) return {ok: false, status: 503};
    if (url.includes('datadog')) return {ok: true, json: async () => ({jobs: null})};
    if (url.includes('figma')) return {ok: true, json: async () => {throw new SyntaxError('Invalid JSON');}};
    return {ok: true, json: async () => url.includes('greenhouse')
      ? {jobs: [{title: 'Software Intern'}]}
      : [{text: 'Security Intern', categories: {location: 'Remote'}}]};
  });
  const {jobs, errors} = await fetchBoards();
  assert.deepEqual(errors, ['Cloudflare: HTTP 503', 'Datadog: Invalid job list', 'Figma: Invalid JSON']);
  assert.deepEqual(jobs.map(job => job.company), ['Ramp', 'Palantir']);
  assert.equal(jobs[1].location, 'Remote');
});

// Purpose: the unsupported-provider guard is unreachable with the real
// job-boards.json, so load a temporary copy of the adapter with an invalid
// configuration and assert that it fails before making any network request.
test('career boards reject an unsupported provider without making a request', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'skynet-board-config-'));
  const originalFetch = globalThis.fetch;
  try {
    await mkdir(path.join(dir, 'src', 'sources'), {recursive: true});
    await cp(
      fileURLToPath(new URL('../src/sources/boards.js', import.meta.url)),
      path.join(dir, 'src', 'sources', 'boards.js'),
    );
    await writeFile(
      path.join(dir, 'job-boards.json'),
      JSON.stringify([{provider: 'workday', slug: 'acme', company: 'Acme'}]),
    );
    const {fetchBoards: fetchTemporaryBoards} = await import(
      pathToFileURL(path.join(dir, 'src', 'sources', 'boards.js')).href
    );
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return {ok: true, json: async () => []};
    };
    const {jobs, errors} = await fetchTemporaryBoards();
    assert.deepEqual(jobs, []);
    assert.deepEqual(errors, ['Acme: Unsupported provider']);
    assert.equal(calls, 0, 'the provider must be validated before fetch');
  } finally {
    globalThis.fetch = originalFetch;
    await rm(dir, {recursive: true, force: true, maxRetries: 5, retryDelay: 100});
  }
});
