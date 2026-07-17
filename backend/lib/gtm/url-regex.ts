// Converts a captured urlPattern (origin + pathname, with ":id" wildcard
// segments from the extension's url-pattern.js) into a RegEx GTM can match
// against the built-in {{Page Path}} variable — which excludes the origin,
// so only the pathname half of urlPattern is relevant here.
export function urlPatternToPagePathRegex(urlPattern: string): string {
  const url = new URL(urlPattern);
  const segments = url.pathname.split('/').filter(Boolean);
  const regexSegments = segments.map((segment) => (segment === ':id' ? '[^/]+' : escapeRegex(segment)));
  const path = regexSegments.length ? `/${regexSegments.join('/')}` : '/';
  return `^${path}$`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
