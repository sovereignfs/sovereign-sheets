'use server';

import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sdk } from '@sovereignfs/sdk';
import { financeRateCache, sheets, workbooks } from './_db/schema';
import { DEFAULT_COL_COUNT, DEFAULT_ROW_COUNT } from './_lib/config';
import { formString, now } from './_lib/formUtils';
import { fetchFrankfurterRates } from './_lib/frankfurter';
import { pairKey } from './_lib/finance-function';

const FINANCE_RATE_TTL_SECONDS = 6 * 60 * 60;

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

export interface FinanceRateResult {
  rate: number;
  asOf: number;
}

/**
 * Resolves currency rates for FINANCE() calls, one batched round-trip per
 * distinct base currency. No auth/tenant scoping — rates are cached
 * instance-wide (public market data), same rationale as
 * sovereign-ledger's ledger_fx_rates.
 */
export async function getFinanceRatesAction(
  pairs: { base: string; quote: string }[],
): Promise<Record<string, FinanceRateResult | null>> {
  const db = (await sdk.db.getClient()) as Db;
  const nowTs = now();
  const result: Record<string, FinanceRateResult | null> = {};
  const toFetch = new Map<string, Set<string>>();

  for (const { base: rawBase, quote: rawQuote } of pairs) {
    const base = rawBase.trim().toUpperCase();
    const quote = rawQuote.trim().toUpperCase();
    const key = pairKey(base, quote);
    if (key in result) continue;
    if (base === quote) {
      result[key] = { rate: 1, asOf: nowTs };
      continue;
    }

    const [cached] = await db
      .select()
      .from(financeRateCache)
      .where(and(eq(financeRateCache.base, base), eq(financeRateCache.quote, quote)))
      .limit(1);

    if (cached && nowTs - cached.fetchedAt < FINANCE_RATE_TTL_SECONDS) {
      result[key] = { rate: Number(cached.rate), asOf: cached.asOf };
      continue;
    }

    if (!toFetch.has(base)) toFetch.set(base, new Set());
    toFetch.get(base)?.add(quote);
  }

  for (const [base, quotes] of toFetch) {
    const fetched = await fetchFrankfurterRates(base, [...quotes]);

    if (!fetched) {
      // Frankfurter unreachable — serve stale cache if we have it, else null.
      for (const quote of quotes) {
        const key = pairKey(base, quote);
        const [cached] = await db
          .select()
          .from(financeRateCache)
          .where(and(eq(financeRateCache.base, base), eq(financeRateCache.quote, quote)))
          .limit(1);
        result[key] = cached ? { rate: Number(cached.rate), asOf: cached.asOf } : null;
      }
      continue;
    }

    const asOf = Math.floor(new Date(fetched.date).getTime() / 1000) || nowTs;
    for (const quote of quotes) {
      const key = pairKey(base, quote);
      const rate = fetched.rates[quote];
      if (rate === undefined) {
        result[key] = null;
        continue;
      }
      result[key] = { rate, asOf };
      const rateStr = String(rate);
      await db
        .insert(financeRateCache)
        .values({ base, quote, rate: rateStr, asOf, fetchedAt: nowTs, source: 'frankfurter' })
        .onConflictDoUpdate({
          target: [financeRateCache.base, financeRateCache.quote],
          set: { rate: rateStr, asOf, fetchedAt: nowTs, source: 'frankfurter' },
        });
    }
  }

  return result;
}
