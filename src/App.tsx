import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import { PREDEFINED_UNITS, evaluateWorksheet, type WorksheetRow } from './lib/mathEngine';

type FocusField = 'assign' | 'expr' | 'outUnits';

type CanvasRow = WorksheetRow & {
  x: number;
  y: number;
  created: number;
  assignVisible: boolean;
  exprVisible: boolean;
  outUnitsVisible: boolean;
  showResult: boolean;
};

type SavedSheet = {
  rows: CanvasRow[];
  savedAt: number;
};

type SavedSheetMeta = {
  name: string;
  savedAt: number;
};

type ExampleSheet = {
  name: string;
  description: string;
  rows: Array<Partial<CanvasRow>>;
};

const STORAGE_KEY = 'mathpad.saved-sheets.v1';
const ROW_HEIGHT = 42;

const makeRow = (x: number, y: number, overrides?: Partial<CanvasRow>): CanvasRow => ({
  id: crypto.randomUUID(),
  x,
  y,
  created: performance.now(),
  assign: '',
  expr: '',
  outUnits: '',
  assignVisible: true,
  exprVisible: false,
  outUnitsVisible: false,
  showResult: false,
  ...overrides
});

const fromPartialRows = (rows: Array<Partial<CanvasRow>>): CanvasRow[] => {
  return rows.map((r, index) =>
    makeRow(r.x ?? 110, r.y ?? 150 + index * ROW_HEIGHT, {
      assign: r.assign ?? '',
      expr: r.expr ?? '',
      outUnits: r.outUnits ?? '',
      assignVisible: r.assignVisible ?? true,
      exprVisible: r.exprVisible ?? (r.expr ?? '').trim() !== '',
      outUnitsVisible: r.outUnitsVisible ?? (r.outUnits ?? '').trim() !== '',
      showResult: r.showResult ?? (r.expr ?? '').trim() !== ''
    })
  );
};

const EXAMPLE_SHEETS: ExampleSheet[] = [
  {
    name: 'Mechanical - Stress',
    description: 'Stress from force and cross-sectional area.',
    rows: [
      { x: 110, y: 150, assign: 'F', expr: '12000N', assignVisible: true, exprVisible: true, showResult: true },
      { x: 110, y: 190, assign: 'A', expr: '45cm^2', assignVisible: true, exprVisible: true, showResult: true },
      { x: 110, y: 230, expr: 'F/A', exprVisible: true, showResult: true, outUnits: 'MPa', outUnitsVisible: true }
    ]
  },
  {
    name: 'Electrical - Ohms Law',
    description: 'Current and power from voltage/resistance.',
    rows: [
      { x: 110, y: 150, assign: 'V', expr: '48V', assignVisible: true, exprVisible: true, showResult: true },
      { x: 110, y: 190, assign: 'R', expr: '12ohm', assignVisible: true, exprVisible: true, showResult: true },
      { x: 110, y: 230, assign: 'I', expr: 'V/R', assignVisible: true, exprVisible: true, showResult: true, outUnits: 'A', outUnitsVisible: true },
      { x: 110, y: 270, expr: 'V*I', exprVisible: true, showResult: true, outUnits: 'W', outUnitsVisible: true }
    ]
  },
  {
    name: 'Civil - Hydrostatic',
    description: 'Pressure at fluid depth.',
    rows: [
      { x: 110, y: 150, assign: 'rho', expr: '1000kg/m^3', assignVisible: true, exprVisible: true, showResult: true },
      { x: 110, y: 190, assign: 'g', expr: '9.81m/s^2', assignVisible: true, exprVisible: true, showResult: true },
      { x: 110, y: 230, assign: 'h', expr: '8m', assignVisible: true, exprVisible: true, showResult: true },
      { x: 110, y: 270, expr: 'rho*g*h', exprVisible: true, showResult: true, outUnits: 'kPa', outUnitsVisible: true }
    ]
  },
  {
    name: 'Thermal - Conduction',
    description: '1D steady heat transfer rate.',
    rows: [
      { x: 110, y: 150, assign: 'k', expr: '205W/m/K', assignVisible: true, exprVisible: true, showResult: true },
      { x: 110, y: 190, assign: 'A', expr: '0.015m^2', assignVisible: true, exprVisible: true, showResult: true },
      { x: 110, y: 230, assign: 'dT', expr: '60K', assignVisible: true, exprVisible: true, showResult: true },
      { x: 110, y: 270, assign: 'L', expr: '0.08m', assignVisible: true, exprVisible: true, showResult: true },
      { x: 110, y: 310, expr: 'k*A*dT/L', exprVisible: true, showResult: true, outUnits: 'W', outUnitsVisible: true }
    ]
  },
  {
    name: 'Chemical - Ideal Gas',
    description: 'Pressure from ideal gas relation.',
    rows: [
      { x: 110, y: 150, assign: 'n', expr: '2.4mol', assignVisible: true, exprVisible: true, showResult: true },
      { x: 110, y: 190, assign: 'R', expr: '8.314J/mol/K', assignVisible: true, exprVisible: true, showResult: true },
      { x: 110, y: 230, assign: 'T', expr: '330K', assignVisible: true, exprVisible: true, showResult: true },
      { x: 110, y: 270, assign: 'V', expr: '0.05m^3', assignVisible: true, exprVisible: true, showResult: true },
      { x: 110, y: 310, expr: 'n*R*T/V', exprVisible: true, showResult: true, outUnits: 'kPa', outUnitsVisible: true }
    ]
  }
];

