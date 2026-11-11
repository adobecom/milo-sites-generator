import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import decorate from '../header.js';

const {
  navInit, searchInit, navCtor, searchCtor, placeholders, state,
} = vi.hoisted(() => ({
  navInit: vi.fn(),
  searchInit: vi.fn(),
  navCtor: vi.fn(),
  searchCtor: vi.fn(),
  placeholders: { searchpagepath: '/search' },
  state: { fragment: null },
}));

vi.mock('nsw-design-system/dist/js/main.js', () => ({
  default: {
    Navigation: class {
      constructor(el) { navCtor(el); }

      init() { navInit(); }
    },
    SiteSearch: class {
      constructor(el) { searchCtor(el); }

      init() { searchInit(); }
    },
  },
}));

vi.mock('../../../scripts/aem.js', () => ({
  getMetadata: vi.fn(() => ''),
  fetchPlaceholders: vi.fn(async () => placeholders),
}));

vi.mock('../../content-fragment/content-fragment.js', () => ({
  loadFragment: vi.fn(async () => state.fragment),
}));

const MASTHEAD = '<p>An official website of the <a href="https://www.nsw.gov.au">NSW Government</a></p>';

const HEADER = `
  <div class="default-content-wrapper">
    <p><picture><source srcset="/logo.webp" type="image/webp"><img src="/logo.png" alt="NSW Government" width="10" height="20"></picture></p>
    <p>Site <em>title</em></p>
    <p>Site subtitle</p>
  </div>`;

const NAV = `
  <div class="default-content-wrapper">
    <h2><a href="/home">Home</a></h2>
    <h2>Plain heading</h2>
    <h2><a href="/services">Services</a></h2>
    <p>All the services</p>
    <ul>
      <li><a href="/services/a">Service A</a></li>
      <li><a href="/services/b">Service B</a>
        <ul>
          <li><a href="/services/b/one">B one</a></li>
          <li><a href="/services/b/two">B two</a></li>
        </ul>
      </li>
    </ul>
  </div>`;

function buildFragment({
  masthead = MASTHEAD, header = HEADER, nav = NAV,
} = {}) {
  const main = document.createElement('main');
  const sections = [];
  if (masthead !== null) sections.push(`<div><div class="default-content-wrapper">${masthead}</div></div>`);
  sections.push(`<div>${header}</div>`);
  sections.push(`<div>${nav}</div>`);
  main.innerHTML = sections.join('');
  return main;
}

// Whitespace-insensitive, attribute-order-insensitive serialisation.
function normalized(node) {
  const clone = node.cloneNode(true);
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  const empties = [];
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    t.nodeValue = t.nodeValue.replace(/\s+/g, ' ').trim();
    if (!t.nodeValue) empties.push(t);
  }
  empties.forEach((t) => t.remove());
  clone.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((a) => { el.removeAttribute(a.name); el.setAttribute(a.name, a.value); });
  });
  return clone.innerHTML;
}

async function render(opts) {
  state.fragment = buildFragment(opts);
  const block = document.createElement('div');
  document.body.append(block);
  await decorate(block);
  return block;
}

