// AI-generated tests; prompt and scope: docs/ai/PM2.3-ai-usage.md.
//
// These tests exercise the PM2.1 server branches that the original
// integration test did not cover: the URL-less dedup key, malformed startup
// cache, partial board failure merge, mid-run refresh rejection, static/JSON
// headers, and concurrent refresh coalescing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,writeFile,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));

async function copyProject(dir) {
  for (const name of ['server.js', 'package.json', 'job-boards.json']) {
    await cp(path.join(project, name), path.join(dir, name));
  }
  await cp(path.join(project, 'src'), path.join(dir, 'src'), {recursive: true});
  await cp(path.join(project, 'public'), path.join(dir, 'public'), {recursive: true});
}

async function startServer({dir, mock}) {
  const port = 32000 + Math.floor(Math.random() * 20000);
  await writeFile(path.join(dir, 'mock.mjs'), mock);
  const child = spawn(process.execPath, ['--import', './mock.mjs', 'server.js'], {
    cwd: dir,
    env: {...process.env, PORT: String(port)},
    stdio: 'ignore',
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(base + '/')).ok) return {child, base};
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 75));
    }
    throw new Error('server did not start');
  } catch (error) {
    await stop(child);
    throw error;
  }
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 2000);
    timer.unref?.();
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill();
  });
}

async function cleanup(child, dir) {
  await stop(child);
  await rm(dir, {recursive: true, force: true, maxRetries: 5, retryDelay: 100});
}

// Purpose: a listing without a URL uses the company|title|location fallback,
// and URL keys are lowercased and stripped of query strings/trailing slashes.
// The malformed cache file also covers init()'s best-effort parse failure.
test('PM2.1 server: key() deduplicates URL-less and case-variant URL listings', {timeout: 20000}, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'skynet-key-'));
  let child;
  try {
    await copyProject(dir);
    await mkdir(path.join(dir, 'data'));
    await writeFile(path.join(dir, 'data', 'listings-cache.json'), '{not valid json');
    const started = await startServer({dir, mock: `globalThis.fetch = async (url) => {
      const target = String(url);
      if (target.includes('raw.githubusercontent.com')) return {ok: true, json: async () => [
        {title: 'Software Intern', company_name: 'Acme', locations: ['Remote'], active: true, is_visible: true},
        {title: 'Software Intern', company_name: 'Acme', locations: ['Remote'], active: true, is_visible: true},
        {title: 'Upper URL', company_name: 'Acme', locations: ['Remote'], url: 'HTTPS://JOBS.TEST/ROLE/?REF=1', active: true, is_visible: true},
        {title: 'Upper URL', company_name: 'Acme', locations: ['Remote'], url: 'https://jobs.test/role/', active: true, is_visible: true}
      ]};
      if (target.includes('greenhouse')) return {ok: true, json: async () => ({jobs: []})};
      return {ok: true, json: async () => []};
    };`});
    child = started.child;
    const data = await (await fetch(started.base + '/api/listings')).json();
    const ids = data.listings.map(listing => listing.id);
    assert.equal(data.listings.length, 2);
    assert.ok(ids.includes('acme|software intern|remote'));
    assert.ok(ids.includes('https://jobs.test/role'));
    assert.equal(data.listings.filter(listing => listing.title === 'Upper URL').length, 1);
  } finally {
    await cleanup(child, dir);
  }
});

// Purpose: when one career board fails but the board refresh otherwise
// succeeds, keep only that company's cached listings and use the fresh entries
// for every healthy company.
test('PM2.1 server: partial board failure merges only the failed company cache', {timeout: 20000}, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'skynet-partial-'));
  let child;
  try {
    await copyProject(dir);
    const old = {
      listings: [
        {id: 'cloudflare-old', title: 'Old Cloudflare Intern', company: 'Cloudflare', location: 'Remote', url: 'https://old.test/cloudflare', source: 'Greenhouse: Cloudflare', firstSeen: '2020-01-01'},
        {id: 'ramp-old', title: 'Old Ramp Intern', company: 'Ramp', location: 'Remote', url: 'https://old.test/ramp', source: 'Greenhouse: Ramp', firstSeen: '2020-01-01'},
      ],
      updatedAt: '2020-01-01',
      newCount: 0,
      errors: [],
    };
    await mkdir(path.join(dir, 'data'));
    await writeFile(path.join(dir, 'data', 'listings-cache.json'), JSON.stringify(old));
    const started = await startServer({dir, mock: `globalThis.fetch = async (url) => {
      const target = String(url);
      if (target.includes('raw.githubusercontent.com')) return {ok: true, json: async () => []};
      if (target.includes('/boards/cloudflare/')) return {ok: false, status: 503};
      if (target.includes('/boards/ramp/')) return {ok: true, json: async () => ({jobs: [
        {title: 'New Ramp Software Intern', absolute_url: 'https://new.test/ramp', location: {name: 'Remote'}}
      ]})};
      if (target.includes('greenhouse')) return {ok: true, json: async () => ({jobs: []})};
      return {ok: true, json: async () => []};
    };`});
    child = started.child;
    const response = await fetch(started.base + '/api/refresh', {method: 'POST'});
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.ok(data.listings.some(listing => listing.title === 'Old Cloudflare Intern'));
    assert.ok(data.listings.some(listing => listing.title === 'New Ramp Software Intern'));
    assert.equal(data.listings.some(listing => listing.title === 'Old Ramp Intern'), false);
    assert.match(data.errors.join('; '), /Cloudflare: HTTP 503/);
  } finally {
    await cleanup(child, dir);
  }
});

