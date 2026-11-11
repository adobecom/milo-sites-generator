import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildBlock, decorateIcons } from './aem.js';

const ICONS = ['twitter', 'linkedin', 'facebook'];
const readIcon = (name) => fs.readFileSync(path.resolve(__dirname, `../../icons/${name}.svg`), 'utf8');

function stubFetch(svgByName) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const name = ICONS.find((n) => url.endsWith(`/icons/${n}.svg`));
    return { ok: true, text: async () => svgByName[name] };
  }));
}

async function decorate(name, svg) {
  stubFetch({ [name]: svg });
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `<span class="icon icon-${name}"></span>`;
  decorateIcons(wrapper);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
  await new Promise((resolve) => { setTimeout(resolve, 0); });
  return wrapper.querySelector('span.icon');
}

describe('decorateIcons (SVG icons)', () => {
  beforeEach(() => {
    window.hlx = { codeBasePath: '' };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('strips script, on* handlers and javascript: links, keeps harmless markup', async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10" onload="window.__pwned = 1">
      <script>window.__pwned = 2</script>
      <a xlink:href="javascript:window.__pwned=3"><path id="p1" d="M0 0h10v10z" fill="#fff"/></a>
      <circle cx="5" cy="5" r="2" onclick="window.__pwned=4" fill="red"/>
    </svg>`;
    const span = await decorate('twitter', svg);

    expect(span.querySelector('script')).toBeNull();
    expect(span.innerHTML).not.toMatch(/javascript:/i);
    expect(span.innerHTML).not.toMatch(/onload|onclick/i);
    expect(span.querySelector('svg')).not.toBeNull();
    expect(span.querySelector('svg').getAttribute('viewBox')).toBe('0 0 10 10');
    expect(span.querySelector('#p1').getAttribute('d')).toBe('M0 0h10v10z');
    expect(span.querySelector('#p1').getAttribute('fill')).toBe('#fff');
    expect(span.querySelector('circle').getAttribute('fill')).toBe('red');
    expect(window.__pwned).toBeUndefined();
  });

  it('leaves the span untouched when the SVG fails to parse', async () => {
    const span = await decorate('twitter', '<svg><unclosed></svg');
    expect(span.querySelector('parsererror')).toBeNull();
    expect(span.querySelector('svg')).toBeNull();
    expect(span.innerHTML).toBe('');
  });

  ICONS.forEach((name) => {
    it(`renders the real ${name}.svg identically to the previous innerHTML approach`, async () => {
      const raw = readIcon(name);
      const oldRoot = new DOMParser().parseFromString(raw, 'image/svg+xml').documentElement;
      const legacy = document.createElement('span');
      legacy.innerHTML = oldRoot.outerHTML;

      const span = await decorate(name, raw);

      expect(span.querySelector('svg')).not.toBeNull();
      expect(span.innerHTML).toBe(legacy.innerHTML);
    });
  });
});

describe('buildBlock', () => {
  it('builds the expected structure for empty string content', () => {
    const block = buildBlock('header', '');
    expect(block.outerHTML).toBe('<div class="header"><div><div></div></div></div>');
  });

  it('inserts string content as text, not HTML', () => {
    const block = buildBlock('x', '<img src=x onerror="window.__pwned=1"><b>hi</b>');
    const col = block.firstElementChild.firstElementChild;
    expect(col.querySelector('img, b')).toBeNull();
    expect(col.textContent).toBe('<img src=x onerror="window.__pwned=1"><b>hi</b>');
  });

  it('appends Node values and handles 2d arrays', () => {
    const el = document.createElement('p');
    const block = buildBlock('x', [[el, 'text'], ['']]);
    const rows = block.children;
    expect(rows).toHaveLength(2);
    expect(rows[0].children[0].firstElementChild).toBe(el);
    expect(rows[0].children[1].textContent).toBe('text');
    expect(rows[1].children[0].childNodes).toHaveLength(0);
  });

  it('supports col.elems', () => {
    const a = document.createElement('i');
    const b = document.createElement('u');
    const block = buildBlock('x', [[{ elems: [a, b] }]]);
    expect(block.querySelector('div > div > div').children).toHaveLength(2);
  });
});
