import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import decorate from '../search.js';

vi.mock('../../../scripts/aem.js', () => ({
  fetchPlaceholders: vi.fn(async () => ({ searchurl: 'https://example.test/api?x=1' })),
}));

const XSS_PAYLOAD = '"><img src=x onerror=window.__xss=1>';
const IMG_PAYLOAD = '<img src=x onerror=window.__xss=1>';

function mockFetch(results) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ results }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function render(query, results = []) {
  window.history.replaceState({}, '', query === undefined ? '/' : `/?q=${encodeURIComponent(query)}`);
  const fetchMock = mockFetch(results);
  const block = document.createElement('div');
  document.body.append(block);
  await decorate(block);
  await vi.waitFor(() => {
    if (!block.querySelector('.nsw-search-results').firstElementChild) throw new Error('pending');
  });
  return { block, fetchMock };
}

describe('search block', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.__xss;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not inject markup from the q parameter into the form', async () => {
    const { block } = await render(XSS_PAYLOAD);
    const form = block.querySelector('#searchForm');
    expect(form.querySelector('img')).toBeNull();
    expect(block.querySelector('img')).toBeNull();
    expect(document.getElementById('searchInput').value).toBe(XSS_PAYLOAD);
  });

  it('renders result title and content as inert text', async () => {
    const { block } = await render('x', [
      { title: IMG_PAYLOAD, url: 'https://example.test/a', content: IMG_PAYLOAD },
    ]);
    expect(block.querySelector('img')).toBeNull();
    expect(block.querySelector('.nsw-list-item__title a').textContent).toBe(IMG_PAYLOAD);
    expect(block.querySelector('.nsw-list-item__copy').textContent).toBe(IMG_PAYLOAD);
  });

  it('does not render a link for a javascript: url', async () => {
    const { block } = await render('x', [
      { title: 'Bad', url: 'javascript:alert(1)', content: 'c' },
    ]);
    expect(block.querySelector('a')).toBeNull();
    expect(block.querySelector('.nsw-list-item__title').textContent).toBe('Bad');
    expect(block.querySelector('.nsw-list-item__link').textContent).toBe('javascript:alert(1)');
  });

  it('renders a link for an https url with the same structure', async () => {
    const { block } = await render('x', [
      { title: 'Good', url: 'https://example.test/page', content: 'copy' },
    ]);
    const link = block.querySelector('ol > li.nsw-list-item .nsw-list-item__content .nsw-list-item__title a');
    expect(link.getAttribute('href')).toBe('https://example.test/page');
    expect(link.textContent).toBe('Good');
    expect(block.querySelector('.nsw-list-item__link').textContent).toBe('https://example.test/page');
    expect(block.querySelector('.nsw-list-item__copy').textContent).toBe('copy');
  });

  it('encodes the query in the fetch url', async () => {
    const { fetchMock } = await render('a&b c');
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/api?x=1&query=+a%26b%20c');
  });

  it('keeps the plain url when there is no query', async () => {
    const { fetchMock } = await render(undefined);
    expect(fetchMock).toHaveBeenCalledWith('https://example.test/api?x=1');
  });

  it('renders the no-results block for an empty results array', async () => {
    const { block } = await render('nothing', []);
    const results = block.querySelector('.nsw-search-results');
    expect([...results.children].map((c) => `${c.tagName}.${c.className}`)).toEqual([
      'DIV.nsw-results-bar__info',
      'DIV.error-message',
      'DIV.error-message',
    ]);
    expect(results.children[0].textContent).toBe('Sorry, no results found for your search');
    const [tips, contact] = [results.children[1], results.children[2]];
    expect(tips.querySelector('h4').textContent).toBe('Didn’t find what you were looking for?');
    expect(tips.querySelectorAll('ul > li')).toHaveLength(3);
    expect(contact.querySelector('h4').textContent).toBe('Contact us');
    expect(contact.querySelector('p').textContent).toContain('Call 13 33 33 to find your local office or email ');
    expect(contact.querySelector('p > a').getAttribute('href')).toBe('mailto:help@customerservice.nsw.gov.au');
    expect(contact.querySelector('p > a').textContent).toBe('help@customerservice.nsw.gov.au');
  });

  it('renders an empty list and does not throw when fetch fails', async () => {
    window.history.replaceState({}, '', '/?q=x');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network'); }));
    const block = document.createElement('div');
    document.body.append(block);
    await expect(decorate(block)).resolves.toBeUndefined();
    await vi.waitFor(() => {
      if (!block.querySelector('.nsw-search-results ol')) throw new Error('pending');
    });
    const ol = block.querySelector('.nsw-search-results ol');
    expect(ol.children).toHaveLength(0);
  });
});
