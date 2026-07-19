'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@sovereignfs/ui';
import { BackLink } from './BackLink';
import { SheetTabs, type SheetTabItem } from './SheetTabs';
import { SheetGrid } from './SheetGrid';
import {
  addSheetAction,
  deleteSheetAction,
  deleteWorkbookAction,
  renameSheetAction,
  reorderSheetsAction,
  setActiveSheetAction,
} from '../actions';
import { DEFAULT_COL_COUNT, DEFAULT_ROW_COUNT } from '../_lib/config';
import styles from './WorkbookView.module.css';

export interface WorkbookSheet extends SheetTabItem {
  rowCount: number;
  colCount: number;
  cellsJson: string;
}

export function WorkbookView({
  workbookId,
  name,
  sheets: initialSheets,
}: {
  workbookId: string;
  name: string;
  sheets: WorkbookSheet[];
}) {
  const [sheetList, setSheetList] = useState(initialSheets);
  const [activeSheetId, setActiveSheetId] = useState(initialSheets[0]?.id ?? null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteWorkbook, setConfirmDeleteWorkbook] = useState(false);

  const activeSheet = sheetList.find((s) => s.id === activeSheetId) ?? sheetList[0] ?? null;

  function handleSelectSheet(id: string) {
    setActiveSheetId(id);
    void setActiveSheetAction(workbookId, id);
  }

  async function handleAddSheet() {
    const created = await addSheetAction(workbookId);
    if (!created) return;
    setSheetList((prev) => [
      ...prev,
      {
        id: created.id,
        name: created.name,
        position: prev.length,
        rowCount: DEFAULT_ROW_COUNT,
        colCount: DEFAULT_COL_COUNT,
        cellsJson: '{}',
      },
    ]);
    setActiveSheetId(created.id);
    void setActiveSheetAction(workbookId, created.id);
  }

  function handleRenameSheet(id: string, newName: string) {
    setSheetList((prev) => prev.map((s) => (s.id === id ? { ...s, name: newName } : s)));
    void renameSheetAction(id, workbookId, newName);
  }

  async function handleDeleteSheet(id: string) {
    if (sheetList.length <= 1) return;
    const remaining = sheetList.filter((s) => s.id !== id);
    setSheetList(remaining);
    if (activeSheetId === id) {
      const fallback = remaining[0];
      if (fallback) setActiveSheetId(fallback.id);
    }
    await deleteSheetAction(id, workbookId);
  }

  function handleReorder(orderedIds: string[]) {
    setSheetList((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      return orderedIds
        .map((id, position) => {
          const sheet = byId.get(id);
          return sheet ? { ...sheet, position } : null;
        })
        .filter((s): s is WorkbookSheet => s !== null);
    });
    void reorderSheetsAction(workbookId, orderedIds);
  }

  async function handleDeleteWorkbook() {
    setDeleting(true);
    await deleteWorkbookAction(workbookId);
  }

  return (
    <div className={styles.view}>
      <div className={styles.header}>
        <div>
          <BackLink href="/sheets">Back to workbooks</BackLink>
          <h1 className={styles.title}>{name}</h1>
        </div>
        <button
          type="button"
          className={styles.deleteWorkbook}
          onClick={() => setConfirmDeleteWorkbook(true)}
        >
          Delete workbook
        </button>
      </div>

      <SheetTabs
        sheets={sheetList}
        activeSheetId={activeSheetId}
        onSelect={handleSelectSheet}
        onAdd={() => void handleAddSheet()}
        onRename={handleRenameSheet}
        onDelete={(id) => void handleDeleteSheet(id)}
        onReorder={handleReorder}
      />

      {activeSheet && (
        <SheetGrid
          key={activeSheet.id}
          sheetId={activeSheet.id}
          rowCount={activeSheet.rowCount}
          colCount={activeSheet.colCount}
          initialCellsJson={activeSheet.cellsJson}
        />
      )}

      <ConfirmDialog
        open={confirmDeleteWorkbook}
        onClose={() => setConfirmDeleteWorkbook(false)}
        title="Delete workbook"
        message={
          <>
            Delete <strong>{name}</strong>? This can&apos;t be undone.
          </>
        }
        onConfirm={() => void handleDeleteWorkbook()}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        destructive
        pending={deleting}
      />
    </div>
  );
}
