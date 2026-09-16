import { useCallback, useEffect, useRef, useState } from "react";
import "./ERDView.css";

// Draggable, read-only entity-relationship diagram. Reuses the same
// naming-convention key heuristics as SchemaDiagram (kept local here so
// SchemaDiagram itself is untouched) but lays tables out on a free-form
// canvas the user can rearrange by dragging table headers. Nothing here
// is editable -- no renaming, no adding/removing columns or relationships,
// just repositioning boxes for readability.

const BOX_WIDTH = 220;
const EST_BOX_HEIGHT = 210;
const GAP_X = 270;
const GAP_Y = 250;
const PADDING = 32;

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

function computeInitialLayout(tables) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(tables.length)));
  const positions = {};
  tables.forEach((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[t.name] = { x: PADDING + col * GAP_X, y: PADDING + row * GAP_Y };
  });
  return positions;
}

// Clip a line between two box centers down to the edge of each box, so
// arrows point at box borders instead of overlapping the boxes.
function clipToBox(cx, cy, ox, oy, halfW, halfH) {
  const dx = ox - cx;
  const dy = oy - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY, 1);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

export default function ERDView({ tables }) {
  const containerRef = useRef(null);
  const boxRefs = useRef({});
  const dragRef = useRef(null);
  const [positions, setPositions] = useState({});
  const [lines, setLines] = useState([]);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 480 });
  const [draggingName, setDraggingName] = useState(null);

  const tableKey = tables.map((t) => t.name).join("|");

  useEffect(() => {
    setPositions(computeInitialLayout(tables));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]);

  const analyzed = tables.map((table) => {
    const pk = findPrimaryKey(table);
    const fks = findForeignKeys(table, tables, pk?.name);
    return { table, pk, fks };
  });

  const relationships = analyzed.flatMap(({ table, fks }) =>
    fks.map((fk) => ({ from: table.name, column: fk.column, to: fk.refTable }))
  );

  const recomputeLines = useCallback(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;
    const containerRect = containerEl.getBoundingClientRect();

    const next = relationships
      .map((rel, i) => {
        const fromEl = boxRefs.current[rel.from];
        const toEl = boxRefs.current[rel.to];
        if (!fromEl || !toEl) return null;
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        const fromCenter = {
          x: fromRect.left + fromRect.width / 2 - containerRect.left + containerEl.scrollLeft,
          y: fromRect.top + fromRect.height / 2 - containerRect.top + containerEl.scrollTop,
        };
        const toCenter = {
          x: toRect.left + toRect.width / 2 - containerRect.left + containerEl.scrollLeft,
          y: toRect.top + toRect.height / 2 - containerRect.top + containerEl.scrollTop,
        };

        const start = clipToBox(fromCenter.x, fromCenter.y, toCenter.x, toCenter.y, fromRect.width / 2, fromRect.height / 2);
        const end = clipToBox(toCenter.x, toCenter.y, fromCenter.x, fromCenter.y, toRect.width / 2, toRect.height / 2);

        return { key: `${rel.from}.${rel.column}->${rel.to}-${i}`, ...rel, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
      })
      .filter(Boolean);

    setLines(next);

    let maxX = containerEl.clientWidth;
    let maxY = 480;
    Object.values(positions).forEach((p) => {
      maxX = Math.max(maxX, p.x + BOX_WIDTH + PADDING);
      maxY = Math.max(maxY, p.y + EST_BOX_HEIGHT + PADDING);
    });
    setCanvasSize({ width: maxX, height: maxY });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationships, positions]);

  useEffect(() => {
    recomputeLines();
  }, [recomputeLines]);

  useEffect(() => {
    window.addEventListener("resize", recomputeLines);
    return () => window.removeEventListener("resize", recomputeLines);
  }, [recomputeLines]);

  function handlePointerMove(e) {
    const drag = dragRef.current;
    if (!drag || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    let x = e.clientX - containerRect.left + containerRef.current.scrollLeft - drag.offsetX;
    let y = e.clientY - containerRect.top + containerRef.current.scrollTop - drag.offsetY;
    x = Math.max(0, x);
    y = Math.max(0, y);
    setPositions((prev) => ({ ...prev, [drag.name]: { x, y } }));
  }

  function handlePointerUp() {
    dragRef.current = null;
    setDraggingName(null);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }

  function handlePointerDown(e, name) {
    const el = boxRefs.current[name];
    if (!el) return;
    const boxRect = el.getBoundingClientRect();
    dragRef.current = {
      name,
      offsetX: e.clientX - boxRect.left,
      offsetY: e.clientY - boxRect.top,
    };
    setDraggingName(name);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    e.preventDefault();
  }

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!tables || tables.length === 0) {
    return <p className="chart-empty">No tables to diagram yet.</p>;
  }

  return (
    <div className="erd-shell">
      <div className="erd-hint">Drag a table by its header to rearrange -- layout only, nothing here is editable.</div>
      <div className="erd-canvas-viewport" ref={containerRef}>
        <div
          className="erd-canvas"
          style={{ width: canvasSize.width, height: canvasSize.height }}
        >
          <svg className="erd-lines" width={canvasSize.width} height={canvasSize.height}>
            <defs>
              <marker id="erd-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 Z" fill="var(--accent-data)" />
              </marker>
            </defs>
            {lines.map((l) => (
              <line
                key={l.key}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke="var(--accent-data)"
                strokeWidth="1.5"
                strokeOpacity="0.75"
                markerEnd="url(#erd-arrow)"
              />
            ))}
          </svg>

          {analyzed.map(({ table, pk, fks }) => {
            const pos = positions[table.name] || { x: 0, y: 0 };
            const fkNames = new Set(fks.map((f) => f.column));
            return (
              <div
                key={table.name}
                ref={(el) => {
                  boxRefs.current[table.name] = el;
                }}
                className={`erd-box${draggingName === table.name ? " dragging" : ""}`}
                style={{ left: pos.x, top: pos.y, width: BOX_WIDTH }}
              >
                <div
                  className="erd-box-header"
                  onPointerDown={(e) => handlePointerDown(e, table.name)}
                >
                  <span className="erd-box-name">{table.name}</span>
                  <span className="erd-box-rows">{table.rowCount.toLocaleString()} rows</span>
                </div>
                <ul className="erd-box-columns">
                  {table.columns.map((col) => (
                    <li key={col.name}>
                      <span className="erd-col-name">{col.name}</span>
                      <span className="erd-col-type">{col.type}</span>
                      {pk && pk.name === col.name && <span className="schema-key-badge pk">PK</span>}
                      {fkNames.has(col.name) && <span className="schema-key-badge fk">FK</span>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
