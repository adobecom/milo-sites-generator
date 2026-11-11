import nsw from 'nsw-design-system/dist/js/main.js';
import { getMetadata, fetchPlaceholders } from '../../scripts/aem.js';
import { loadFragment } from '../content-fragment/content-fragment.js';
import { isSafeUrl, sanitizeNode } from '../../scripts/safe-dom.js';

import 'nsw-design-system/src/components/main-nav/_main-nav.scss';
import 'nsw-design-system/src/components/header/_header.scss';
import 'nsw-design-system/src/components/masthead/_masthead.scss';

import './header.scss';

const SEARCH_PLACEHOLDER_KEY = 'searchpagepath';

// Helper Functions
let idCounter = 0;
function generateId() {
  idCounter += 1;
  return idCounter;
}

const DEFAULT_SEARCH_PATH = '/search';

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([name, value]) => {
    if (value === true) el.setAttribute(name, '');
    else if (value !== false && value != null) el.setAttribute(name, String(value));
  });
  el.append(...children.filter((child) => child != null && child !== false));
  return el;
}

// Only set a URL attribute when it passes the protocol check.
function link(href, attrs = {}, ...children) {
  const a = h('a', attrs, ...children);
  if (isSafeUrl(href)) a.setAttribute('href', href);
  return a;
}

function icon(name) {
  return h('span', {
    class: 'material-icons nsw-material-icons', focusable: 'false', 'aria-hidden': 'true',
  }, name);
}

function srOnly(text) {
  return h('span', { class: 'sr-only' }, text);
}

// Copies authored nodes (never serialises them) and strips active content.
function cloneSanitized(nodes) {
  const holder = document.createElement('div');
  nodes.forEach((node) => holder.append(node.cloneNode(true)));
  return Array.from(sanitizeNode(holder).childNodes);
}

