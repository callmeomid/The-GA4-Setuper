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

// serverContainerUrl, when provided, is the user's own Stape server container
// hostname (see lib/gtm/preview.ts / Funnel.stapeSubdomain) — never a domain
// we control. Parameter keys per Google's server-side tagging setup docs:
// https://developers.google.com/tag-platform/learn/sst-fundamentals/5-sst-setup-analytics
export function buildGa4ConfigTagResource(
  tagName: string,
  measurementId: string,
  triggerId: string,
  serverContainerUrl?: string | null,
): tagmanager_v2.Schema$Tag {
  const parameter: tagmanager_v2.Schema$Parameter[] = [{ type: 'template', key: 'measurementId', value: measurementId }];
  if (serverContainerUrl) {
    parameter.push(
      { type: 'boolean', key: 'enableSendToServerContainer', value: 'true' },
      { type: 'template', key: 'server_container_url', value: serverContainerUrl },
    );
  }
  return {
    name: tagName,
    type: 'gaawc',
    parameter,
    firingTriggerId: [triggerId],
  };
}
