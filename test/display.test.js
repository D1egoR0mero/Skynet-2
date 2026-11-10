// Tests for src/display.js, the interactive pager. Style follows
// test/pm21-boards.test.js: node:test + node:assert/strict, inline fixtures.
// displayResults reads process.stdin directly, so this file swaps in a
// PassThrough (never a real TTY) and restores the real descriptor afterwards.
import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {displayResults} from '../src/display.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const listing = (title, overrides = {}) => ({
  title,
  company: 'Acme',
  location: 'Remote',
  terms: 'Summer 2027',
  url: `https://example.test/${title}`,
  source: 'SimplifyJobs (Summer2027-Internships)',
  ...overrides,
});

async function runDisplay(pool, labels, limit, drive) {
  const stdin = Object.assign(new PassThrough(), {
    rawMode: null,
    setRawMode(value) { this.rawMode = value; },
    resume() {},
    isTTY: true,
  });
  const descriptor = Object.getOwnPropertyDescriptor(process, 'stdin');
  Object.defineProperty(process, 'stdin', {value: stdin, configurable: true, writable: true});
  const logs = [];
  let cleared = 0;
  const {log, clear} = console;
  console.log = (...args) => logs.push(args.join(' '));
  console.clear = () => { cleared++; };
  const done = displayResults(pool, labels, limit);
  try {
    if (drive) await drive(stdin, logs);
    await Promise.race([
      done,
      tick().then(() => new Promise((_, reject) => setTimeout(() => reject(new Error('displayResults never resolved')), 2000))),
    ]);
    return {logs, cleared, stdin};
  } finally {
    console.log = log;
    console.clear = clear;
    Object.defineProperty(process, 'stdin', descriptor);
  }
}

const press = async (stdin, key) => {
  stdin.emit('data', Buffer.from(key));
  await tick();
};

test('display: an empty pool prints the recovery message and returns without reading input', {timeout: 5000}, async () => {
  const {logs, cleared} = await runDisplay([], ['Major: software', 'Location: remote']);
  assert.ok(logs.some(line => line.includes('No internships survived')));
  assert.deepEqual(logs.slice(1, 3), ['  1. Major: software', '  2. Location: remote']);
  assert.equal(cleared, 0, 'an empty pool must not open the pager');
});

test('display: pages show the correct slice, range and page count', {timeout: 5000}, async () => {
  const pool = [listing('A'), listing('B'), listing('C')];
  const {logs} = await runDisplay(pool, ['Major: software'], 2, async stdin => {
    await press(stdin, 'n');
    await press(stdin, 'q');
  });
  const pages = logs.join('\n');
  assert.match(pages, /Showing 1-2 of 3 result\(s\)/);
  assert.match(pages, /Page 1 of 2/);
  assert.match(pages, /\n1\. A/);
  assert.match(pages, /\n2\. B/);
  assert.match(pages, /Showing 3-3 of 3 result\(s\)/);
  assert.match(pages, /Page 2 of 2/);
  assert.match(pages, /\n3\. C/);
  assert.equal(logs.filter(line => line.includes('Page 2 of 2')).length, 1, 'one keypress must redraw once');
});

test('display: next and previous stop at the first and last page', {timeout: 5000}, async () => {
  const pool = [listing('A'), listing('B'), listing('C')];
  const {logs} = await runDisplay(pool, [], 2, async (stdin, logLines) => {
    await press(stdin, 'p');
    assert.equal(logLines.filter(line => line.includes('Page 1 of 2')).length, 1, 'previous on page 1 is a no-op');
    await press(stdin, 'n');
    await press(stdin, 'n');
    assert.equal(logLines.filter(line => line.includes('Page 2 of 2')).length, 1, 'next on the last page is a no-op');
    await press(stdin, 'p');
    assert.equal(logLines.filter(line => line.includes('Page 1 of 2')).length, 2, 'previous on page 2 returns to page 1');
    await press(stdin, 'q');
  });
  assert.equal(logs.some(line => line.includes('Page 3 of')), false);
});

test('display: q and ctrl-c both quit and restore raw mode', {timeout: 5000}, async () => {
  for (const key of ['q', '\u0003']) {
    const {cleared, stdin} = await runDisplay([listing('A')], [], 20, drive => press(drive, key));
    assert.equal(stdin.rawMode, false, `raw mode must be off after ${JSON.stringify(key)}`);
    assert.ok(cleared >= 1, 'the screen is cleared on quit');
  }
});

test('display: a single result with no URL renders a placeholder and its source', {timeout: 5000}, async () => {
  const pool = [listing('Solo', {url: '', source: 'Lever: Acme'})];
  const {logs} = await runDisplay(pool, [], 20, stdin => press(stdin, 'q'));
  const text = logs.join('\n');
  assert.match(text, /Showing 1-1 of 1 result\(s\)/);
  assert.match(text, /Page 1 of 1/);
  assert.match(text, /\(no link provided\)/);
  assert.match(text, /Source: Lever: Acme/);
});
