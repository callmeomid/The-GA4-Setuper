export function StatusBadge({ status }: { status: string }) {
  const approved = status === 'approved';
  return (
    <span
      className="mono"
      style={{
        fontSize: 10,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 2,
        border: `1px solid ${approved ? 'var(--accent)' : 'var(--line-ghost)'}`,
        color: approved ? 'var(--accent)' : 'var(--line-secondary)',
        flex: 'none',
      }}
    >
      {approved ? 'Approved' : 'Draft'}
    </span>
  );
}
