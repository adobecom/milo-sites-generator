import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import decorate, { loadFragment } from '../content-fragment.js';

vi.mock('../../../scripts/scripts.js', () => ({ decorateMain: vi.fn() }));
vi.mock('../../../scripts/aem.js', () => ({ loadSections: vi.fn(async () => {}) }));

const okResponse = (text) => ({ ok: true, text: async () => text });

describe('content-fragment', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn(async () => okResponse('<div class="section"><p>hi</p></div>'));
    vi.stubGlobal('fetch', fetchMock);
    delete window.__xss;
    delete window.__xss2;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('loadFragment origin guard', () => {
    it.each([
      ['protocol-relative', '//evil.com/x'],
      ['backslash', '/\\evil.com/x'],
      ['tab inside slashes', '/\t/evil.com/x'],
      ['slashes created by .html normalisation', '/.html/evil.com/x'],
      ['absolute https', 'https://evil.com/x'],
      ['javascript scheme', 'javascript:alert(1)'],
      ['empty', ''],
      ['non-string', undefined],
    ])('rejects %s path without fetching', async (_, path) => {
      expect(await loadFragment(path)).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('loadFragment same-origin', () => {
    it('fetches the .plain.html and returns a main with parsed nodes', async () => {
      const main = await loadFragment('/fragments/foo');
      expect(fetchMock).toHaveBeenCalledWith('/fragments/foo.plain.html');
      expect(main.tagName).toBe('MAIN');
      expect(main.children).toHaveLength(1);
      expect(main.querySelector('div.section > p').textContent).toBe('hi');
    });

    it.each([
      ['/nav.plain.html', '/nav.plain.html'],
      ['/nav', '/nav.plain.html'],
      ['/a/b.html', '/a/b.plain.html'],
    ])('normalises %s to %s', async (path, expected) => {
      await loadFragment(path);
      expect(fetchMock).toHaveBeenCalledWith(expected);
    });

    it('returns null when the response is not ok', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false });
      expect(await loadFragment('/fragments/foo')).toBeNull();
    });

    it('does not execute scripts or event handlers from the response', async () => {
      fetchMock.mockResolvedValueOnce(okResponse(
        '<div><img src=x onerror="window.__xss=1"></div><script>window.__xss2=1</script>',
      ));
      const main = await loadFragment('/fragments/foo');
      await new Promise((resolve) => { setTimeout(resolve, 20); });
      expect(window.__xss2).toBeUndefined();
      expect(window.__xss).toBeUndefined();
      expect(main.querySelector('img')).not.toBeNull();
    });

    it('strips event handlers and unsafe urls from the fetched markup', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(
      '<div><img src=x onerror="window.__xss=1"><a href="javascript:window.__xss=1">x</a><a href="/ok">ok</a></div>',
    ));
    const main = await loadFragment('/fragments/foo');
    expect(main.querySelector('[onerror]')).toBeNull();
    expect(main.querySelector('a[href^="javascript"]')).toBeNull();
    expect(main.querySelector('a[href="/ok"]')).not.toBeNull();
  });

  it('rewrites ./media_ urls to absolute urls based on the fragment path', async () => {
      fetchMock.mockResolvedValueOnce(okResponse('<div><img src="./media_abc.png"></div>'));
      const main = await loadFragment('/fragments/foo');
      expect(main.querySelector('img').src)
        .toBe(`${window.location.origin}/fragments/media_abc.png`);
    });
  });

  describe('decorate', () => {
    it('replaces block children with the fragment section and copies classes', async () => {
      fetchMock.mockResolvedValueOnce(okResponse('<div class="section dark"><p>hi</p></div>'));
      const block = document.createElement('div');
      block.classList.add('content-fragment', 'section');
      block.innerHTML = '<div><a href="/fragments/foo">x</a></div>';
      await decorate(block);
      expect(fetchMock).toHaveBeenCalledWith('/fragments/foo.plain.html');
      expect(block.children).toHaveLength(1);
      expect(block.querySelector('p').textContent).toBe('hi');
      expect(block.classList.contains('dark')).toBe(true);
      expect(block.classList.contains('section')).toBe(false);
    });

    it('leaves the block untouched for a cross-origin link', async () => {
      const block = document.createElement('div');
      block.innerHTML = '<div><a href="//evil.com/x">x</a></div>';
      const before = block.innerHTML;
      await decorate(block);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(block.innerHTML).toBe(before);
    });
  });
});
