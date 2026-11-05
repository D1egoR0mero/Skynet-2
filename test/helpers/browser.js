// AI-assisted test harness; prompt and scope: docs/ai/PM2.2-ai-usage.md.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const code = readFileSync(new URL('../../public/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
function element(tag = 'div') {
  const classes = new Set();
  return {
    tagName: tag, value: '', textContent: '', children: [], attributes: {}, listeners: {},
    classList: {
      add(name) { classes.add(name); },
      contains(name) { return classes.has(name); },
      toggle(name, force = !classes.has(name)) {
        if (force) classes.add(name); else classes.delete(name);
        return force;
      },
    },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, callback) { this.listeners[name] = callback; },
  };
}
export function browser({jobs = [], stored = {}, fetchImpl} = {}) {
  const nodes = new Map([...html.matchAll(/id="([^"]+)"/g)].map(match => [match[1], element()]));
  const storage = new Map(Object.entries(stored));
  const calls = [];
  const context = vm.createContext({
    Date, Set, Number, JSON,
    localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)},
    document: {body: element('body'), getElementById: id => nodes.get(id), createElement: element},
    fetch: async (...args) => {
      calls.push(args);
      return fetchImpl ? fetchImpl(...args) : {ok: true, json: async () => ({listings: jobs, newCount: jobs.length, updatedAt: '2026-10-22T12:00:00Z'})};
    },
  });
  // Suppress only automatic initial load; each test explicitly awaits load().
  vm.runInContext(code.replace(/\bload\(\);\s*$/, ''), context);
  return {
    nodes, storage, calls, context,
    run: expression => vm.runInContext(expression, context),
    input(id, value) { const node = nodes.get(id); node.value = value; node.listeners.input(); },
    click(id) { return nodes.get(id).onclick(); },
    titles() { return nodes.get('cards').children.filter(card => card.tagName === 'article').map(card => card.children.find(child => child.tagName === 'h3').textContent); },
  };
}
export function job(title, overrides = {}) {
  return {title, company: 'Acme', location: 'Remote', url: `https://example.test/${encodeURIComponent(title)}`, datePosted: '2026-10-20', ...overrides};
}
