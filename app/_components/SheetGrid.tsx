'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { StatusBadge, type StatusBadgeStatus } from '@sovereignfs/ui';
import { saveSheetCellsAction } from '../actions';
import { cellKey, colIndexToLetters } from '../_lib/a1';
import { parseCellsJson, serializeCellsJson, type CellsMap } from '../_lib/cells';
import styles from './SheetGrid.module.css';

const AUTOSAVE_DELAY_MS = 1200;

export function SheetGrid({
  sheetId,
  rowCount,
  colCount,
  initialCellsJson,
}: {
  sheetId: string;
  rowCount: number;
  colCount: number;
  initialCellsJson: string;
}) {
  const [cells, setCells] = useState<CellsMap>(() => parseCellsJson(initialCellsJson));
  const [status, setStatus] = useState<StatusBadgeStatus>('synced');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  const columnLabels = useMemo(
    () => Array.from({ length: colCount }, (_, i) => colIndexToLetters(i)),
    [colCount],
  );

  function scheduleSave() {
    setStatus('draft');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveSheetCellsAction(sheetId, serializeCellsJson(cellsRef.current))
        .then(() => setStatus('synced'))
        .catch(() => setStatus('error'));
    }, AUTOSAVE_DELAY_MS);
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        // Flush any pending edit on unmount (e.g. switching sheets) — best effort.
        void saveSheetCellsAction(sheetId, serializeCellsJson(cellsRef.current));
      }
    };
    // Cleanup intentionally reads only refs, so it's safe to run once on unmount.
  }, []);

  function handleChange(key: string, value: string) {
    setCells((prev) => {
      if (value === '') {
        const { [key]: _removed, ...next } = prev;
        return next;
      }
      const numeric = Number(value);
      const next = { ...prev };
      next[key] = { v: !Number.isNaN(numeric) && value.trim() !== '' ? numeric : value };
      return next;
    });
    scheduleSave();
  }

  return (
    <div className={styles.wrapper}>
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
                  const cell = cells[key];
                  return (
                    <td key={key} className={styles.cell}>
                      <input
                        className={styles.cellInput}
                        value={cell?.v ?? ''}
                        onChange={(e) => handleChange(key, e.target.value)}
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
