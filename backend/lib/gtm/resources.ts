import type { tagmanager_v2 } from 'googleapis';
import { urlPatternToPagePathRegex } from './url-regex';

export type StepInput = {
  triggerType: string; // "click" | "pageview" | "formSubmit"
  urlPattern: string;
  selector: string | null;
  label: string;
};

export function triggerTypeLabel(triggerType: string): string {
  if (triggerType === 'click') return 'Click';
  if (triggerType === 'formSubmit') return 'Form Submission';
  return 'Pageview';
}

export function buildTriggerName(step: StepInput): string {
  return `${triggerTypeLabel(step.triggerType)} → ${step.label}`.slice(0, 100);
}

function pagePathCondition(urlPattern: string): tagmanager_v2.Schema$Condition {
  return {
    type: 'matchRegex',
    parameter: [
      { type: 'template', key: 'arg0', value: '{{Page Path}}' },
      { type: 'template', key: 'arg1', value: urlPatternToPagePathRegex(urlPattern) },
    ],
  };
}

// Builds the exact object we POST to triggers.create — shared by the preview
// (so "technical details" shows precisely what will be sent) and the push
// execution, so the two can never drift apart.
export function buildTriggerResource(step: StepInput): tagmanager_v2.Schema$Trigger {
  const name = buildTriggerName(step);

  if (step.triggerType === 'click') {
    return {
      name,
      type: 'CLICK',
      filter: [
        {
          type: 'cssSelector',
          parameter: [
            { type: 'template', key: 'arg0', value: '{{Click Element}}' },
            { type: 'template', key: 'arg1', value: step.selector ?? '' },
          ],
        },
        pagePathCondition(step.urlPattern),
      ],
    };
  }

  if (step.triggerType === 'formSubmit') {
    return {
      name,
      type: 'FORM_SUBMISSION',
      filter: [pagePathCondition(step.urlPattern)],
      waitForTags: { type: 'boolean', value: 'false' },
      checkValidation: { type: 'boolean', value: 'false' },
    };
  }

  return {
    name,
    type: 'PAGEVIEW',
    filter: [pagePathCondition(step.urlPattern)],
  };
}

export function buildTagName(eventName: string): string {
  return `GA4 Event: ${eventName}`.slice(0, 100);
}

function eventParametersFor(step: StepInput): tagmanager_v2.Schema$Parameter | null {
  if (step.triggerType === 'click') {
    return {
      type: 'list',
      key: 'eventParameters',
      list: [
        {
          type: 'map',
          map: [
            { type: 'template', key: 'name', value: 'element_text' },
            { type: 'template', key: 'value', value: '{{Click Text}}' },
          ],
        },
      ],
    };
  }
  if (step.triggerType === 'formSubmit') {
    return {
      type: 'list',
      key: 'eventParameters',
      list: [
        {
          type: 'map',
          map: [
            { type: 'template', key: 'name', value: 'form_id' },
            { type: 'template', key: 'value', value: '{{Form ID}}' },
          ],
        },
      ],
    };
  }
  return null;
}

// ga4ConfigTagName: TAG_REFERENCE parameters in GTM point at a tag by name,
// not id — this mirrors how the GTM UI's "Configuration Tag" dropdown works.
export function buildTagResource(
  step: StepInput,
  eventName: string,
  ga4ConfigTagName: string,
  triggerId: string,
): tagmanager_v2.Schema$Tag {
  const parameter: tagmanager_v2.Schema$Parameter[] = [
    { type: 'template', key: 'eventName', value: eventName },
    { type: 'tagReference', key: 'measurementId', value: ga4ConfigTagName },
  ];
  const eventParams = eventParametersFor(step);
  if (eventParams) parameter.push(eventParams);

  return {
    name: buildTagName(eventName),
    type: 'gaawe',
    parameter,
    firingTriggerId: [triggerId],
  };
}

// Transport is set once on the GA4 Configuration tag and inherited by every
// event tag that references it (via the tagReference `measurementId`
// parameter) — so routing through a server container only ever touches this
// one tag, never the per-step event tags in resources/plan.
function transportParameters(serverContainerUrl: string | null): tagmanager_v2.Schema$Parameter[] {
  if (!serverContainerUrl) return [];
  return [
    { type: 'boolean', key: 'useTransportUrl', value: 'true' },
    { type: 'template', key: 'transportUrl', value: serverContainerUrl },
  ];
}

export function buildGa4ConfigTagResource(
  tagName: string,
  measurementId: string,
  triggerId: string,
  serverContainerUrl: string | null = null,
): tagmanager_v2.Schema$Tag {
  return {
    name: tagName,
    type: 'gaawc',
    parameter: [{ type: 'template', key: 'measurementId', value: measurementId }, ...transportParameters(serverContainerUrl)],
    firingTriggerId: [triggerId],
  };
}

// Used on the *upgrade* path: an existing GA4 Configuration tag this app
// created for a client-side setup gets its transport parameters added in
// place, everything else (name, firingTriggerId, other parameters) untouched
// — so tags.update can't accidentally clobber something the user edited by
// hand in GTM since the last run.
export function mergeServerContainerUrl(tag: tagmanager_v2.Schema$Tag, serverContainerUrl: string): tagmanager_v2.Schema$Tag {
  const withoutTransport = (tag.parameter ?? []).filter((p) => p.key !== 'useTransportUrl' && p.key !== 'transportUrl');
  return { ...tag, parameter: [...withoutTransport, ...transportParameters(serverContainerUrl)] };
}
