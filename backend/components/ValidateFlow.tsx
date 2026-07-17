'use client';

import { useEffect, useRef, useState } from 'react';

type StepResult = { stepId: string; order: number; label: string; eventName: string; validated: boolean };

export function ValidateFlow({ funnelId, initialSteps }: { funnelId: string; initialSteps: StepResult[] }) {
  const [steps, setSteps] = useState(initialSteps);
  const [error, setError] = useState('');
  const [polling, setPolling] = useState(true);
  const justConfirmed = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!polling) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/funnels/${funnelId}/validate`);
        const data = await res.json();
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        setError('');
        const newlyConfirmed = new Set<string>();
        setSteps((prev) => {
          const prevValidated = new Set(prev.filter((s) => s.validated).map((s) => s.stepId));
          for (const s of data.steps as StepResult[]) {
            if (s.validated && !prevValidated.has(s.stepId)) newlyConfirmed.add(s.stepId);
          }
          return data.steps;
        });
        justConfirmed.current = newlyConfirmed;
        if (data.allValidated) setPolling(false);
      } catch {
        // Transient network hiccup — next tick tries again.
      }
    }

    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [funnelId, polling]);

  if (error) {
    return (
      <div style={{ border: '1px solid var(--danger)', borderRadius: 2, padding: 14, fontSize: 13, color: 'var(--danger)' }}>
        {error}
      </div>
    );
  }

  const allValidated = steps.length > 0 && steps.every((s) => s.validated);

  return (
    <div>
      <div className="dot-grid" style={{ display: 'flex', alignItems: 'stretch', overflowX: 'auto', padding: '20px 4px', gap: 0 }}>
        {steps.map((step, index) => {
          const isNew = justConfirmed.current.has(step.stepId);
          return (
            <div key={step.stepId} style={{ display: 'flex', alignItems: 'stretch' }}>
              <div
                className={isNew ? 'validate-pulse' : undefined}
                style={{
                  width: 200,
                  flex: '0 0 200px',
                  border: `1px ${step.validated ? 'solid' : 'dashed'} ${step.validated ? 'var(--accent)' : 'var(--line-ghost)'}`,
                  borderRadius: 2,
                  padding: '12px 12px 10px',
                  background: 'var(--bg-raised)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 7,
                  transition: 'border-color 150ms linear',
                }}
              >
                <div className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)' }}>
                  STEP {String(step.order).padStart(2, '0')}
                </div>
                <div style={{ fontSize: 12.5 }}>{step.label}</div>
                <div className="mono" style={{ fontSize: 10, color: step.validated ? 'var(--accent)' : 'var(--line-secondary)' }}>
                  {step.eventName} · {step.validated ? 'confirmed in GA4' : 'waiting…'}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  style={{
                    flex: '0 0 32px',
                    alignSelf: 'center',
                    height: 0,
                    borderTop: `1px ${step.validated && steps[index + 1]?.validated ? 'solid' : 'dashed'} ${
                      step.validated && steps[index + 1]?.validated ? 'var(--accent)' : 'var(--line-ghost)'
                    }`,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--line-secondary)', marginTop: 4 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: polling ? 'var(--line-secondary)' : 'var(--accent)',
            opacity: polling ? 1 : 1,
          }}
        />
        {allValidated ? 'All steps confirmed live in GA4.' : 'Checking GA4’s realtime report every few seconds…'}
      </div>

      <style jsx>{`
        .validate-pulse {
          animation: validatePulse 150ms ease-out;
        }
        @keyframes validatePulse {
          0% {
            box-shadow: 0 0 0 0 var(--accent-dim);
          }
          100% {
            box-shadow: 0 0 0 6px rgba(57, 255, 136, 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .validate-pulse {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
