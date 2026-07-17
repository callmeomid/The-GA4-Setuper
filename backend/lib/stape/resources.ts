// Minimal shapes for the fields this app actually reads/writes — not a full
// mirror of Stape's API. Confirmed against stape-io/stape-mcp-server's
// source (models/*.ts), the only concrete reference available; Stape's own
// API doc page (api.app.stape.io/api/doc) is a JS-rendered Swagger UI that
// wasn't fetchable here, so field names are as-observed, not as-documented.

export type StapeContainer = {
  id: number;
  identifier: string;
  name: string;
  code: string;
  apiKey: string;
  stapeDomain: string;
  status: { type: string; name?: string };
};

export type StapeDomainRecord = { type: { type: string; name?: string }; host: string; value: string };

export type StapeDomain = {
  id: number;
  identifier: string;
  name: string;
  status: { type: string; name?: string };
  error: { type: string; name?: string } | null;
  records: StapeDomainRecord[];
  connectionType: string;
  cdnType: string;
};

// POST /containers body. `zone` and `cookieKeeperOptions` are left
// unspecified by default (see lib/stape/plan.ts) — best-effort, flagged for
// live verification the same way lib/gtm/resources.ts flags its two
// unverified spots.
export type CreateContainerBody = {
  name: string;
  code: string;
};

// POST /containers/{id}/domains body. `cdnType`/`connectionType`/
// `useCnameRecord` enum values are Stape's internal vocabulary and aren't
// confirmed live — this is the other best-effort spot in this module.
export type CreateDomainBody = {
  name: string;
  cdnType?: string;
  useCnameRecord?: boolean;
  connectionType?: string;
};