function parseSavedSheets(): Record<string, SavedSheet> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, SavedSheet>;
    if (typeof parsed !== 'object' || parsed == null) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function normalizeLoadedRow(row: Partial<CanvasRow>, index: number): CanvasRow {
  const assign = row.assign ?? '';
  const expr = row.expr ?? '';
  const outUnits = row.outUnits ?? '';

  return makeRow(row.x ?? 110, row.y ?? 150 + index * ROW_HEIGHT, {
    assign,
    expr,
    outUnits,
    assignVisible: row.assignVisible ?? (assign !== '' || expr === ''),
    exprVisible: row.exprVisible ?? expr !== '',
    outUnitsVisible: row.outUnitsVisible ?? outUnits !== '',
    showResult: row.showResult ?? expr !== ''
  });
}

function toFlatText(rows: CanvasRow[]): string {
  const ordered = [...rows].sort((a, b) => a.y - b.y || a.created - b.created);
  const header = '# x\ty\tassign\texpr\toutUnits';
  const lines = ordered.map((row) => [row.x, row.y, row.assign, row.expr, row.outUnits].join('\t'));
  return [header, ...lines].join('\n');
}

function fromFlatText(text: string): CanvasRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line !== '' && !line.startsWith('#'));

  return lines.map((line, index) => {
    const [xRaw, yRaw, assign = '', expr = '', outUnits = ''] = line.split('\t');
    const x = Number(xRaw);
    const y = Number(yRaw);

    return normalizeLoadedRow(
      {
        x: Number.isFinite(x) ? x : 110,
        y: Number.isFinite(y) ? y : 150 + index * ROW_HEIGHT,
        assign,
        expr,
        outUnits
      },
      index
    );
  });
}

