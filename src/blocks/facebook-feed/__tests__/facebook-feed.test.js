import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import decorate from '../facebook-feed.js';

vi.mock('../../../scripts/aem.js', () => ({
  fetchPlaceholders: vi.fn(async () => ({ facebookapi: 'https://example.test/fb' })),
}));

const IMG_PAYLOAD = '<img src=x onerror=window.__xss=1>';

function mockFetch(posts) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => [{ posts: JSON.stringify(posts) }],
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const post = (n, extra = {}) => ({
  id: `id${n}`,
  message: `message ${n}`,
  full_picture: `https://img.example.test/${n}.jpg`,
  ...extra,
});

async function render(posts) {
  const fetchMock = mockFetch(posts);
  const block = document.createElement('div');
  document.body.append(block);
  await decorate(block);
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
  return block;
}

async function renderCards(posts) {
  const block = await render(posts);
  await vi.waitFor(() => expect(block.querySelector('.nsw-card')).not.toBeNull());
  return block;
}

describe('facebook-feed', () => {
  beforeEach(() => {
    delete window.__xss;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders at most 3 cards with the expected structure', async () => {
    const block = await renderCards([post(1), post(2), post(3), post(4)]);
    const cols = block.querySelectorAll('.nsw-grid > .nsw-col.nsw-col-md-6.nsw-col-lg-4');
    expect(cols).toHaveLength(3);
    cols.forEach((col, i) => {
      const n = i + 1;
      const card = col.querySelector(':scope > .nsw-card.nsw-card--highlight');
      expect(card).not.toBeNull();
      const img = card.querySelector(':scope > .nsw-card__image > img');
      expect(img.getAttribute('src')).toBe(`https://img.example.test/${n}.jpg`);
      expect(img.getAttribute('alt')).toBe('Facebook post image');
      const content = card.querySelector(':scope > .nsw-card__content');
      const a = content.querySelector('.nsw-card__copy > p > a');
      expect(a.getAttribute('href')).toBe(`https://www.facebook.com/id${n}`);
      expect(a.textContent).toBe(`message ${n}`);
      expect(content.querySelector('.card-icon > svg')).not.toBeNull();
      expect(content.querySelector('span.material-icons')).not.toBeNull();
    });
  });

  it('renders an HTML message as inert text', async () => {
    const block = await renderCards([post(1, { message: IMG_PAYLOAD })]);
    const a = block.querySelector('.nsw-card__copy a');
    expect(a.textContent).toBe(IMG_PAYLOAD);
    expect(block.querySelectorAll('img')).toHaveLength(1);
    expect(block.querySelector('.nsw-card__image img')).not.toBeNull();
    expect(window.__xss).toBeUndefined();
  });

  it('encodes the post id in the href without adding attributes', async () => {
    const id = '1/../evil?x="onmouseover=1';
    const block = await renderCards([post(1, { id })]);
    const a = block.querySelector('.nsw-card__copy a');
    expect(a.getAttribute('href')).toBe(`https://www.facebook.com/${encodeURIComponent(id)}`);
    expect(a.getAttributeNames()).toEqual(['href']);
  });

  it('coerces a numeric post id', async () => {
    const block = await renderCards([post(1, { id: 12345 })]);
    expect(block.querySelector('.nsw-card__copy a').getAttribute('href'))
      .toBe('https://www.facebook.com/12345');
  });

  it('skips posts with non-http(s) pictures', async () => {
    const block = await renderCards([
      post(1, { full_picture: 'javascript:alert(1)' }), // eslint-disable-line no-script-url
      post(2, { full_picture: 'data:image/svg+xml,<svg onload=alert(1)>' }),
      post(3, { full_picture: 'not a url' }),
      post(4),
    ]);
    const imgs = block.querySelectorAll('.nsw-card__image img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute('src')).toBe('https://img.example.test/4.jpg');
    expect(block.querySelector('.nsw-card__copy a').textContent).toBe('message 4');
  });

  it('skips posts missing message or picture', async () => {
    const block = await renderCards([
      post(1, { message: '' }),
      post(2, { full_picture: undefined }),
      post(3),
    ]);
    const links = block.querySelectorAll('.nsw-card__copy a');
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe('message 3');
  });

  it('keeps the loading text when no post qualifies', async () => {
    const block = await render([post(1, { full_picture: 'javascript:alert(1)' })]); // eslint-disable-line no-script-url
    await new Promise((r) => { setTimeout(r, 20); });
    expect(block.querySelector('.nsw-card')).toBeNull();
    expect(block.textContent).toContain('Loading Facebook posts...');
  });

  it('keeps the loading text when the API returns no posts', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => [] }));
    vi.stubGlobal('fetch', fetchMock);
    const block = document.createElement('div');
    await expect(decorate(block)).resolves.toBeUndefined();
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(block.textContent).toContain('Loading Facebook posts...');
  });
});
