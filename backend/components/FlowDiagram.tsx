'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
  gtmTriggerId: string | null;
  gtmTagId: string | null;
};

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
      }}
    >
      <span
        style={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: done ? 'var(--accent)' : 'var(--line-secondary)',
        }}
      />
      {system} · {done ? status : 'pending'}
    </span>
  );
}

function Connector({ solid }: { solid: boolean }) {
  return (
    <div
      style={{
        flex: '0 0 32px',
        alignSelf: 'center',
        height: 0,
        borderTop: `1px ${solid ? 'solid' : 'dashed'} ${solid ? 'var(--accent)' : 'var(--line-ghost)'}`,
        position: 'relative',
      }}
    >
      <span
        style={{
          position: 'absolute',
          right: -2,
          top: -7,
          fontSize: 12,
          color: solid ? 'var(--accent)' : 'var(--line-secondary)',
        }}
      >
        →
      </span>
    </div>
  );
}

const inputStyle = {
  background: 'var(--bg)',
  color: 'var(--line-primary)',
  border: '1px solid var(--line-ghost)',
  padding: '6px 8px',
  borderRadius: 2,
  fontSize: 11.5,
  width: '100%',
} as const;

function StepEditor({
  funnelId,
  step,
  onDone,
}: {
  funnelId: string;
  step: Step;
  onDone: () => void;
}) {
  const [label, setLabel] = useState(step.label);
  const [urlPattern, setUrlPattern] = useState(step.urlPattern);
  const [triggerType, setTriggerType] = useState(step.triggerType);
  const [selector, setSelector] = useState(step.selector ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/funnels/${funnelId}/steps/${step.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          urlPattern,
          triggerType,
          selector: triggerType === 'click' ? selector : null,
        }),
      });
      if (res.ok) onDone();
      else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not save this step.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Step label" className="mono" style={inputStyle} />
      <input value={urlPattern} onChange={(e) => setUrlPattern(e.target.value)} placeholder="URL pattern" className="mono" style={inputStyle} />
      <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)} className="mono" style={inputStyle}>
        <option value="click">Click</option>
        <option value="pageview">Pageview</option>
        <option value="formSubmit">Form Submission</option>
      </select>
      {triggerType === 'click' && (
        <input value={selector} onChange={(e) => setSelector(e.target.value)} placeholder="CSS selector" className="mono" style={inputStyle} />
      )}
      {error && <div style={{ fontSize: 10.5, color: 'var(--danger)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-accent" style={{ padding: '5px 10px', fontSize: 10.5 }} disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="btn" style={{ padding: '5px 10px', fontSize: 10.5 }} disabled={saving} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function StepCard({
  funnelId,
  step,
  approved,
  setupMode,
}: {
  funnelId: string;
  step: Step;
  approved: boolean;
  setupMode: 'client' | 'server' | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const formFields: string[] = step.formFieldsJson ? JSON.parse(step.formFieldsJson) : [];
  const alreadyInGtm = Boolean(step.gtmTriggerId || step.gtmTagId);

  async function remove() {
    setRemoving(true);
    try {
      const res = await fetch(`/api/funnels/${funnelId}/steps/${step.id}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    } finally {
      setRemoving(false);
      setConfirmingRemove(false);
    }
  }

  return (
    <div
      style={{
        width: 220,
        flex: '0 0 220px',
        border: `1px ${approved ? 'solid' : 'dashed'} ${approved ? 'var(--accent)' : 'var(--line-ghost)'}`,
        borderRadius: 2,
        padding: '12px 12px 10px',
        background: 'var(--bg-raised)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
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

      {editing ? (
        <StepEditor funnelId={funnelId} step={step} onDone={() => { setEditing(false); router.refresh(); }} />
      ) : (
        <>
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
            {setupMode === 'server' && <PendingPill system="Stape" status={step.stapeStatus} />}
          </div>

          {confirmingRemove ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {alreadyInGtm && (
                <div style={{ fontSize: 9.5, color: 'var(--amber)' }}>
                  Already pushed to GTM — removing it here won&apos;t delete the trigger/tag there.
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn"
                  style={{ padding: '5px 10px', fontSize: 10.5, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  disabled={removing}
                  onClick={remove}
                >
                  {removing ? 'Removing…' : 'Confirm remove'}
                </button>
                <button className="btn" style={{ padding: '5px 10px', fontSize: 10.5 }} disabled={removing} onClick={() => setConfirmingRemove(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn" style={{ padding: '5px 10px', fontSize: 10.5 }} onClick={() => setEditing(true)}>
                Edit
              </button>
              <button
                className="btn"
                style={{ padding: '5px 10px', fontSize: 10.5, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={() => setConfirmingRemove(true)}
              >
                Remove
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function FlowDiagram({
  funnelId,
  steps,
  approved,
  setupMode,
}: {
  funnelId: string;
  steps: Step[];
  approved: boolean;
  setupMode: 'client' | 'server' | null;
}) {
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
      {steps.map((step, index) => (
        <div key={step.id} style={{ display: 'flex', alignItems: 'stretch' }}>
          <StepCard funnelId={funnelId} step={step} approved={approved} setupMode={setupMode} />
          {index < steps.length - 1 && <Connector solid={approved} />}
        </div>
      ))}
    </div>
  );
}