// Purpose: if a refresh rejects after a successful load, the cached payload
// remains available and the failure is reported in the errors array.
test('PM2.1 server: a failed mid-run refresh returns the cached payload with an error', {timeout: 20000}, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'skynet-midrun-'));
  let child;
  try {
    await copyProject(dir);
    const modeFile = path.join(dir, 'mode.txt');
    await writeFile(modeFile, 'ok');
    const started = await startServer({dir, mock: `import {readFileSync} from 'node:fs';
      const modeFile = ${JSON.stringify(modeFile)};
      globalThis.fetch = async (url) => {
        if (readFileSync(modeFile, 'utf8').trim() === 'fail') throw Error('Mid-run outage');
        const target = String(url);
        if (target.includes('raw.githubusercontent.com')) return {ok: true, json: async () => [
          {title: 'Cached Intern', company_name: 'Acme', locations: ['Remote'], url: 'https://jobs.test/cached', active: true, is_visible: true}
        ]};
        if (target.includes('greenhouse')) return {ok: true, json: async () => ({jobs: []})};
        return {ok: true, json: async () => []};
      };`});
    child = started.child;
    const first = await (await fetch(started.base + '/api/listings')).json();
    await writeFile(modeFile, 'fail');
    const response = await fetch(started.base + '/api/refresh', {method: 'POST'});
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(data.listings, first.listings);
    assert.equal(data.updatedAt, first.updatedAt);
    assert.match(data.errors.join('; '), /Refresh failed: .*Mid-run outage/);
  } finally {
    await cleanup(child, dir);
  }
});

// Purpose: verify the static file map and the documented response headers for
// both the HTML/CSS/JS assets and the JSON endpoint.
test('PM2.1 server: static assets and JSON responses set their documented headers', {timeout: 20000}, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'skynet-headers-'));
  let child;
  try {
    await copyProject(dir);
    const started = await startServer({dir, mock: `globalThis.fetch = async (url) => {
      const target = String(url);
      if (target.includes('raw.githubusercontent.com')) return {ok: true, json: async () => []};
      if (target.includes('greenhouse')) return {ok: true, json: async () => ({jobs: []})};
      return {ok: true, json: async () => []};
    };`});
    child = started.child;
    for (const [file, type] of [['/', 'text/html'], ['/app.js', 'text/javascript'], ['/style.css', 'text/css']]) {
      const response = await fetch(started.base + file);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), type);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    }
    const api = await fetch(started.base + '/api/listings');
    assert.equal(api.status, 200);
    assert.equal(api.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(api.headers.get('cache-control'), 'no-store');
    assert.equal((await fetch(started.base + '/missing')).status, 404);
  } finally {
    await cleanup(child, dir);
  }
});

// Purpose: two refresh requests that overlap should share one upstream refresh
// instead of doubling the GitHub and career-board requests.
test('PM2.1 server: concurrent refresh requests share one upstream refresh', {timeout: 20000}, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'skynet-concurrent-'));
  let child;
  try {
    await copyProject(dir);
    const logFile = path.join(dir, 'calls.log');
    await writeFile(logFile, '');
    const started = await startServer({dir, mock: `import {appendFileSync} from 'node:fs';
      const logFile = ${JSON.stringify(logFile)};
      globalThis.fetch = async (url) => {
        appendFileSync(logFile, String(url) + '\\n');
        await new Promise(resolve => setTimeout(resolve, 500));
        const target = String(url);
        if (target.includes('raw.githubusercontent.com')) return {ok: true, json: async () => []};
        if (target.includes('greenhouse')) return {ok: true, json: async () => ({jobs: []})};
        return {ok: true, json: async () => []};
      };`});
    child = started.child;
    const [first, second] = await Promise.all([
      fetch(started.base + '/api/refresh', {method: 'POST'}),
      fetch(started.base + '/api/refresh', {method: 'POST'}),
    ]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    const calls = (await readFile(logFile, 'utf8')).trim().split(/\r?\n/).filter(Boolean);
    assert.equal(calls.length, 6, 'GitHub plus five boards should be fetched once');
  } finally {
    await cleanup(child, dir);
  }
});
