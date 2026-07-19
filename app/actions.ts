'use server';

import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sdk } from '@sovereignfs/sdk';
import { sheets, workbooks } from './_db/schema';
import { DEFAULT_COL_COUNT, DEFAULT_ROW_COUNT } from './_lib/config';
import { formString, now } from './_lib/formUtils';

// DrizzleClient is typed as `unknown` in the SDK (dialect-agnostic contract).
// This plugin's manifest pins an isolated SQLite store, so the cast is safe.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BaseSQLiteDatabase<'async', any, any>;

export interface WorkbookListItem {
  id: string;
  name: string;
  updatedAt: number;
}

export async function listWorkbooks(): Promise<WorkbookListItem[]> {
  const session = await sdk.auth.requireSession();
  const db = (await sdk.db.getClient()) as Db;

  const rows = await db
    .select({ id: workbooks.id, name: workbooks.name, updatedAt: workbooks.updatedAt })
    .from(workbooks)
    .where(
      and(
        eq(workbooks.tenantId, session.user.tenantId),
        eq(workbooks.ownerUserId, session.user.id),
        isNull(workbooks.deletedAt),
      ),
    )
    .orderBy(desc(workbooks.updatedAt));

  return rows;
}

export async function createWorkbookAction(formData: FormData): Promise<void> {
  const session = await sdk.auth.requireSession();
  const db = (await sdk.db.getClient()) as Db;

  const name = formString(formData, 'name') || 'Untitled workbook';
  const timestamp = now();
  const workbookId = randomUUID();
  const sheetId = randomUUID();

  await db.insert(workbooks).values({
    id: workbookId,
    tenantId: session.user.tenantId,
    ownerUserId: session.user.id,
    name,
    activeSheetId: sheetId,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await db.insert(sheets).values({
    id: sheetId,
    tenantId: session.user.tenantId,
    workbookId,
    name: 'Sheet1',
    position: 0,
    rowCount: DEFAULT_ROW_COUNT,
    colCount: DEFAULT_COL_COUNT,
    cellsJson: '{}',
    updatedAt: timestamp,
  });

  revalidatePath('/sheets');
  redirect(`/sheets/${workbookId}`);
}

export interface WorkbookWithSheets {
  workbook: { id: string; name: string; activeSheetId: string | null };
  sheets: {
    id: string;
    name: string;
    position: number;
    rowCount: number;
    colCount: number;
    cellsJson: string;
  }[];
}

export async function getWorkbook(workbookId: string): Promise<WorkbookWithSheets | null> {
  const session = await sdk.auth.requireSession();
  const db = (await sdk.db.getClient()) as Db;

  const [workbook] = await db
    .select()
    .from(workbooks)
    .where(
      and(
        eq(workbooks.id, workbookId),
        eq(workbooks.tenantId, session.user.tenantId),
        eq(workbooks.ownerUserId, session.user.id),
        isNull(workbooks.deletedAt),
      ),
    )
    .limit(1);

  if (!workbook) return null;

  const sheetRows = await db
    .select()
    .from(sheets)
    .where(and(eq(sheets.workbookId, workbookId), eq(sheets.tenantId, session.user.tenantId)))
    .orderBy(asc(sheets.position));

  return {
    workbook: {
      id: workbook.id,
      name: workbook.name,
      activeSheetId: workbook.activeSheetId,
    },
    sheets: sheetRows.map((s) => ({
      id: s.id,
      name: s.name,
      position: s.position,
      rowCount: s.rowCount,
      colCount: s.colCount,
      cellsJson: s.cellsJson,
    })),
  };
}

export async function saveSheetCellsAction(sheetId: string, cellsJson: string): Promise<void> {
  const session = await sdk.auth.requireSession();
  const db = (await sdk.db.getClient()) as Db;

  await db
    .update(sheets)
    .set({ cellsJson, updatedAt: now() })
    .where(and(eq(sheets.id, sheetId), eq(sheets.tenantId, session.user.tenantId)));
}

export async function setActiveSheetAction(workbookId: string, sheetId: string): Promise<void> {
  const session = await sdk.auth.requireSession();
  const db = (await sdk.db.getClient()) as Db;

  await db
    .update(workbooks)
    .set({ activeSheetId: sheetId, updatedAt: now() })
    .where(
      and(
        eq(workbooks.id, workbookId),
        eq(workbooks.tenantId, session.user.tenantId),
        eq(workbooks.ownerUserId, session.user.id),
      ),
    );
}

export async function addSheetAction(
  workbookId: string,
): Promise<{ id: string; name: string } | null> {
  const session = await sdk.auth.requireSession();
  const db = (await sdk.db.getClient()) as Db;

  const existing = await db
    .select({ position: sheets.position, name: sheets.name })
    .from(sheets)
    .where(and(eq(sheets.workbookId, workbookId), eq(sheets.tenantId, session.user.tenantId)))
    .orderBy(asc(sheets.position));

  const nextPosition = existing.length === 0 ? 0 : Math.max(...existing.map((s) => s.position)) + 1;
  const existingNames = new Set(existing.map((s) => s.name));
  let n = existing.length + 1;
  let name = `Sheet${n}`;
  while (existingNames.has(name)) {
    n += 1;
    name = `Sheet${n}`;
  }

  const timestamp = now();
  const sheetId = randomUUID();

  await db.insert(sheets).values({
    id: sheetId,
    tenantId: session.user.tenantId,
    workbookId,
    name,
    position: nextPosition,
    rowCount: DEFAULT_ROW_COUNT,
    colCount: DEFAULT_COL_COUNT,
    cellsJson: '{}',
    updatedAt: timestamp,
  });

  revalidatePath(`/sheets/${workbookId}`);
  return { id: sheetId, name };
}

export async function renameSheetAction(
  sheetId: string,
  workbookId: string,
  name: string,
): Promise<void> {
  const session = await sdk.auth.requireSession();
  const db = (await sdk.db.getClient()) as Db;

  const trimmed = name.trim();
  if (!trimmed) return;

  await db
    .update(sheets)
    .set({ name: trimmed, updatedAt: now() })
    .where(and(eq(sheets.id, sheetId), eq(sheets.tenantId, session.user.tenantId)));

  revalidatePath(`/sheets/${workbookId}`);
}

export async function deleteSheetAction(sheetId: string, workbookId: string): Promise<void> {
  const session = await sdk.auth.requireSession();
  const db = (await sdk.db.getClient()) as Db;

  const remaining = await db
    .select({ id: sheets.id })
    .from(sheets)
    .where(and(eq(sheets.workbookId, workbookId), eq(sheets.tenantId, session.user.tenantId)));

  // Always keep at least one sheet per workbook.
  if (remaining.length <= 1) return;

  await db
    .delete(sheets)
    .where(and(eq(sheets.id, sheetId), eq(sheets.tenantId, session.user.tenantId)));

  const [workbook] = await db
    .select({ activeSheetId: workbooks.activeSheetId })
    .from(workbooks)
    .where(eq(workbooks.id, workbookId))
    .limit(1);

  if (workbook?.activeSheetId === sheetId) {
    const fallback = remaining.find((s) => s.id !== sheetId);
    if (fallback) {
      await db
        .update(workbooks)
        .set({ activeSheetId: fallback.id, updatedAt: now() })
        .where(eq(workbooks.id, workbookId));
    }
  }

  revalidatePath(`/sheets/${workbookId}`);
}

export async function reorderSheetsAction(
  workbookId: string,
  orderedSheetIds: string[],
): Promise<void> {
  const session = await sdk.auth.requireSession();
  const db = (await sdk.db.getClient()) as Db;

  await Promise.all(
    orderedSheetIds.map((sheetId, position) =>
      db
        .update(sheets)
        .set({ position, updatedAt: now() })
        .where(
          and(
            eq(sheets.id, sheetId),
            eq(sheets.workbookId, workbookId),
            eq(sheets.tenantId, session.user.tenantId),
          ),
        ),
    ),
  );

  revalidatePath(`/sheets/${workbookId}`);
}

export async function deleteWorkbookAction(workbookId: string): Promise<void> {
  const session = await sdk.auth.requireSession();
  const db = (await sdk.db.getClient()) as Db;

  await db
    .update(workbooks)
    .set({ deletedAt: now(), updatedAt: now() })
    .where(
      and(
        eq(workbooks.id, workbookId),
        eq(workbooks.tenantId, session.user.tenantId),
        eq(workbooks.ownerUserId, session.user.id),
      ),
    );

  revalidatePath('/sheets');
  redirect('/sheets');
}
