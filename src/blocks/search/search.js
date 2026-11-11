import 'nsw-design-system/src/components/list-item/_list-item.scss';
import 'nsw-design-system/src/components/form/_form.scss';
import './search.css';

import { fetchPlaceholders } from '../../scripts/aem.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value, window.location.href);
    return protocol === 'http:' || protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function renderNoResults() {
  const frag = document.createDocumentFragment();
  frag.append(el('div', 'nsw-results-bar__info', 'Sorry, no results found for your search'));

  const tips = el('div', 'error-message');
  const list = el('ul');
  [
    'Try using different or fewer keywords ',
    'Check your spelling',
    'Try broader or general search terms',
  ].forEach((tip) => list.append(el('li', '', tip)));
  tips.append(el('h4', '', 'Didn’t find what you were looking for?'), list);

  const contact = el('div', 'error-message');
  const mail = el('a', '', 'help@customerservice.nsw.gov.au');
  mail.href = 'mailto:help@customerservice.nsw.gov.au';
  const paragraph = el('p', '', 'Call 13 33 33 to find your local office or email ');
  paragraph.append(mail, '. ');
  contact.append(el('h4', '', 'Contact us'), paragraph);

  frag.append(tips, contact);
  return frag;
}

function renderResult(element) {
  const title = el('div', 'nsw-list-item__title');
  if (isHttpUrl(element.url)) {
    const link = el('a', '', element.title);
    link.href = element.url;
    title.append(link);
  } else {
    title.textContent = element.title;
  }

  const content = el('div', 'nsw-list-item__content');
  content.append(
    title,
    el('div', 'nsw-list-item__link', element.url),
    el('div', 'nsw-list-item__copy', element.content),
  );
  const item = el('li', 'nsw-list-item');
  item.append(content);
  return item;
}

// render the search results block
async function renderSearchBlock(block, parameter) {
  const placeholders = await fetchPlaceholders();
  let url = placeholders.searchurl;
  if (parameter !== '') {
    url += `&query=+${encodeURIComponent(parameter)}`;
  }
  const resultsContainer = block.querySelector('.nsw-search-results');
  const list = el('ol');
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    if (data.results.length === 0) {
      resultsContainer.replaceChildren(renderNoResults());
      return;
    }
    data.results.forEach((element) => list.append(renderResult(element)));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching data:', error);
  }

  resultsContainer.replaceChildren(list);
}

/**
 * loads and decorates the search
 * @param {Element} block The search block element
 */
export default async function decorate(block) {
  const container = el('div', 'searchlist-container');

  // read searchparameter from the url
  const params = new URL(window.location.href).searchParams;
  const searchParams = params.get('q')?.trim() || '';

  const label = el('label', 'sr-only', 'Search');
  label.htmlFor = 'search-input';

  const input = el('input', 'nsw-form__input');
  input.type = 'text';
  input.id = 'searchInput';
  input.name = 'search-input';
  input.value = searchParams;

  const button = el('button', 'nsw-button nsw-button--dark nsw-button--flex', 'Search');
  button.type = 'submit';

  const inputGroup = el('div', 'nsw-form__input-group');
  inputGroup.append(label, input, button);

  const form = el('form');
  form.id = 'searchForm';
  form.append(inputGroup);

  container.append(el('h1', '', ' Search '), form, el('div', 'nsw-search-results'));
  block.append(container);

  // bind the onclick event for form submit
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    renderSearchBlock(block, input.value);
  });

  renderSearchBlock(block, searchParams);
}
