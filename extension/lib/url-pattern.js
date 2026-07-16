// Normalizes a URL into a stable pattern by wildcarding dynamic path segments
// (numeric ids, UUIDs, opaque hashes) while leaving semantic segments intact.
(function () {
  function isDynamicSegment(segment) {
    if (/^[0-9]+$/.test(segment)) return true;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return true;
    if (/^[a-f0-9]{12,}$/i.test(segment)) return true;
    if (/^[a-zA-Z0-9]{16,}$/.test(segment) && /[0-9]/.test(segment) && /[a-zA-Z]/.test(segment)) return true;
    return false;
  }

  function toUrlPattern(urlString) {
    const url = new URL(urlString);
    const segments = url.pathname.split('/').filter(Boolean);
    const patternSegments = segments.map((segment) => (isDynamicSegment(segment) ? ':id' : segment));
    const pathnamePattern = patternSegments.length ? `/${patternSegments.join('/')}` : '/';
    return `${url.origin}${pathnamePattern}`;
  }

  window.FunnelUrlPattern = { toUrlPattern };
})();
