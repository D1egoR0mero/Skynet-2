// AI-generated with Codex. Prompt: test the missing PM2.1 Greenhouse/Lever adapter,
// including normalization, role selection, missing dates, and isolated failures.
// See docs/ai/PM2.2-ai-usage.md for the interaction and verification record.
import test from 'node:test';
import assert from 'node:assert/strict';
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