// Rendered by the original template-string implementation (ids restart at 1 per module load).
const EXPECTED_HTML = [
  '<nav aria-label="Skip to links" class="nsw-skip">',
  '<a href="#main-nav">',
  '<span>Skip to navigation</span>',
  '</a>',
  '<a href="#">',
  '<span>Skip to content</span>',
  '</a>',
  '</nav>',
  '<div class="nsw-masthead">',
  '<div class="nsw-container">An official website of the<a href="https://www.nsw.gov.au">NSW Government</a>',
  '</div>',
  '</div>',
  '<div class="nsw-header">',
  '<div class="nsw-header__container">',
  '<div class="nsw-header__inner">',
  '<div class="nsw-header__main">',
  '<div class="nsw-header__waratah">',
  '<a href="/">',
  '<picture>',
  '<source srcset="/logo.webp" type="image/webp">',
  '<img alt="NSW Government" height="20" src="/logo.png" width="10">',
  '</picture>',
  '<span class="sr-only">NSW Government</span>',
  '</a>',
  '</div>',
  '<div class="nsw-header__name">',
  '<div class="nsw-header__title">Site<em>title</em>',
  '</div>',
  '<div class="nsw-header__subtitle">Site subtitle</div>',
  '</div>',
  '</div>',
  '<div class="nsw-header__menu">',
  '<button aria-controls="main-nav" aria-expanded="false" class="js-open-nav" type="button">',
  '<span aria-hidden="true" class="material-icons nsw-material-icons" focusable="false">menu</span>',
  '<span>',
  '<span class="sr-only">Open</span>Menu</span>',
  '</button>',
  '</div>',
  '<div class="nsw-header__search">',
  '<button aria-controls="header-search" aria-expanded="false" class="js-open-search" type="button">',
  '<span aria-hidden="true" class="material-icons nsw-material-icons" focusable="false">search</span>',
  '<span>',
  '<span class="sr-only">Show</span>Search</span>',
  '</button>',
  '</div>',
  '</div>',
  '<div class="nsw-header__search-area js-search-area" hidden="" id="header-search">',
  '<form action="/search" role="search">',
  '<label class="sr-only" for="nsw-header-input">Search site for:</label>',
  '<input autocomplete="off" class="nsw-header__input js-search-input" id="nsw-header-input" name="q" type="text">',
  '<button aria-controls="header-search" class="nsw-icon-button nsw-icon-button--flex" type="submit">',
  '<span aria-hidden="true" class="material-icons nsw-material-icons" focusable="false">search</span>',
  '<span class="sr-only">Search</span>',
  '</button>',
  '</form>',
  '<button aria-controls="header-search" aria-expanded="true" class="nsw-icon-button js-close-search">',
  '<span aria-hidden="true" class="material-icons nsw-material-icons" focusable="false">close</span>',
  '<span class="sr-only">Close search</span>',
  '</button>',
  '</div>',
  '</div>',
  '</div>',
  '<nav aria-label="Main menu" class="nsw-main-nav js-mega-menu" id="main-nav">',
  '<div class="nsw-main-nav__header">',
  '<div class="nsw-main-nav__title">Menu</div>',
  '<button aria-expanded="true" class="nsw-icon-button js-close-nav" type="button">',
  '<span aria-hidden="true" class="material-icons nsw-material-icons" focusable="false">close</span>',
  '<span class="sr-only">Close Menu</span>',
  '</button>',
  '</div>',
  '<ul class="nsw-main-nav__list">',
  '<li>',
  '<a href="http://localhost:3000/home">',
  '<span>Home</span>',
  '</a>',
  '</li>',
  '<li>',
  '<span>Plain heading</span>',
  '</li>',
  '<li>',
  '<a aria-controls="sub-nav-3" aria-expanded="false" href="http://localhost:3000/services" role="button">',
  '<span>Services</span>',
  '<span aria-hidden="true" class="material-icons nsw-material-icons" focusable="false">keyboard_arrow_right</span>',
  '</a>',
  '<div aria-label="Services Submenu" class="nsw-main-nav__sub-nav" id="sub-nav-3" role="region">',
  '<div class="nsw-main-nav__header">',
  '<button aria-controls="sub-nav-3" aria-expanded="true" class="nsw-icon-button nsw-icon-button--flex js-close-sub-nav" type="button">',
  '<span aria-hidden="true" class="material-icons nsw-material-icons" focusable="false">keyboard_arrow_left</span>',
  '<span>Back<span class="sr-only">to previous menu</span>',
  '</span>',
  '</button>',
  '<button aria-expanded="true" class="nsw-icon-button js-close-nav" type="button">',
  '<span aria-hidden="true" class="material-icons nsw-material-icons" focusable="false">close</span>',
  '<span class="sr-only">Close Menu</span>',
  '</button>',
  '</div>',
  '<div class="nsw-main-nav__title">',
  '<a href="http://localhost:3000/services">',
  '<span>Services</span>',
  '<span aria-hidden="true" class="material-icons nsw-material-icons" focusable="false">east</span>',
  '</a>',
  '</div>',
  '<div class="nsw-main-nav__description">All the services</div>',
  '<ul class="nsw-main-nav__sub-list">',
  '<li>',
  '<a aria-controls="sub-nav-4" aria-expanded="false" href="http://localhost:3000/services/a" role="button">',
  '<span>Service A</span>',
  '</a>',
  '</li>',
  '<li>',
  '<a aria-controls="sub-nav-5" aria-expanded="false" href="http://localhost:3000/services/b" role="button">',
  '<span>Service B</span>',
  '<span aria-hidden="true" class="material-icons nsw-material-icons" focusable="false">keyboard_arrow_right</span>',
  '</a>',
  '<div aria-label="Service B Submenu" class="nsw-main-nav__sub-nav" id="sub-nav-5" role="region">',
  '<div class="nsw-main-nav__header">',
  '<button aria-controls="sub-nav-5" aria-expanded="true" class="nsw-icon-button nsw-icon-button--flex js-close-sub-nav" type="button">',
  '<span aria-hidden="true" class="material-icons nsw-material-icons" focusable="false">keyboard_arrow_left</span>',
  '<span>Back<span class="sr-only">to previous menu</span>',
  '</span>',
  '</button>',
  '<button aria-expanded="true" class="nsw-icon-button js-close-nav" type="button">',
  '<span aria-hidden="true" class="material-icons nsw-material-icons" focusable="false">close</span>',
  '<span class="sr-only">Close Menu</span>',
  '</button>',
  '</div>',
  '<div class="nsw-main-nav__title">',
  '<a href="http://localhost:3000/services/b">',
  '<span>Service B</span>',
  '</a>',
  '</div>',
  '<ul class="nsw-main-nav__sub-list">',
  '<li>',
  '<a href="http://localhost:3000/services/b/one">',
  '<span>B one</span>',
  '</a>',
  '</li>',
  '<li>',
  '<a href="http://localhost:3000/services/b/two">',
  '<span>B two</span>',
  '</a>',
  '</li>',
  '</ul>',
  '</div>',
  '</li>',
  '</ul>',
  '</div>',
  '</li>',
  '</ul>',
  '</nav>',
].join('');

