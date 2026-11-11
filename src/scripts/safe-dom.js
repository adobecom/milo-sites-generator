const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];
const BLOCKED_ELEMENTS = 'script, iframe, object, embed, style, foreignObject, animate, set';
const URL_ATTRIBUTES = ['href', 'src', 'action', 'formaction'];

export function isSafeUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    return SAFE_PROTOCOLS.includes(new URL(value, window.location.href).protocol);
  } catch {
    return false;
  }
}

function isSafeSrcset(value) {
  return value
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean)
    .every(isSafeUrl);
}

function sanitizeAttributes(el) {
  Array.from(el.attributes).forEach((attr) => {
    // localName ignores the namespace prefix, so any prefix bound to XLink (x:href) is covered.
    const name = (attr.localName || attr.name).toLowerCase();
    const unsafe = name.startsWith('on')
      || (URL_ATTRIBUTES.includes(name) && !isSafeUrl(attr.value))
      || (name === 'srcset' && !isSafeSrcset(attr.value));
    if (unsafe) el.removeAttributeNode(attr);
  });
}

/**
 * Strips active content from an element or fragment in place: script-like elements,
 * on* handlers and URL attributes with a non-http(s)/mailto/tel protocol.
 * Works for HTML and SVG nodes.
 */
export function sanitizeNode(root) {
  root.querySelectorAll(BLOCKED_ELEMENTS).forEach((el) => el.remove());
  if (root.nodeType === Node.ELEMENT_NODE) sanitizeAttributes(root);
  root.querySelectorAll('*').forEach(sanitizeAttributes);
  return root;
}
