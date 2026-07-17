export function extractHostnames(urlPatterns: string[]): string[] {
  const set = new Set<string>();
  for (const raw of urlPatterns) {
    try {
      set.add(new URL(raw).hostname.toLowerCase());
    } catch {
      // Not a full URL — skip; buildStapePlan just won't propose a domain for it.
    }
  }
  return [...set];
}

// Best-effort eTLD+1 (registrable domain) extraction. Correct for the
// overwhelming majority of real sites; the short list below covers common
// two-part public suffixes so "shop.example.co.uk" doesn't get truncated to
// "co.uk". Not a full public-suffix-list implementation — good enough to
// decide "same site" vs. "different site" for the cookie-domain question,
// which is all this is used for.
const TWO_PART_SUFFIXES = new Set(['co.uk', 'com.au', 'co.jp', 'com.br', 'co.nz', 'co.in', 'com.mx', 'co.za']);

export function registrableRoot(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  const lastTwo = parts.slice(-2).join('.');
  if (parts.length >= 3 && TWO_PART_SUFFIXES.has(lastTwo)) return parts.slice(-3).join('.');
  return lastTwo;
}

export type StapeDomainPlan = {
  rootDomain: string;
  proposedName: string;
  outcome: 'new' | 'reuse';
  description: string;
};

export type StapeContainerPlan = {
  outcome: 'new' | 'reuse';
  name: string;
  code: string;
  identifier: string | null;
  description: string;
};

export type StapePlan = {
  spansSubdomains: boolean;
  hostnames: string[];
  container: StapeContainerPlan;
  domains: StapeDomainPlan[];
  cookieDomainValue: string;
  crossDomainWarning: string | null;
};

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'funnel'
  );
}

export function buildStapePlan(
  funnelName: string,
  funnelId: string,
  hostnames: string[],
  spansSubdomains: boolean,
  existingContainers: { code: string; name: string; identifier: string }[],
  existingDomainNames: Set<string>,
): StapePlan {
  // Deterministic from funnelId (not random) so re-running the plan proposes
  // the same code every time instead of drifting.
  const code = `${slugify(funnelName)}-${funnelId.slice(0, 6)}`;
  const existingContainer = existingContainers.find((c) => c.code === code);

  const container: StapeContainerPlan = existingContainer
    ? {
        outcome: 'reuse',
        name: existingContainer.name,
        code: existingContainer.code,
        identifier: existingContainer.identifier,
        description: `Reusing the existing "${existingContainer.name}" server container instead of creating a duplicate.`,
      }
    : {
        outcome: 'new',
        name: `Funnel Setuper: ${funnelName}`,
        code,
        identifier: null,
        description: `Will create a new sGTM server container named "Funnel Setuper: ${funnelName}".`,
      };

  const roots = [...new Set(hostnames.map(registrableRoot))];

  const crossDomainWarning =
    roots.length > 1
      ? `These steps span ${roots.length} unrelated domains (${roots.join(', ')}) — a first-party cookie set on one can never be read on another; that's a browser limit, not something Stape or this tool can configure around. Each domain below gets its own first-party collection domain so its own traffic stays first-party, but stitching one user journey across all of them needs GA4's cross-domain "linker" configuration on the GA4 tag in GTM — this tool doesn't set that up automatically yet.`
      : null;

  let domains: StapeDomainPlan[];
  let cookieDomainValue: string;

  if (roots.length <= 1 && spansSubdomains) {
    const root = roots[0] ?? hostnames[0] ?? '';
    const proposedName = `sgtm.${root}`;
    domains = [
      {
        rootDomain: root,
        proposedName,
        outcome: existingDomainNames.has(proposedName) ? 'reuse' : 'new',
        description: `One shared collection domain (${proposedName}) on the root domain — first-party and cookie-shareable across every subdomain this funnel touches.`,
      },
    ];
    cookieDomainValue = `.${root}`;
  } else {
    domains = roots.map((root) => {
      const proposedName = `sgtm.${root}`;
      return {
        rootDomain: root,
        proposedName,
        outcome: existingDomainNames.has(proposedName) ? ('reuse' as const) : ('new' as const),
        description: `Collection domain for ${root} — first-party to this domain only.`,
      };
    });
    cookieDomainValue = roots.length === 1 ? roots[0] : 'set per-domain in GTM — see the cross-domain note above';
  }

  return { spansSubdomains, hostnames, container, domains, cookieDomainValue, crossDomainWarning };
}
