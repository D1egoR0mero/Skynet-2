// AI-generated/expanded tests. Prompt and scope: docs/ai/PM2.2-ai-usage.md and
// docs/ai/PM2.3-ai-usage.md.
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

// Purpose: the co-op and full-time selectors have several documented
// spellings that the original tests never exercised.
test('PM2.1 render: co-op and full-time types accept every documented spelling', async () => {
  const ui = browser({jobs: [
    job('Software Co-op'),
    job('Software Coop'),
    job('Software Co op'),
    job('Software Intern'),
    job('New Grad Software Engineer'),
    job('Graduate Developer'),
    job('Entry Level Analyst'),
    job('Senior Engineer'),
  ]});
  await ui.run('load()');
  ui.input('type', 'co-op');
  assert.deepEqual(ui.titles(), ['Software Co-op', 'Software Coop', 'Software Co op']);
  ui.input('type', 'full-time');
  assert.deepEqual(ui.titles(), ['New Grad Software Engineer', 'Graduate Developer', 'Entry Level Analyst']);
});

// Purpose: a posted-since window must remove stale postings and listings whose
// posting date is unknown, while keeping recent postings.
test('PM2.1 render: posted-since excludes stale and undated listings', async () => {
  const now = Date.now();
  const ui = browser({jobs: [
    job('Recent', {datePosted: new Date(now - 2 * 86400000).toISOString()}),
    job('Stale', {datePosted: new Date(now - 8 * 86400000).toISOString()}),
    job('Undated', {datePosted: null}),
  ]});
  await ui.run('load()');
  ui.input('date', '7');
  assert.deepEqual(ui.titles(), ['Recent']);
  assert.equal(ui.nodes.get('matches').textContent, '1');
});

// Purpose: distinguish the two empty states and the unknown-date label, which
// use different rendering branches.
test('PM2.1 render: empty datasets and undated listings use their documented messages', async () => {
  const empty = browser({jobs: []});
  await empty.run('load()');
  assert.match(empty.nodes.get('cards').children[0].textContent, /No listings available/);

  const undated = browser({jobs: [job('Undated', {datePosted: null})]});
  await undated.run('load()');
  const bottom = undated.nodes.get('cards').children[0].children.at(-1);
  assert.equal(bottom.children[0].textContent, 'Posting date unavailable');
});

// Purpose: if the result set shrinks while the user is on a later page, render
// must clamp the page index instead of showing an empty page.
test('PM2.1 render: the page index is clamped when the result set shrinks', async () => {
  const ui = browser({jobs: Array.from({length: 14}, (_, i) => job(`Software Intern ${i}`))});
  await ui.run('load()');
  ui.click('next');
  assert.equal(ui.nodes.get('page').textContent, 'Page 2 of 2');
  ui.run('listings.length = 2; page = 1; render()');
  assert.equal(ui.nodes.get('page').textContent, 'Page 1 of 1');
  assert.equal(ui.nodes.get('prev').disabled, true);
  assert.equal(ui.nodes.get('next').disabled, true);
});

// Purpose: directly exercise the small helpers that only had indirect coverage:
// DOM lookup, element construction, safe storage reads, and sort tie-breakers.
test('PM2.1 helpers: $, el, read and newestFirst handle normal and edge inputs', () => {
  const ui = browser({stored: {good: '"value"', bad: '{'}});
  assert.equal(ui.run('$')('search'), ui.nodes.get('search'));

  const node = ui.run('el')('div', 'tag', 'hello');
  assert.equal(node.tagName, 'div');
  assert.equal(node.className, 'tag');
  assert.equal(node.textContent, 'hello');
  const bare = ui.run('el')('span');
  assert.equal(bare.tagName, 'span');
  assert.equal(bare.textContent, '');

  assert.equal(ui.run('read')('missing', 'fallback'), 'fallback');
  assert.equal(ui.run('read')('good', 'fallback'), 'value');
  assert.equal(ui.run('read')('bad', 'fallback'), 'fallback');

  const newestFirst = ui.run('newestFirst');
  const older = {datePosted: '2026-10-20', firstSeen: '2026-10-21', company: 'Alpha'};
  const newer = {datePosted: '2026-10-20', firstSeen: '2026-10-22', company: 'Beta'};
  assert.ok(newestFirst(newer, older) < 0, 'newer firstSeen wins when posting dates tie');
  assert.ok(
    newestFirst(
      {datePosted: '2026-10-20', company: 'Alpha'},
      {datePosted: '2026-10-20', company: 'Beta'},
    ) < 0,
    'company name breaks a full tie',
  );
});

// Purpose: verify the card shell (company initials, tags, and date) that the
// other rendering tests only inspected indirectly.
test('PM2.1 rendering: cards show company initials, location/term tags and the posting date', async () => {
  const ui = browser({jobs: [job('Software Intern', {
    company: 'Acme',
    location: 'Remote',
    terms: 'Summer 2027',
    datePosted: '2026-10-20',
  })]});
  await ui.run('load()');
  const card = ui.nodes.get('cards').children[0];
  assert.equal(card.children[0].children[0].textContent, 'AC');
  assert.deepEqual(card.children[3].children.map(tag => tag.textContent), ['Remote', 'Summer 2027']);
  assert.match(card.children.at(-1).children[0].textContent, /^Posted /);
});
