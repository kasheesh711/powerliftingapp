interface ConflictDetail {
  cellA1: string;
  serverValue: string;
  requestedOriginal: string | number | null;
}

interface ConflictListProps {
  conflicts: ConflictDetail[];
}

export function ConflictList({ conflicts }: ConflictListProps): JSX.Element {
  return (
    <section
      style={{
        border: '1px solid #f1c27d',
        background: '#fffbeb',
        color: '#7c2d12',
        borderRadius: 10,
        padding: 12
      }}
    >
      <strong style={{ display: 'block', marginBottom: 8 }}>Conflicts detected</strong>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {conflicts.map((conflict) => (
          <li key={conflict.cellA1}>
            {conflict.cellA1}: server `{conflict.serverValue}` vs client `{String(conflict.requestedOriginal ?? '')}`
          </li>
        ))}
      </ul>
    </section>
  );
}
