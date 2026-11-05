// AI-generated tests. Prompt and scope: docs/ai/PM2.2-ai-usage.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import {browser, job} from './helpers/browser.js';

const jobs = [
  job('Software Intern', {company: 'The Walt Disney Company'}),
  job('Software Intern', {company: 'Walt Disney Company', location: 'NY'}),
  job('Senior Software Intern'),
  job('Engineering Manager'),
  job('Data Intern', {tags: 'software', terms: 'software'}),
];
test('PM2.2 include requires every comma-separated keyword across title and company', async () => {
  const ui = browser({jobs});
  await ui.run('load()');
  ui.input('include', ' THE, walt, DISNEY, company, , ');
  assert.equal(ui.titles().length, 1);
  ui.input('include', 'remote');
  assert.equal(ui.titles().length, 0, 'location must not supply keyword matches');
  ui.input('include', 'software, intern');
  assert.equal(ui.titles().length, 3, 'tags and terms must not supply keyword matches');
});
test('PM2.2 exclude rejects any keyword; include and exclude compose with location/search', async () => {
  const ui = browser({jobs});
  await ui.run('load()');
  ui.input('exclude', ' SENIOR, manager ');
  assert.equal(ui.titles().length, 3);
  ui.input('include', 'software, intern');
  assert.equal(ui.titles().length, 2);
  ui.input('location', 'remote');
  assert.equal(ui.titles().length, 1);
  ui.input('search', 'missing phrase');
  assert.deepEqual(ui.titles(), []);
  ui.click('reset');
  assert.equal(ui.nodes.get('include').value, '');
  assert.equal(ui.nodes.get('exclude').value, '');
  assert.equal(ui.titles().length, jobs.length);
});
test('PM2.2 blanks impose no restriction; phrases are literal and exclusion wins conflicts', async () => {
  const ui = browser({jobs});
  await ui.run('load()');
  ui.input('include', ' , , ');
  ui.input('exclude', ' , ');
  assert.equal(ui.titles().length, jobs.length);
  ui.input('include', 'software intern');
  assert.equal(ui.titles().length, 3);
  ui.input('exclude', 'software');
  assert.equal(ui.titles().length, 0);
  ui.input('exclude', '.*');
  assert.equal(ui.titles().length, 3, 'keywords are not regular expressions');
});
test('PM2.2 editing keywords resets pagination and preserves saved-only mode', async () => {
  const list = Array.from({length: 14}, (_, i) => job(`Software Intern ${i}`));
  const ui = browser({jobs: list, stored: {'skynet-saved': JSON.stringify(list.slice(1).map(item => `${item.company}|${item.title}|${item.url}`))}});
  await ui.run('load()');
  ui.click('nav-saved');
  ui.click('next');
  ui.input('include', 'intern 13');
  assert.equal(ui.nodes.get('page').textContent, 'Page 1 of 1');
  assert.deepEqual(ui.titles(), ['Software Intern 13']);
  ui.click('reset');
  assert.equal(ui.nodes.get('section-title').textContent, 'Saved opportunities');
  assert.equal(ui.nodes.get('matches').textContent, '13');
});
