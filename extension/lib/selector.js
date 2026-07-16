// Selector-stability strategy: data-* > non-generated id > aria-label > name > structural path.
// Exposed as window.FunnelSelector for the content script (plain scripts, no modules, shared execution context).
(function () {
  const PREFERRED_DATA_ATTRS = [
    'data-testid',
    'data-test-id',
    'data-test',
    'data-cy',
    'data-qa',
    'data-qa-id',
  ];

  const LANDMARK_TAGS = new Set(['NAV', 'HEADER', 'MAIN', 'FOOTER', 'FORM', 'SECTION', 'BODY']);

  function isFrameworkInternalDataAttr(name) {
    if (/^data-v-[0-9a-f]{6,}$/i.test(name)) return true; // Vue scoped-style hash, shared across many nodes
    return ['data-reactroot', 'data-reactid', 'data-server-rendered'].includes(name);
  }

  function getDataAttrMatch(el) {
    for (const name of PREFERRED_DATA_ATTRS) {
      if (el.hasAttribute(name)) return { name, value: el.getAttribute(name) };
    }
    for (const attr of el.attributes) {
      if (attr.name.startsWith('data-') && !isFrameworkInternalDataAttr(attr.name)) {
        return { name: attr.name, value: attr.value };
      }
    }
    return null;
  }

  function isGeneratedId(id) {
    if (!id) return true;
    if (/^[0-9]+$/.test(id)) return true;
    if (id.includes(':')) return true; // React 18 useId output, e.g. ":r0:"
    if (/^(react|ember|radix|mui|headlessui|vue|ng)-/i.test(id)) return true;
    if (/^[a-f0-9]{8,}$/i.test(id)) return true; // opaque hash-like id
    return false;
  }

  function escapeAttrValue(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function describeNode(node) {
    const tag = node.tagName.toLowerCase();
    let descriptor = tag;
    const type = node.getAttribute && node.getAttribute('type');
    if (type) descriptor += `[type="${escapeAttrValue(type)}"]`;
    const parent = node.parentElement;
    if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
      if (sameTagSiblings.length > 1) {
        descriptor += `:nth-of-type(${sameTagSiblings.indexOf(node) + 1})`;
      }
    }
    return descriptor;
  }

  function buildStructuralSelector(el) {
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 4) {
      parts.unshift(describeNode(node));
      if (LANDMARK_TAGS.has(node.tagName)) break;
      node = node.parentElement;
      depth += 1;
    }
    return parts.join(' > ');
  }

  function getStableSelector(el) {
    if (!el || el.nodeType !== 1) return { selector: null, confidence: 'none' };

    const dataAttr = getDataAttrMatch(el);
    if (dataAttr) {
      return {
        selector: `[${dataAttr.name}="${escapeAttrValue(dataAttr.value)}"]`,
        confidence: 'data-attr',
      };
    }

    if (el.id && !isGeneratedId(el.id)) {
      return { selector: `#${CSS.escape(el.id)}`, confidence: 'id' };
    }

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) {
      return {
        selector: `${el.tagName.toLowerCase()}[aria-label="${escapeAttrValue(ariaLabel.trim())}"]`,
        confidence: 'aria-label',
      };
    }

    const name = el.getAttribute('name');
    if (name && name.trim()) {
      return {
        selector: `${el.tagName.toLowerCase()}[name="${escapeAttrValue(name.trim())}"]`,
        confidence: 'name',
      };
    }

    return { selector: buildStructuralSelector(el), confidence: 'structural' };
  }

  function getVisibleLabel(el) {
    const ariaLabel = el.getAttribute && el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
    const text = (el.innerText || el.value || el.textContent || '').trim().replace(/\s+/g, ' ');
    if (text) return text.slice(0, 60);
    return el.tagName ? el.tagName.toLowerCase() : 'element';
  }

  window.FunnelSelector = { getStableSelector, getVisibleLabel, isGeneratedId };
})();
