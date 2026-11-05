import {readFile} from 'node:fs/promises';

const boards = JSON.parse(await readFile(new URL('../../job-boards.json', import.meta.url), 'utf8'));
const internship = /\b(intern(?:ship)?|co[ -]?op)\b/i;
const technology = /\b(software|engineer(?:ing)?|developer|data|security|cybersecurity|computer|machine learning|technical|technology|IT)\b/i;

async function fetchBoard(board) {
  const greenhouse = board.provider === 'greenhouse';
  if (!greenhouse && board.provider !== 'lever') throw new Error('Unsupported provider');
  const slug = encodeURIComponent(board.slug);
  const url = greenhouse
    ? `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`
    : `https://api.lever.co/v0/postings/${slug}?mode=json`;
  const response = await fetch(url, {signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const entries = greenhouse ? payload?.jobs : payload;
  if (!Array.isArray(entries)) throw new Error('Invalid job list');

  return entries.flatMap(entry => {
    const title = greenhouse ? entry?.title : entry?.text;
    if (typeof title !== 'string' || !internship.test(title) || !technology.test(title)) return [];
    // Greenhouse first_published is a posting date; updated_at is not.
    // Lever's public posting contract does not guarantee a posting date.
    const published = greenhouse ? Date.parse(entry.first_published || '') : NaN;
    return [{
      title,
      company: board.company,
      location: (greenhouse ? entry.location?.name : entry.categories?.location) || 'Unspecified',
      url: (greenhouse ? entry.absolute_url : entry.hostedUrl || entry.applyUrl) || '',
      datePosted: Number.isFinite(published) ? new Date(published) : null,
      terms: greenhouse ? 'Unspecified' : entry.categories?.commitment || 'Unspecified',
      tags: `${title} ${board.company}`.toLowerCase(),
      source: `${greenhouse ? 'Greenhouse' : 'Lever'}: ${board.company}`,
    }];
  });
}

export async function fetchBoards() {
  const results = await Promise.allSettled(boards.map(fetchBoard));
  const jobs = [], errors = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') jobs.push(...result.value);
    else errors.push(`${boards[index].company}: ${result.reason?.message || String(result.reason)}`);
  });
  return {jobs, errors};
}
