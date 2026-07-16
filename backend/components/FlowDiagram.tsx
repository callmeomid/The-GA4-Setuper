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

export function FlowDiagram({ steps, approved }: { steps: Step[]; approved: boolean }) {
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
        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'stretch' }}>
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
            {index < steps.length - 1 && <Connector solid={approved} />}
          </div>
        );
      })}
    </div>
  );
}
