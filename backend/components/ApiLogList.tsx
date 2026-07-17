type Log = {
  id: string;
  method: string;
  endpoint: string;
  requestBody: string | null;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: Date;
};

export function ApiLogList({ logs, emptyHint }: { logs: Log[]; emptyHint: string }) {
  if (logs.length === 0) {
    return (
      <div className="dot-grid" style={{ border: '1px dashed var(--line-ghost)', borderRadius: 2, padding: 20, fontSize: 13, color: 'var(--line-secondary)' }}>
        {emptyHint}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {logs.map((log) => (
        <details key={log.id} style={{ border: `1px solid ${log.errorMessage ? 'var(--danger)' : 'var(--line-ghost)'}`, borderRadius: 2, padding: 10 }}>
          <summary className="mono" style={{ fontSize: 11, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
            <span>
              {log.method} {log.endpoint}
            </span>
            <span style={{ color: log.errorMessage ? 'var(--danger)' : 'var(--line-secondary)' }}>
              {log.responseStatus ?? '—'} · {log.durationMs}ms · {new Date(log.createdAt).toLocaleTimeString()}
            </span>
          </summary>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)' }}>
              REQUEST
            </div>
            <pre className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)', overflow: 'auto', margin: 0 }}>
              {log.requestBody}
            </pre>
            {log.errorMessage ? (
              <>
                <div className="mono" style={{ fontSize: 10, color: 'var(--danger)' }}>
                  ERROR
                </div>
                <pre className="mono" style={{ fontSize: 10, color: 'var(--danger)', overflow: 'auto', margin: 0 }}>
                  {log.errorMessage}
                </pre>
              </>
            ) : (
              <>
                <div className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)' }}>
                  RESPONSE
                </div>
                <pre className="mono" style={{ fontSize: 10, color: 'var(--line-secondary)', overflow: 'auto', margin: 0 }}>
                  {log.responseBody}
                </pre>
              </>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