describe('header block', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete window.__xss;
    placeholders.searchpagepath = '/search';
    navInit.mockClear();
    searchInit.mockClear();
    navCtor.mockClear();
    searchCtor.mockClear();
  });

  describe('structure', () => {
    it('matches the reference rendering', async () => {
      const block = await render();
      expect(normalized(block)).toBe(EXPECTED_HTML);
    });

    it('renders skip links, masthead, header main and search area', async () => {
      const block = await render();
      expect(block.querySelectorAll('.nsw-skip a')).toHaveLength(2);
      expect(block.querySelector('.nsw-masthead .nsw-container a').getAttribute('href')).toBe('https://www.nsw.gov.au');
      expect(block.querySelector('.nsw-header .nsw-header__main .nsw-header__waratah a[href="/"] picture img').getAttribute('src')).toBe('/logo.png');
      expect(block.querySelector('.nsw-header__title').innerHTML).toBe('Site <em>title</em>');
      expect(block.querySelector('.nsw-header__subtitle').textContent).toBe('Site subtitle');
      expect(block.querySelector('.nsw-header__search-area form[action="/search"] input[name="q"]')).not.toBeNull();
    });

    it('omits masthead container and subtitle when absent', async () => {
      const header = '<div class="default-content-wrapper"><p><picture><img src="/l.png" alt=""></picture></p><p>T</p></div>';
      const block = await render({ masthead: null, header });
      expect(block.querySelector('.nsw-masthead').children).toHaveLength(0);
      expect(block.querySelector('.nsw-header__subtitle')).toBeNull();
    });

    it('renders navigation items and sub navs with ids and aria attributes', async () => {
      const block = await render();
      const items = block.querySelectorAll('#main-nav > ul.nsw-main-nav__list > li');
      expect(items).toHaveLength(3);
      expect(items[0].querySelector('a').getAttribute('href')).toMatch(/\/home$/);
      expect(items[1].querySelector('a')).toBeNull();
      expect(items[1].textContent.trim()).toBe('Plain heading');

      const top = items[2].querySelector(':scope > a');
      const subNav = items[2].querySelector(':scope > .nsw-main-nav__sub-nav');
      expect(top.getAttribute('role')).toBe('button');
      expect(top.getAttribute('aria-controls')).toBe(subNav.id);
      expect(subNav.getAttribute('aria-label')).toBe('Services Submenu');
      expect(subNav.querySelector('.nsw-main-nav__description').textContent).toBe('All the services');
      const subLis = subNav.querySelectorAll(':scope > .nsw-main-nav__sub-list > li');
      expect(subLis).toHaveLength(2);
      const nested = subLis[1].querySelector('.nsw-main-nav__sub-nav');
      expect(nested.getAttribute('aria-label')).toBe('Service B Submenu');
      expect(nested.querySelectorAll(':scope > .nsw-main-nav__sub-list > li > a')).toHaveLength(2);
      expect(subLis[0].querySelector('.nsw-main-nav__sub-nav')).toBeNull();
    });

    it('initialises Navigation and SiteSearch', async () => {
      const block = await render();
      expect(navCtor).toHaveBeenCalledWith(block.querySelector('#main-nav'));
      expect(navInit).toHaveBeenCalledTimes(1);
      expect(searchCtor).toHaveBeenCalledTimes(2);
      expect(searchInit).toHaveBeenCalledTimes(2);
    });
  });

  describe('security', () => {
    it('strips event handlers from authored title markup', async () => {
      const header = HEADER.replace('Site <em>title</em>', '<img src=x onerror=window.__xss=1>');
      const block = await render({ header });
      expect(block.querySelector('.nsw-header__title img')).not.toBeNull();
      expect(block.querySelector('[onerror]')).toBeNull();
    });

    it('does not render javascript: nav links', async () => {
      const nav = `
        <div class="default-content-wrapper">
          <h2><a href="javascript:alert(1)">Evil</a></h2>
          <h2><a href="javascript:alert(2)">Evil menu</a></h2>
          <ul><li><a href="javascript:alert(3)">Evil child</a></li></ul>
        </div>`;
      const block = await render({ nav });
      const hrefs = Array.from(block.querySelectorAll('#main-nav a')).map((a) => a.getAttribute('href') || '');
      expect(hrefs.some((h) => h.toLowerCase().startsWith('javascript:'))).toBe(false);
      expect(block.querySelector('#main-nav').textContent).toContain('Evil child');
    });

    it('falls back to /search for an attribute-breaking search path', async () => {
      placeholders.searchpagepath = '\'><img src=x onerror=1>';
      const block = await render();
      expect(block.querySelector('form').getAttribute('action')).toBe('/search');
      expect(block.querySelector('.nsw-header__search-area img')).toBeNull();
      expect(block.querySelector('[onerror]')).toBeNull();
    });

    it('falls back to /search for a javascript: search path', async () => {
      placeholders.searchpagepath = 'javascript:alert(1)';
      const block = await render();
      expect(block.querySelector('form').getAttribute('action')).toBe('/search');
    });

    it('does not render script elements from masthead content', async () => {
      const masthead = '<p>Hi <script>window.__xss=1</script><a href="/ok">ok</a></p>';
      const block = await render({ masthead });
      expect(block.querySelector('script')).toBeNull();
      expect(block.querySelector('.nsw-masthead a[href="/ok"]')).not.toBeNull();
    });

    it('treats nav titles and descriptions as plain text', async () => {
      const nav = `
        <div class="default-content-wrapper">
          <h2><a href="/s">&lt;b&gt;x&lt;/b&gt;</a></h2>
          <p>&lt;i&gt;d&lt;/i&gt;</p>
          <ul><li><a href="/a">a</a></li></ul>
        </div>`;
      const block = await render({ nav });
      expect(block.querySelector('#main-nav b')).toBeNull();
      expect(block.querySelector('#main-nav i')).toBeNull();
      expect(block.querySelector('#main-nav li > a > span').textContent).toBe('<b>x</b>');
      expect(block.querySelector('.nsw-main-nav__description').textContent).toBe('<i>d</i>');
    });
  });
});
