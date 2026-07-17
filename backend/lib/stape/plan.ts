import { buildContainerName, buildDomainConfig, type DomainConfig, type DomainTopology } from './resources';
import type { StapeContainer } from './api';

export type StapePlan = {
  container: { outcome: 'new' | 'reuse'; name: string; description: string };
  domain: DomainConfig;
  warnings: string[];
};

export function buildStapePlan(
  funnelName: string,
  primaryDomain: string,
  existingContainers: StapeContainer[],
  topology: DomainTopology,
  rootDomain: string | null,
  allowedDomains: string[],
): StapePlan {
  const name = buildContainerName(funnelName);
  const existing = existingContainers.find((c) => c.name === name);

  const container = existing
    ? { outcome: 'reuse' as const, name, description: `Already created in a previous run — will reuse the existing "${name}" container.` }
    : { outcome: 'new' as const, name, description: `Will create a new Stape server container named "${name}" for ${primaryDomain}.` };

  const domain = buildDomainConfig(topology, rootDomain, allowedDomains);

  return { container, domain, warnings: domain.warnings };
}
