'use client';

import { useMemo, useRef, useState } from 'react';
import type { HyperFormula } from 'hyperformula';
import { StatusBadge, type StatusBadgeStatus } from '@sovereignfs/ui';
import { saveSheetCellsAction } from '../actions';
import { cellKey, colIndexToLetters } from '../_lib/a1';
import { serializeCellsJson } from '../_lib/cells';
import { displayValue, gridToCellsMap } from '../_lib/formula-engine';
import { FormulaBar } from './FormulaBar';
import styles from './SheetGrid.module.css';

const AUTOSAVE_DELAY_MS = 1200;

export function SheetGrid({
  engine,
  hfSheetId,
  sheetId,
  rowCount,
  colCount,
  version,
  onVersionChange,
}: {
  engine: HyperFormula;
  hfSheetId: number;
  sheetId: string;
  rowCount: number;
  colCount: number;
  version: number;
  onVersionChange: (next: number) => void;
}) {
  const [status, setStatus] = useState<StatusBadgeStatus>('synced');
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const columnLabels = useMemo(
    () => Array.from({ length: colCount }, (_, i) => colIndexToLetters(i)),
    [colCount],
  );

  function getRawInput(row: number, col: number): string {
    const formula = engine.getCellFormula({ sheet: hfSheetId, row, col });
    if (formula !== undefined) return formula;
    const value = engine.getCellValue({ sheet: hfSheetId, row, col });
    return value === null || value === undefined ? '' : String(value);
  }

  function getDisplay(row: number, col: number): string {
    return displayValue(engine.getCellValue({ sheet: hfSheetId, row, col }));
  }

  function scheduleSave() {
    setStatus('draft');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const grid = engine.getSheetSerialized(hfSheetId);
      void saveSheetCellsAction(sheetId, serializeCellsJson(gridToCellsMap(grid)))
        .then(() => setStatus('synced'))
        .catch(() => setStatus('error'));
    }, AUTOSAVE_DELAY_MS);
  }

  function commitCell(row: number, col: number, raw: string) {
    engine.setCellContents({ sheet: hfSheetId, row, col }, [[raw === '' ? null : raw]]);
    onVersionChange(version + 1);
    scheduleSave();
  }

  return (
    <div className={styles.wrapper}>
      <FormulaBar
        cellLabel={activeCell ? cellKey(activeCell.row, activeCell.col) : ''}
        value={activeCell ? getRawInput(activeCell.row, activeCell.col) : ''}
        disabled={!activeCell}
        onCommit={(value) => {
          if (activeCell) commitCell(activeCell.row, activeCell.col, value);
        }}
      />
      <div className={styles.toolbar}>
        <StatusBadge status={status} />
      </div>
      <div className={styles.scroller}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th className={styles.cornerHeader} />
              {columnLabels.map((label) => (
                <th key={label} className={styles.colHeader}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, row) => (
              <tr key={row}>
                <th className={styles.rowHeader}>{row + 1}</th>
                {columnLabels.map((_, col) => {
                  const key = cellKey(row, col);
                  const isActive = activeCell?.row === row && activeCell?.col === col;
                  return (
                    <td key={key} className={styles.cell}>
                      <input
                        className={styles.cellInput}
                        value={isActive ? getRawInput(row, col) : getDisplay(row, col)}
                        onFocus={() => setActiveCell({ row, col })}
                        onChange={(e) => commitCell(row, col, e.target.value)}
                        aria-label={key}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
