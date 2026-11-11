import { describe, it, expect } from 'vitest';
import { isSafeUrl, sanitizeNode } from './safe-dom.js';

function html(markup) {
  const root = document.createElement('div');
  root.innerHTML = markup;
  return root;
}

function svg(markup) {
  const root = document.createElement('div');
  root.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${markup}</svg>`;
  return root;
}

describe('isSafeUrl', () => {
  it.each([
    '/relative/path', 'relative.html', '#hash', '?q=1', '', 'https://example.com/a',
    'http://example.com', 'mailto:a@b.co', 'tel:+123456',
  ])('allows %s', (url) => {
    expect(isSafeUrl(url)).toBe(true);
  });

  it.each([
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)',
    'data:text/html,<script>1</script>', 'data:image/png;base64,AAAA', 'vbscript:msgbox(1)',
    'blob:https://example.com/x', 'http://[bad',
  ])('rejects %s', (url) => {
    expect(isSafeUrl(url)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
  });
});

describe('sanitizeNode', () => {
  it('returns the same root', () => {
    const root = html('<p>x</p>');
    expect(sanitizeNode(root)).toBe(root);
  });

  it('removes script, iframe, object, embed and style elements', () => {
    const root = html('<p>a</p><script>1</script><iframe src="/x"></iframe><object data="/x"></object><embed src="/x"><style>p{}</style>');
    sanitizeNode(root);
    expect(root.querySelector('script, iframe, object, embed, style')).toBeNull();
    expect(root.querySelector('p')).not.toBeNull();
  });

  it('removes event handler attributes', () => {
    const root = html('<img src="/a.png" onerror="x()" onclick="y()"><a href="/ok" onmouseover="z()">t</a>');
    sanitizeNode(root);
    expect(root.querySelector('[onerror], [onclick], [onmouseover]')).toBeNull();
    expect(root.querySelector('img').getAttribute('src')).toBe('/a.png');
  });

  it('removes javascript: and data: URL attributes', () => {
    const root = html('<a href="javascript:alert(1)">a</a><img src="data:image/svg+xml,<svg/>"><form action="javascript:1"><button formaction="vbscript:1">b</button></form>');
    sanitizeNode(root);
    expect(root.querySelector('a').hasAttribute('href')).toBe(false);
    expect(root.querySelector('img').hasAttribute('src')).toBe(false);
    expect(root.querySelector('form').hasAttribute('action')).toBe(false);
    expect(root.querySelector('button').hasAttribute('formaction')).toBe(false);
  });

  it('leaves safe links untouched', () => {
    const root = html('<a href="/a">a</a><a href="https://example.com/b">b</a><a href="mailto:x@y.co">m</a><a href="tel:+1">t</a>');
    sanitizeNode(root);
    expect(Array.from(root.querySelectorAll('a')).map((a) => a.getAttribute('href')))
      .toEqual(['/a', 'https://example.com/b', 'mailto:x@y.co', 'tel:+1']);
  });

  it('keeps picture, source and srcset', () => {
    const root = html('<picture><source srcset="/a.webp 1x, https://example.com/b.webp 2x" type="image/webp"><img src="/a.png" alt="x"></picture>');
    sanitizeNode(root);
    expect(root.querySelector('source').getAttribute('srcset')).toBe('/a.webp 1x, https://example.com/b.webp 2x');
    expect(root.querySelector('img').getAttribute('src')).toBe('/a.png');
  });

  it('removes srcset when any candidate is unsafe', () => {
    const root = html('<img srcset="/a.png 1x, javascript:alert(1) 2x" src="/a.png">');
    sanitizeNode(root);
    expect(root.querySelector('img').hasAttribute('srcset')).toBe(false);
    expect(root.querySelector('img').getAttribute('src')).toBe('/a.png');
  });

  it('handles svg: onload, script and xlink:href', () => {
    const root = svg('<script>alert(1)</script><a xlink:href="javascript:alert(1)"><text>x</text></a><use xlink:href="#icon"></use><circle onload="x()" r="1"/>');
    root.querySelector('svg').setAttribute('onload', 'alert(1)');
    sanitizeNode(root);
    expect(root.querySelector('script')).toBeNull();
    expect(root.querySelector('svg').hasAttribute('onload')).toBe(false);
    expect(root.querySelector('circle').hasAttribute('onload')).toBe(false);
    expect(root.querySelector('a').hasAttribute('xlink:href')).toBe(false);
    expect(root.querySelector('use').getAttribute('xlink:href')).toBe('#icon');
  });

  it('strips a prefixed XLink href parsed by the XML parser and SMIL href animation', () => {
    const doc = new DOMParser().parseFromString(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:x="http://www.w3.org/1999/xlink">'
      + '<a x:href="javascript:alert(1)"><text>t</text></a>'
      + '<a><animate attributeName="href" values="javascript:alert(1)"/><set attributeName="href" to="javascript:alert(1)"/></a>'
      + '<foreignObject><div onclick="x()">x</div></foreignObject></svg>',
      'image/svg+xml',
    ).documentElement;
    sanitizeNode(doc);
    expect(doc.querySelector('a').attributes.length).toBe(0);
    expect(doc.querySelector('animate, set, foreignObject')).toBeNull();
  });

  it('removes unsafe plain href on svg anchors', () => {
    const root = svg('<a href="javascript:alert(1)"><text>x</text></a>');
    sanitizeNode(root);
    expect(root.querySelector('a').hasAttribute('href')).toBe(false);
  });

  it('works on a DocumentFragment', () => {
    const frag = document.createDocumentFragment();
    frag.append(html('<img src=x onerror=1><script>1</script>'));
    sanitizeNode(frag);
    expect(frag.querySelector('[onerror], script')).toBeNull();
  });
});