function resolveSearchPath(value) {
  const valid = typeof value === 'string' && !/[\s<>"'`]/.test(value) && isSafeUrl(value);
  return valid ? value : DEFAULT_SEARCH_PATH;
}

function createMastheadSection(mastheadSource) {
  const masthead = h('div', { class: 'nsw-masthead' });
  if (mastheadSource?.childNodes.length) {
    masthead.append(h('div', { class: 'nsw-container' }, ...cloneSanitized(Array.from(mastheadSource.childNodes))));
  }
  return masthead;
}

function createHeaderMain(headerDom) {
  const picture = headerDom?.querySelector('picture');
  const title = headerDom?.children?.[1];
  const subtitle = headerDom?.children?.[2];

  return h(
    'div',
    { class: 'nsw-header__main' },
    h(
      'div',
      { class: 'nsw-header__waratah' },
      h(
        'a',
        { href: '/' },
        ...(picture ? cloneSanitized([picture]) : []),
        srOnly('NSW Government'),
      ),
    ),
    h(
      'div',
      { class: 'nsw-header__name' },
      h('div', { class: 'nsw-header__title' }, ...(title ? cloneSanitized(Array.from(title.childNodes)) : [])),
      subtitle && h('div', { class: 'nsw-header__subtitle' }, ...cloneSanitized(Array.from(subtitle.childNodes))),
    ),
  );
}

function createHeaderControls() {
  return [
    h(
      'div',
      { class: 'nsw-header__menu' },
      h(
        'button',
        {
          type: 'button', class: 'js-open-nav', 'aria-expanded': 'false', 'aria-controls': 'main-nav',
        },
        icon('menu'),
        h('span', {}, srOnly('Open'), ' Menu'),
      ),
    ),
    h(
      'div',
      { class: 'nsw-header__search' },
      h(
        'button',
        {
          type: 'button', class: 'js-open-search', 'aria-expanded': 'false', 'aria-controls': 'header-search',
        },
        icon('search'),
        h('span', {}, srOnly('Show'), ' Search'),
      ),
    ),
  ];
}

function createSearchArea(searchPagePath) {
  return h(
    'div',
    { class: 'nsw-header__search-area js-search-area', id: 'header-search', hidden: true },
    h(
      'form',
      { role: 'search', action: resolveSearchPath(searchPagePath) },
      h('label', { for: 'nsw-header-input', class: 'sr-only' }, 'Search site for:'),
      h('input', {
        class: 'nsw-header__input js-search-input', type: 'text', autocomplete: 'off', id: 'nsw-header-input', name: 'q',
      }),
      h(
        'button',
        { class: 'nsw-icon-button nsw-icon-button--flex', type: 'submit', 'aria-controls': 'header-search' },
        icon('search'),
        srOnly('Search'),
      ),
    ),
    h(
      'button',
      {
        class: 'nsw-icon-button js-close-search', 'aria-expanded': 'true', 'aria-controls': 'header-search',
      },
      icon('close'),
      srOnly('Close search'),
    ),
  );
}

function createHeaderSection(headerDom, searchPagePath) {
  return h(
    'div',
    { class: 'nsw-header' },
    h(
      'div',
      { class: 'nsw-header__container' },
      h('div', { class: 'nsw-header__inner' }, createHeaderMain(headerDom), ...createHeaderControls()),
      createSearchArea(searchPagePath),
    ),
  );
}

// Navigation Functions
function parseNavigationList(ulElement) {
  return Array.from(ulElement.children).map((li) => {
    const anchor = li.querySelector('a');
    const item = {
      id: generateId(),
      text: anchor ? anchor.textContent.trim() : '',
      href: anchor ? anchor.href : '',
      subItems: [],
    };

    const sublist = li.querySelector('ul');
    if (sublist) {
      item.subItems = parseNavigationList(sublist);
    }

    return item;
  });
}

function parseNavigationStructure(elements) {
  const navigationArr = [];
  let currentSection = null;

  elements.forEach((el) => {
    if (/^H[1-6]$/.test(el.tagName)) {
      const anchor = el.querySelector('a');
      currentSection = {
        id: generateId(),
        title: anchor ? anchor.textContent.trim() : el.textContent.trim(),
        titleHref: anchor ? anchor.href : '',
        description: '',
        links: [],
      };
      navigationArr.push(currentSection);
    } else if (currentSection && el.tagName === 'P') {
      currentSection.description = el.textContent.trim();
    } else if (currentSection && el.tagName === 'UL') {
      currentSection.links = parseNavigationList(el);
    }
  });

  return navigationArr;
}

function createCloseNavButton() {
  return h(
    'button',
    { class: 'nsw-icon-button js-close-nav', type: 'button', 'aria-expanded': 'true' },
    icon('close'),
    srOnly('Close Menu'),
  );
}

function createSubNavHeader(subNavId) {
  return h(
    'div',
    { class: 'nsw-main-nav__header' },
    h(
      'button',
      {
        class: 'nsw-icon-button nsw-icon-button--flex js-close-sub-nav',
        type: 'button',
        'aria-expanded': 'true',
        'aria-controls': subNavId,
      },
      icon('keyboard_arrow_left'),
      h('span', {}, 'Back', srOnly(' to previous menu')),
    ),
    createCloseNavButton(),
  );
}

function createSubNavigation(subItem) {
  if (!subItem.subItems.length) return null;

  const subNavId = `sub-nav-${subItem.id}`;
  return h(
    'div',
    {
      class: 'nsw-main-nav__sub-nav', role: 'region', 'aria-label': `${subItem.text} Submenu`, id: subNavId,
    },
    createSubNavHeader(subNavId),
    h('div', { class: 'nsw-main-nav__title' }, link(subItem.href, {}, h('span', {}, subItem.text))),
    h(
      'ul',
      { class: 'nsw-main-nav__sub-list' },
      ...subItem.subItems.map((subChild) => h('li', {}, link(subChild.href, {}, h('span', {}, subChild.text)))),
    ),
  );
}

function createNavigationItem(item) {
  if (!item.links.length) {
    return h('li', {}, item.titleHref ? link(item.titleHref, {}, h('span', {}, item.title)) : h('span', {}, item.title));
  }

  const subNavId = `sub-nav-${item.id}`;
  return h(
    'li',
    {},
    link(
      item.titleHref,
      { role: 'button', 'aria-expanded': 'false', 'aria-controls': subNavId },
      h('span', {}, item.title),
      icon('keyboard_arrow_right'),
    ),
    h(
      'div',
      {
        class: 'nsw-main-nav__sub-nav', role: 'region', 'aria-label': `${item.title} Submenu`, id: subNavId,
      },
      createSubNavHeader(subNavId),
      h(
        'div',
        { class: 'nsw-main-nav__title' },
        item.titleHref
          ? link(item.titleHref, {}, h('span', {}, item.title), icon('east'))
          : h('span', {}, item.title),
      ),
      h('div', { class: 'nsw-main-nav__description' }, item.description || ''),
      h(
        'ul',
        { class: 'nsw-main-nav__sub-list' },
        ...item.links.map((subItem) => h(
          'li',
          {},
          link(
            subItem.href,
            { role: 'button', 'aria-expanded': 'false', 'aria-controls': `sub-nav-${subItem.id}` },
            h('span', {}, subItem.text),
            subItem.subItems.length ? icon('keyboard_arrow_right') : null,
          ),
          createSubNavigation(subItem),
        )),
      ),
    ),
  );
}

function createNavigationMenu(navigationArr) {
  return h(
    'nav',
    { class: 'nsw-main-nav js-mega-menu', id: 'main-nav', 'aria-label': 'Main menu' },
    h('div', { class: 'nsw-main-nav__header' }, h('div', { class: 'nsw-main-nav__title' }, 'Menu'), createCloseNavButton()),
    h('ul', { class: 'nsw-main-nav__list' }, ...navigationArr.map(createNavigationItem)),
  );
}

function createSkipLinks() {
  return h(
    'nav',
    { class: 'nsw-skip', 'aria-label': 'Skip to links' },
    h('a', { href: '#main-nav' }, h('span', {}, 'Skip to navigation')),
    h('a', { href: '#' }, h('span', {}, 'Skip to content')),
  );
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  // Load navigation fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // Get header sections and search path
  const headerSections = Array.from(fragment.children);
  const response = await fetchPlaceholders();
  const searchPagePath = response?.[SEARCH_PLACEHOLDER_KEY] || '/search';

  // Because the Masthead is the first section, and it is optional,
  // the amount of sections will vary between 2 and 3.
  const headerDom = headerSections.length === 3
    ? headerSections[1]?.querySelector('.default-content-wrapper')
    : headerSections[0]?.querySelector('.default-content-wrapper');

  const navDom = headerSections.length === 3
    ? headerSections[2]?.querySelector('.default-content-wrapper')
    : headerSections[1]?.querySelector('.default-content-wrapper');

  if (!navDom) return;

  // Masthead source paragraph (optional, only present with 3 sections)
  const mastheadSource = headerSections.length === 3
    ? headerSections[0].querySelector('p')
    : null;

  // Parse navigation structure
  const navigationArr = parseNavigationStructure(Array.from(navDom.children));

  // Update DOM and initialize components
  block.replaceChildren(
    createSkipLinks(),
    createMastheadSection(mastheadSource),
    createHeaderSection(headerDom, searchPagePath),
    createNavigationMenu(navigationArr),
  );
  new nsw.Navigation(block.querySelector('#main-nav')).init();
  block.querySelectorAll('button.js-open-search, button.js-close-search').forEach((button) => {
    new nsw.SiteSearch(button).init();
  });
}
