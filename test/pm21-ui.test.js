// AI-generated/expanded tests. Prompt and scope: docs/ai/PM2.2-ai-usage.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import {browser, job} from './helpers/browser.js';

test('PM2.1 sorting: newest posting first, unknown and invalid dates last', async () => {
  const ui = browser({jobs: [job('Unknown', {datePosted: null}), job('Old', {datePosted: '2026-08-20'}), job('New'), job('Invalid', {datePosted: 'bad'})]});
  await ui.run('load()');
  assert.deepEqual(ui.titles(), ['New', 'Old', 'Unknown', 'Invalid']);
  assert.equal(ui.run('postedTime')({datePosted: 'bad'}), -Infinity);
  assert.equal(ui.run('idFor')(job('New')), 'Acme|New|https://example.test/New');
});

test('PM2.1 filters and pagination render the correct cards and reset page on input', async () => {
  const jobs = Array.from({length: 14}, (_, i) => job(`Software Intern ${i}`, {datePosted: new Date().toISOString()}));
  const ui = browser({jobs: [...jobs, job('Sales', {location: 'New York'})]});
  await ui.run('load()');
  assert.equal(ui.nodes.get('cards').children.length, 12);
  assert.equal(ui.nodes.get('page').textContent, 'Page 1 of 2');
  ui.click('next');
  assert.equal(ui.nodes.get('cards').children.length, 3);
  ui.click('prev');
  assert.equal(ui.nodes.get('prev').disabled, true);
  ui.input('search', 'sales');
  assert.deepEqual(ui.titles(), ['Sales']);
  ui.input('location', 'Remote');
  assert.deepEqual(ui.titles(), []);
  assert.match(ui.nodes.get('cards').children[0].textContent, /No matching/);
  ui.click('reset');
  ui.input('type', 'intern');
  assert.equal(ui.nodes.get('matches').textContent, '14');
  ui.input('date', '7');
  assert.equal(ui.nodes.get('matches').textContent, '14');
});

test('PM2.1 favorites and theme persist and restore through storage', async () => {
  const ui = browser({jobs: [job('Software Intern')], stored: {'skynet-saved': 'invalid json'}});
  await ui.run('load()');
  ui.nodes.get('cards').children[0].children[0].children[1].onclick();
  assert.equal(JSON.parse(ui.storage.get('skynet-saved')).length, 1);
  ui.click('nav-saved');
  assert.deepEqual(ui.titles(), ['Software Intern']);
  assert.equal(ui.nodes.get('section-title').textContent, 'Saved opportunities');
  ui.click('theme');
  assert.equal(ui.storage.get('skynet-dark'), 'true');
  const restored = browser({jobs: [job('Software Intern')], stored: Object.fromEntries(ui.storage)});
  await restored.run('load()');
  assert.equal(restored.context.document.body.classList.contains('dark'), true);
  restored.click('nav-saved');
  assert.equal(restored.titles().length, 1);
  restored.nodes.get('cards').children[0].children[0].children[1].onclick();
  assert.equal(restored.titles().length, 0);
  restored.click('nav-all');
  assert.equal(restored.titles().length, 1);
});

test('PM2.1 load refresh uses POST and displays failures without cards', async () => {
  let failed = false;
  const ui = browser({fetchImpl: async () => failed
    ? {ok: false, json: async () => ({error: 'Source unavailable'})}
    : {ok: true, json: async () => ({listings: [job('Software Intern')], newCount: 1, updatedAt: '2026-10-22', errors: ['Source down']})}});
  await ui.run('load()');
  assert.match(ui.nodes.get('status').textContent, /Some sources unavailable/);
  failed = true;
  await ui.click('refresh');
  assert.equal(ui.calls.at(-1)[0], '/api/refresh');
  assert.equal(ui.calls.at(-1)[1].method, 'POST');
  assert.deepEqual(ui.titles(), []);
  assert.equal(ui.nodes.get('status').textContent, 'Source unavailable');
});

test('PM2.1 rendering keeps listing text literal and blocks unsafe application URLs', async () => {
  const ui = browser({jobs: [job('<img onerror=alert(1)>', {url: 'javascript:alert(1)'})]});
  await ui.run('load()');
  assert.deepEqual(ui.titles(), ['<img onerror=alert(1)>']);
  const bottom = ui.nodes.get('cards').children[0].children.at(-1);
  assert.equal(bottom.children.some(node => node.tagName === 'a'), false);
});