export default function App() {
  const [rows, setRows] = createStore<CanvasRow[]>([
    makeRow(110, 150, {
      assign: 'F',
      expr: '21N',
      exprVisible: true,
      showResult: true,
      outUnitsVisible: true,
      outUnits: 'kPa'
    })
  ]);

  const [pendingFocus, setPendingFocus] = createSignal<{ id: string; field: FocusField } | null>(null);
  const [unitsModalOpen, setUnitsModalOpen] = createSignal(false);
  const [flatModalOpen, setFlatModalOpen] = createSignal(false);
  const [flatText, setFlatText] = createSignal('');
  const [headerCollapsed, setHeaderCollapsed] = createSignal(false);

  const [savedSheets, setSavedSheets] = createSignal<SavedSheetMeta[]>([]);
  const [selectedSavedName, setSelectedSavedName] = createSignal('');
  const [selectedExample, setSelectedExample] = createSignal(EXAMPLE_SHEETS[0].name);

  const [dragging, setDragging] = createSignal<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [suppressNextWorkspaceClick, setSuppressNextWorkspaceClick] = createSignal(false);

  createEffect(() => {
    const next = pendingFocus();
    if (!next) {
      return;
    }

    queueMicrotask(() => {
      const element = document.querySelector<HTMLInputElement>(
        `[data-row-id="${next.id}"][data-field="${next.field}"]`
      );
      if (element) {
        element.focus();
        element.select();
      }
      setPendingFocus(null);
    });
  });

  const orderedRows = createMemo(() => [...rows].sort((a, b) => a.y - b.y || a.created - b.created));

  const resultById = createMemo(() => {
    const worksheetRows: WorksheetRow[] = orderedRows().map((row) => ({
      id: row.id,
      assign: row.assign,
      expr: row.expr,
      outUnits: row.outUnits
    }));

    const results = evaluateWorksheet(worksheetRows);
    return new Map(results.map((result, index) => [orderedRows()[index].id, result]));
  });

  const refreshSavedSheets = () => {
    const saved = parseSavedSheets();
    const items = Object.entries(saved)
      .map(([name, data]) => ({ name, savedAt: data.savedAt ?? 0 }))
      .sort((a, b) => b.savedAt - a.savedAt);
    setSavedSheets(items);

    if (items.length > 0 && !items.some((x) => x.name === selectedSavedName())) {
      setSelectedSavedName(items[0].name);
    }
  };

  onMount(() => {
    refreshSavedSheets();
  });

  const updateRow = (id: string, patch: Partial<CanvasRow>) => {
    const idx = rows.findIndex((row) => row.id === id);
    if (idx < 0) {
      return;
    }

    for (const [key, value] of Object.entries(patch)) {
      setRows(idx, key as keyof CanvasRow, value as never);
    }
  };

  const addRowAt = (x: number, y: number, focus: FocusField = 'assign') => {
    const row = makeRow(x, y);
    setRows((prev) => [...prev, row]);
    setPendingFocus({ id: row.id, field: focus });
  };

  const addBelow = (row: CanvasRow, focus: FocusField = 'assign') => {
    addRowAt(row.x, row.y + ROW_HEIGHT, focus);
  };

  const resetSheet = () => {
    setRows([]);
  };

  const pruneEmptyRows = () => {
    setRows((prev) => prev.filter((row) => row.assign.trim() !== '' || row.expr.trim() !== '' || row.outUnits.trim() !== ''));
  };

  const saveCurrentSheet = () => {
    const name = window.prompt('Save worksheet as:', selectedSavedName() || 'sheet-1')?.trim();
    if (!name) {
      return;
    }

    const saved = parseSavedSheets();
    saved[name] = {
      rows: rows.map((row, index) => normalizeLoadedRow(row, index)),
      savedAt: Date.now()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    refreshSavedSheets();
    setSelectedSavedName(name);
  };

  const loadSavedSheet = () => {
    const name = selectedSavedName();
    if (!name) {
      return;
    }

    const saved = parseSavedSheets();
    const data = saved[name];
    if (!data) {
      return;
    }

    const loaded = (data.rows ?? []).map((row, index) => normalizeLoadedRow(row, index));
    setRows(loaded);
  };

  const loadExampleSheet = () => {
    const name = selectedExample();
    const example = EXAMPLE_SHEETS.find((x) => x.name === name);
    if (!example) {
      return;
    }

    setRows(fromPartialRows(example.rows));
  };

  const openFlatModal = () => {
    setFlatText(toFlatText(rows));
    setFlatModalOpen(true);
  };

  const applyFlatText = () => {
    const parsed = fromFlatText(flatText());
    setRows(parsed);
    setFlatModalOpen(false);
  };

  const workspaceClick = (event: MouseEvent) => {
    if (suppressNextWorkspaceClick()) {
      setSuppressNextWorkspaceClick(false);
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest('.calc-row') || target.closest('.topbar') || target.closest('.modal-overlay')) {
      return;
    }

    pruneEmptyRows();
    addRowAt(event.clientX, event.clientY);
  };

  const onAssignKeyDown = (event: KeyboardEvent, row: CanvasRow) => {
    if (event.key === ':') {
      event.preventDefault();
      updateRow(row.id, { exprVisible: true, assignVisible: true });
      setPendingFocus({ id: row.id, field: 'expr' });
      return;
    }

    if (event.key === '=') {
      event.preventDefault();
      const expr = row.assign.trim();
      updateRow(row.id, {
        assign: '',
        assignVisible: false,
        expr,
        exprVisible: true,
        showResult: true,
        outUnitsVisible: true
      });
      setPendingFocus({ id: row.id, field: 'expr' });
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      addBelow(row);
    }
  };

  const onExprKeyDown = (event: KeyboardEvent, row: CanvasRow) => {
    if (event.key === ':') {
      event.preventDefault();
      updateRow(row.id, { assignVisible: true, exprVisible: true });
      setPendingFocus({ id: row.id, field: 'assign' });
      return;
    }

    if (event.key === '=') {
      event.preventDefault();
      updateRow(row.id, { showResult: true, outUnitsVisible: true });
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      addBelow(row);
    }
  };

  const onUnitsKeyDown = (event: KeyboardEvent, row: CanvasRow) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addBelow(row);
    }
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  createEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const bareEscape =
        event.key === 'Escape' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
      if (!bareEscape) {
        return;
      }
      pruneEmptyRows();
    };

    window.addEventListener('keydown', onKeyDown);
    onCleanup(() => window.removeEventListener('keydown', onKeyDown));
  });

  const onDragMove = (event: PointerEvent) => {
    const active = dragging();
    if (!active) {
      return;
    }

    const x = Math.max(8, event.clientX - active.offsetX);
    const y = Math.max(70, event.clientY - active.offsetY);
    updateRow(active.id, { x, y });
  };

  const stopDrag = () => {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', stopDrag);
    window.removeEventListener('pointercancel', stopDrag);
    setDragging(null);
    queueMicrotask(() => setSuppressNextWorkspaceClick(false));
  };

  const startDrag = (event: PointerEvent, row: CanvasRow) => {
    event.preventDefault();
    event.stopPropagation();
    setSuppressNextWorkspaceClick(true);
    stopDrag();

    const offsetX = event.clientX - row.x;
    const offsetY = event.clientY - row.y;
    setDragging({ id: row.id, offsetX, offsetY });
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);

    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
  };

  return (
    <main class="workspace" onClick={workspaceClick}>
      <Show when={!headerCollapsed()} fallback={<button class="header-collapsed" onClick={() => setHeaderCollapsed(false)}>Open mathPAD</button>}>
        <header class="topbar">
          <div class="topbar-head">
            <h1>mathPAD</h1>
            <button class="ghost" onClick={() => setHeaderCollapsed(true)}>Collapse</button>
          </div>

          <p>Click to place rows, drag to reorder, and use `:` / `=` keyboard flow.</p>

          <div class="controls-row">
            <button type="button" onClick={() => addRowAt(110, 140)}>Add Row</button>
            <button type="button" onClick={saveCurrentSheet}>Save</button>
            <button type="button" onClick={loadSavedSheet}>Load</button>
            <select value={selectedSavedName()} onChange={(e) => setSelectedSavedName(e.currentTarget.value)}>
              <option value="">Saved sheets...</option>
              <For each={savedSheets()}>{(sheet) => <option value={sheet.name}>{sheet.name}</option>}</For>
            </select>
          </div>

          <div class="controls-row">
            <button type="button" onClick={loadExampleSheet}>Load Example</button>
            <select value={selectedExample()} onChange={(e) => setSelectedExample(e.currentTarget.value)}>
              <For each={EXAMPLE_SHEETS}>
                {(example) => <option value={example.name}>{example.name}</option>}
              </For>
            </select>
            <span class="hint">{EXAMPLE_SHEETS.find((x) => x.name === selectedExample())?.description}</span>
          </div>

          <div class="controls-row">
            <button type="button" onClick={() => setUnitsModalOpen(true)}>Units</button>
            <button type="button" onClick={openFlatModal}>Flat View</button>
            <button type="button" onClick={resetSheet}>Reset</button>
          </div>
        </header>
      </Show>

      <For each={rows}>
        {(row) => {
          const result = () => resultById().get(row.id);
          return (
            <div class="calc-row" style={{ left: `${row.x}px`, top: `${row.y}px` }} onClick={(e) => e.stopPropagation()}>
              <button type="button" class="drag-handle" title="Drag row" onPointerDown={(e) => startDrag(e, row)}>::</button>

              <Show when={row.assignVisible}>
                <input
                  data-row-id={row.id}
                  data-field="assign"
                  class="mini-input"
                  value={row.assign}
                  onInput={(e) => updateRow(row.id, { assign: e.currentTarget.value })}
                  onKeyDown={(e) => onAssignKeyDown(e, row)}
                  placeholder="F"
                />
              </Show>

              <Show when={row.assignVisible}>
                <span class="sep">:=</span>
              </Show>

              <Show when={row.exprVisible}>
                <input
                  data-row-id={row.id}
                  data-field="expr"
                  class="mini-input expr"
                  value={row.expr}
                  onInput={(e) => updateRow(row.id, { expr: e.currentTarget.value })}
                  onKeyDown={(e) => onExprKeyDown(e, row)}
                  placeholder="21N"
                />
              </Show>

              <Show when={row.exprVisible && row.showResult}>
                <span class="sep">=</span>
                <span class={`result ${result()?.ok ? 'ok' : 'error'}`}>{result()?.ok ? result()?.valueText : result()?.error}</span>
              </Show>

              <Show when={row.outUnitsVisible}>
                <input
                  data-row-id={row.id}
                  data-field="outUnits"
                  class="mini-input units"
                  value={row.outUnits}
                  onInput={(e) => updateRow(row.id, { outUnits: e.currentTarget.value, showResult: true })}
                  onKeyDown={(e) => onUnitsKeyDown(e, row)}
                  placeholder="kPa"
                />
              </Show>

              <button type="button" class="row-remove" onClick={() => removeRow(row.id)}>×</button>
            </div>
          );
        }}
      </For>

      <Show when={unitsModalOpen()}>
        <div class="modal-overlay" onClick={() => setUnitsModalOpen(false)}>
          <section class="modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h2>Predefined Units</h2>
              <button type="button" onClick={() => setUnitsModalOpen(false)}>Close</button>
            </div>
            <div class="units-grid">
              <For each={PREDEFINED_UNITS}>
                {(unit) => (
                  <div class="unit-item">
                    <code>{unit.symbol}</code>
                    <span>{unit.name}</span>
                    <small>{unit.category}</small>
                  </div>
                )}
              </For>
            </div>
          </section>
        </div>
      </Show>

      <Show when={flatModalOpen()}>
        <div class="modal-overlay" onClick={() => setFlatModalOpen(false)}>
          <section class="modal flat-modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h2>Flat Text View</h2>
              <button type="button" onClick={() => setFlatModalOpen(false)}>Close</button>
            </div>
            <p class="hint">Edit rows as tab-separated values: `x  y  assign  expr  outUnits`.</p>
            <textarea
              class="flat-text"
              value={flatText()}
              onInput={(e) => setFlatText(e.currentTarget.value)}
              spellcheck={false}
            />
            <div class="controls-row">
              <button type="button" onClick={applyFlatText}>Apply</button>
              <button type="button" onClick={() => setFlatText(toFlatText(rows))}>Reset Text</button>
            </div>
          </section>
        </div>
      </Show>
    </main>
  );
}
