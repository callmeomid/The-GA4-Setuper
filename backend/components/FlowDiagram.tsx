'use client';

import { useEffect, useRef, useState } from 'react';

type Step = {
  id: string;
  order: number;
  label: string;
  urlPattern: string;
  triggerType: string;
  selector: string | null;
  formFieldsJson: string | null;
  gtmStatus: string;
  ga4Status: string;
  stapeStatus: string;
};

const STAGGER_MS = 70;

function PendingPill({ system, status }: { system: string; status: string }) {
  const done = status !== 'pending';
  return (
    <span
      className="mono"
      style={{
        fontSize: 9,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        padding: '3px 6px',
        borderRadius: 2,
        border: `1px ${done ? 'solid' : 'dashed'} ${done ? 'var(--accent)' : 'var(--line-ghost)'}`,
        color: done ? 'var(--accent)' : 'var(--line-secondary)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        transition: 'border-color 150ms linear, color 150ms linear',
      }}
    >
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: done ? 'var(--accent)' : 'var(--line-secondary)',
          transition: 'background 150ms linear',
        }}
      />
      {system} · {done ? status : 'pending'}
    </span>
  );
}

function Connector({ approved, delayMs }: { approved: boolean; delayMs: number }) {
  return (
    <div
      style={{
        flex: '0 0 32px',
        alignSelf: 'center',
        position: 'relative',
        height: 1,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderTop: '1px dashed var(--line-ghost)',
          opacity: approved ? 0 : 1,
          transition: `opacity 150ms linear`,
          transitionDelay: `${delayMs}ms`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderTop: '1px solid var(--accent)',
          opacity: approved ? 1 : 0,
          transition: `opacity 150ms linear`,
          transitionDelay: `${delayMs}ms`,
        }}
      />
      <span
        style={{
          position: 'absolute',
          right: -2,
          top: -7,
          fontSize: 12,
          color: approved ? 'var(--accent)' : 'var(--line-secondary)',
          transition: `color 150ms linear`,
          transitionDelay: `${delayMs}ms`,
        }}
      >
        →
      </span>
    </div>
  );
}

export function FlowDiagram({ steps, approved }: { steps: Step[]; approved: boolean }) {
  const prevApproved = useRef(approved);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (!prevApproved.current && approved) {
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), steps.length * STAGGER_MS + 300);
      prevApproved.current = approved;
      return () => clearTimeout(t);
    }
    prevApproved.current = approved;
  }, [approved, steps.length]);

  return (
    <div
      className="dot-grid"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        overflowX: 'auto',
        padding: '20px 4px',
        gap: 0,
      }}
    >
      {steps.map((step, index) => {
        const formFields: string[] = step.formFieldsJson ? JSON.parse(step.formFieldsJson) : [];
        const delayMs = index * STAGGER_MS;
        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'stretch' }}>
            <div
              className={pulsing ? 'pulse-confirm' : undefined}
              style={{
                width: 220,
                flex: '0 0 220px',
                border: `1px solid ${approved ? 'var(--accent)' : 'var(--line-ghost)'}`,
                borderRadius: 2,
                padding: '12px 12px 10px',
                background: 'var(--bg-raised)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                transition: 'border-color 150ms linear',
                transitionDelay: `${delayMs}ms`,
                animationDelay: pulsing ? `${delayMs}ms` : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)' }}>
                  STEP {String(step.order).padStart(2, '0')}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    border: '1px solid var(--line-ghost)',
                    borderRadius: 2,
                    padding: '2px 5px',
                    color: 'var(--line-secondary)',
                  }}
                >
                  {step.triggerType}
                </span>
              </div>

              <div style={{ fontSize: 13, lineHeight: 1.3 }}>{step.label}</div>

              <div
                className="mono"
                title={step.urlPattern}
                style={{ fontSize: 10, color: 'var(--line-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {step.urlPattern}
              </div>

              {step.selector && (
                <div
                  className="mono"
                  title={step.selector}
                  style={{ fontSize: 9.5, color: 'var(--line-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  sel: {step.selector}
                </div>
              )}

              {formFields.length > 0 && (
                <div className="mono" style={{ fontSize: 9.5, color: 'var(--line-secondary)' }}>
                  fields: {formFields.join(', ')}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--line-ghost)' }}>
                <PendingPill system="GTM" status={step.gtmStatus} />
                <PendingPill system="GA4" status={step.ga4Status} />
                <PendingPill system="Stape" status={step.stapeStatus} />
              </div>
            </div>
            {index < steps.length - 1 && <Connector approved={approved} delayMs={delayMs} />}
          </div>
        );
      })}
    </div>
  );
}
