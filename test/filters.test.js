// Tests for src/filters.js, the CLI funnel filters. Style follows
// test/pm21-boards.test.js: node:test + node:assert/strict, inline fixtures,
// no network or filesystem access.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyKeywordFilter,
  applyMajorFilter,
  applyCompanyTypeFilter,
  applyLocationFilter,
  applyPlusMinusFilter,
} from '../src/filters.js';

const listing = (title, overrides = {}) => {
  const item = {title, company: 'Acme', location: 'Remote', ...overrides};
  return {...item, tags: overrides.tags ?? `${item.title} ${item.company}`.toLowerCase()};
};
const titles = pool => pool.map(item => item.title);

test('filters: every filter leaves an empty pool empty', () => {
  assert.deepEqual(applyKeywordFilter([], {include: ['intern']}), []);
  assert.deepEqual(applyMajorFilter([], 'intern'), []);
  assert.deepEqual(applyCompanyTypeFilter([], 'intern'), []);
  assert.deepEqual(applyLocationFilter([], 'remote'), []);
  assert.deepEqual(applyPlusMinusFilter([], 'intern', 'senior'), []);
});

test('filters: blank keyword input imposes no restriction', () => {
  const pool = [listing('Software Intern'), listing('Data Intern')];
  for (const input of ['', '   ', ', , ', undefined, null]) {
    assert.equal(applyMajorFilter(pool, input).length, 2, `major ${JSON.stringify(input)}`);
    assert.equal(applyCompanyTypeFilter(pool, input).length, 2, `company ${JSON.stringify(input)}`);
    assert.equal(applyLocationFilter(pool, input).length, 2, `location ${JSON.stringify(input)}`);
  }
  assert.equal(applyPlusMinusFilter(pool, '', '').length, 2);
  assert.equal(applyPlusMinusFilter(pool).length, 2);
  assert.equal(applyKeywordFilter(pool, {}).length, 2);
});

test('filters: include keywords require every keyword, ignoring case and padding', () => {
  const pool = [
    listing('Software Intern (Disney)', {company: 'The Walt Disney Company', tags: 'software intern the walt disney company'}),
    listing('Software Intern (Walt Disney)', {company: 'Walt Disney Company', tags: 'software intern walt disney company'}),
    listing('Sales Intern', {tags: 'sales intern acme'}),
  ];
  assert.deepEqual(titles(applyKeywordFilter(pool, {include: [' THE ', 'Walt', 'disney', 'company']})), ['Software Intern (Disney)']);
  assert.deepEqual(titles(applyKeywordFilter(pool, {include: ['  SOFTWARE  ', 'Intern']})), ['Software Intern (Disney)', 'Software Intern (Walt Disney)']);
});

test('filters: exclude keywords remove a listing matching any keyword', () => {
  const pool = [
    listing('Software Intern'),
    listing('Senior Software Intern'),
    listing('Engineering Manager'),
    listing('Director of Engineering'),
  ];
  assert.deepEqual(titles(applyKeywordFilter(pool, {exclude: [' SENIOR ', 'manager', 'director']})), ['Software Intern']);
  assert.equal(applyKeywordFilter(pool, {exclude: []}).length, 4);
});

test('filters: include and exclude compose and exclusion wins conflicts', () => {
  const pool = [listing('Software Intern'), listing('Senior Software Intern')];
  assert.deepEqual(titles(applyKeywordFilter(pool, {include: ['software'], exclude: ['senior']})), ['Software Intern']);
  assert.deepEqual(titles(applyKeywordFilter(pool, {include: ['software'], exclude: ['software']})), []);
});

test('filters: keywords are literal substrings, not regular expressions', () => {
  const pool = [listing('Software Intern'), listing('Data Intern')];
  assert.deepEqual(titles(applyKeywordFilter(pool, {include: ['.*']})), []);
  assert.equal(applyKeywordFilter(pool, {exclude: ['.*']}).length, 2);
  assert.deepEqual(titles(applyKeywordFilter(pool, {include: ['software intern']})), ['Software Intern']);
});

test('filters: field selects the listing property that is searched', () => {
  const pool = [listing('Remote Software Intern', {location: 'Blacksburg, VA', tags: 'remote software intern acme'})];
  assert.equal(applyKeywordFilter(pool, {include: ['remote'], field: 'location'}).length, 0, 'title text must not satisfy a location search');
  assert.equal(applyKeywordFilter(pool, {include: ['remote'], field: 'tags'}).length, 1);
});

test('filters: missing field text is treated as empty', () => {
  const pool = [
    {title: 'Software Intern', company: 'Acme'},
    {title: 'Data Intern', company: 'Acme', tags: ''},
  ];
  assert.equal(applyKeywordFilter(pool, {}).length, 2);
  assert.equal(applyKeywordFilter(pool, {include: ['intern']}).length, 0);
  assert.equal(applyKeywordFilter(pool, {exclude: ['intern']}).length, 2);
});

test('filters: major, company type and plus/minus search title and company text', () => {
  const pool = [
    listing('Software Intern', {company: 'Acme'}),
    listing('Data Intern', {company: 'Globex'}),
    listing('Sales Intern', {company: 'Initech'}),
  ];
  assert.deepEqual(titles(applyMajorFilter(pool, 'software')), ['Software Intern']);
  assert.deepEqual(titles(applyCompanyTypeFilter(pool, 'globex')), ['Data Intern']);
  assert.deepEqual(titles(applyPlusMinusFilter(pool, 'intern', 'software')), ['Data Intern', 'Sales Intern']);
  assert.equal(applyPlusMinusFilter(pool, '', 'intern').length, 0);
});

test('filters: location filter searches only the location field', () => {
  const pool = [
    listing('Software Intern', {location: 'Remote'}),
    listing('Remote Systems Intern', {location: 'New York, NY'}),
  ];
  assert.deepEqual(titles(applyLocationFilter(pool, 'remote')), ['Software Intern']);
});

test('filters: duplicate keywords are harmless and over-long keywords match nothing', () => {
  const pool = [listing('Software Intern')];
  assert.equal(applyKeywordFilter(pool, {include: ['intern', ' INTERN ', 'intern']}).length, 1);
  assert.equal(applyKeywordFilter(pool, {include: ['intern'.repeat(50)]}).length, 0);
});

test('filters: non-array keyword lists are rejected rather than coerced', () => {
  const pool = [listing('Software Intern')];
  assert.throws(() => applyKeywordFilter(pool, {include: 'intern'}), TypeError);
  assert.throws(() => applyKeywordFilter(pool, {exclude: 'intern'}), TypeError);
});
