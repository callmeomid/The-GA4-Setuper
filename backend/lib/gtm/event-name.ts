// "Added to Cart" -> "add_to_cart" isn't plain slugification (that gives
// "added_to_cart") — it's tense-normalization to GA4's recommended-event
// convention. There's no reliable way to lemmatize arbitrary marketer-written
// labels automatically, so this is a small hand-authored dictionary of common
// verbs, applied before falling back to slugify. It won't get every label
// right — that's exactly why the preview UI lets the user edit the result
// before anything is pushed to GTM.
const PREFIX_STRIP: RegExp[] = [
  /^submitted:\s*/i, // our own content script prefixes formSubmit labels this way
];

const LEADING_VERB_MAP: Array<[RegExp, string]> = [
  [/^added\b/i, 'add'],
  [/^viewed\b/i, 'view'],
  [/^purchased\b/i, 'purchase'],
  [/^started\b/i, 'start'],
  [/^completed\b/i, 'complete'],
  [/^clicked\b/i, 'click'],
  [/^downloaded\b/i, 'download'],
  [/^subscribed\b/i, 'subscribe'],
  [/^registered\b/i, 'register'],
  [/^searched\b/i, 'search'],
  [/^shared\b/i, 'share'],
  [/^selected\b/i, 'select'],
  [/^signed up\b/i, 'sign_up'],
];

function slugify(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'event';
}

export function deriveEventName(label: string): string {
  let working = label.trim();

  for (const pattern of PREFIX_STRIP) {
    if (pattern.test(working)) {
      return slugify(working.replace(pattern, ''));
    }
  }

  for (const [pattern, replacement] of LEADING_VERB_MAP) {
    if (pattern.test(working)) {
      working = working.replace(pattern, replacement);
      break;
    }
  }

  return slugify(working);
}
