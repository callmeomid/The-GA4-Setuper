// ⚠ BEST-EFFORT, UNVERIFIED — same caveat as the two flagged spots in
// lib/gtm/resources.ts (gaawe/gaawc parameter keys, FORM_SUBMISSION trigger
// type), but for the whole module: this app has never run against a live
// Stape account. The container/domain endpoint paths and payload keys below
// are this app's best guess at Stape's Public API (Bearer-token auth against
// api.stape.io, REST resources under /api/v1/containers). Confirm against a
// real account + Stape's API docs before trusting this in production; the
// blast radius of being wrong is contained to lib/stape/api.ts and this file.

export type DomainTopology = 'single' | 'cross_subdomain' | 'cross_domain';

export type DomainConfig = {
  cookieDomain: string | null;
  allowedDomains: string[];
  warnings: string[];
};

// The one part of this file that ISN'T a Stape-specific guess: cookies
// fundamentally can't cross unrelated root domains (that's the browser's
// same-site cookie model, not a Stape limitation), so cross_domain funnels
// can't get a single shared first-party cookie no matter what Stape's API
// actually looks like — they need GA4's cross-domain link decoration (the
// `_gl` query param) instead, and a Stape container per domain.
export function buildDomainConfig(topology: DomainTopology, rootDomain: string | null, allowedDomains: string[]): DomainConfig {
  if (topology === 'single') {
    return { cookieDomain: null, allowedDomains: allowedDomains.slice(0, 1), warnings: [] };
  }
  if (topology === 'cross_subdomain') {
    if (!rootDomain) {
      return { cookieDomain: null, allowedDomains, warnings: ['Root domain is required for cross-subdomain funnels — the cookie domain below is not yet set.'] };
    }
    return {
      cookieDomain: `.${rootDomain.replace(/^\./, '')}`,
      allowedDomains: [rootDomain],
      warnings: [],
    };
  }
  // cross_domain
  return {
    cookieDomain: null,
    allowedDomains,
    warnings: [
      'These domains are not related subdomains, so a first-party cookie set on one is invisible to the others — this is a browser limitation, not a Stape one.',
      "GA4's cross-domain linker (the `_gl` URL parameter) will be relied on instead to stitch sessions across these domains.",
      'Each domain needs its own Stape container pointed at it — one shared container can\'t proxy requests for multiple unrelated domains.',
    ],
  };
}

export function buildContainerName(funnelName: string): string {
  return `funnel-setuper-${funnelName}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 63);
}

// Exact request bodies this app would send — isolated here (not inlined in
// api.ts) for the same reason lib/gtm/resources.ts isolates its builders:
// one place to fix once the real shape is confirmed.
export function buildCreateContainerPayload(name: string, primaryDomain: string) {
  return { name, domain: primaryDomain };
}

export function buildDomainConfigPayload(config: DomainConfig) {
  return {
    cookie_domain: config.cookieDomain,
    allowed_domains: config.allowedDomains,
  };
}
