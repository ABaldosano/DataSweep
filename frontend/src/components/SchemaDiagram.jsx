import "./SchemaDiagram.css";

// Heuristic key detection, presentational only -- reads the same profile
// data the Profile tab already shows (column names, types, null/unique
// counts) and reasons about likely primary/foreign keys from naming
// conventions. Nothing here mutates data or calls the backend.

function singularize(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith("ies")) return lower.slice(0, -3) + "y";
  if (lower.endsWith("es")) return lower.slice(0, -2);
  if (lower.endsWith("s")) return lower.slice(0, -1);
  return lower;
}

function findPrimaryKey(table) {
  const singular = singularize(table.name);
  const candidates = table.columns.filter((c) => {
    const lower = c.name.toLowerCase();
    return lower === "id" || lower === `${singular}_id`;
  });
  const exact = candidates.find((c) => table.rowCount > 0 && c.uniqueCount === table.rowCount);
  return exact || candidates[0] || null;
}

function findForeignKeys(table, allTables, primaryKeyName) {
  return table.columns
    .filter((c) => {
      const lower = c.name.toLowerCase();
      if (!lower.endsWith("_id")) return false;
      if (primaryKeyName && c.name === primaryKeyName) return false;
      return true;
    })
    .map((c) => {
      const base = c.name.toLowerCase().slice(0, -3);
      const target = allTables.find((t) => {
        if (t.name === table.name) return false;
        const tLower = t.name.toLowerCase();
        return tLower === base || tLower === `${base}s` || tLower === `${base}es`;
      });
      return { column: c.name, refTable: target ? target.name : null };
    })
    .filter((fk) => fk.refTable);
}

export default function SchemaDiagram({ tables }) {
  if (!tables || tables.length === 0) {
    return <p className="chart-empty">No tables to diagram yet.</p>;
  }

  const analyzed = tables.map((table) => {
    const pk = findPrimaryKey(table);
    const fks = findForeignKeys(table, tables, pk?.name);
    return { table, pk, fks };
  });

  const relationships = analyzed.flatMap(({ table, fks }) =>
    fks.map((fk) => ({ from: table.name, column: fk.column, to: fk.refTable }))
  );

  return (
    <div className="schema-diagram">
      <div className="schema-cards">
        {analyzed.map(({ table, pk, fks }) => {
          const fkNames = new Set(fks.map((f) => f.column));
          return (
            <div className="schema-card" key={table.name}>
              <div className="schema-card-header">
                <span className="schema-card-name">{table.name}</span>
                <span className="schema-card-rows">{table.rowCount.toLocaleString()} rows</span>
              </div>
              <ul className="schema-card-columns">
                {table.columns.map((col) => (
                  <li key={col.name}>
                    <span className="schema-col-name">{col.name}</span>
                    <span className="schema-col-type">{col.type}</span>
                    {pk && pk.name === col.name && <span className="schema-key-badge pk">PK</span>}
                    {fkNames.has(col.name) && <span className="schema-key-badge fk">FK</span>}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="schema-relationships">
        <div className="schema-relationships-title">Relationships</div>
        {relationships.length === 0 ? (
          <p className="chart-empty">No foreign-key style columns detected.</p>
        ) : (
          <ul className="schema-relationship-list">
            {relationships.map((r, i) => (
              <li key={i}>
                <span className="rel-from">
                  {r.from}.{r.column}
                </span>
                <span className="rel-arrow">&rarr;</span>
                <span className="rel-to">{r.to}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
