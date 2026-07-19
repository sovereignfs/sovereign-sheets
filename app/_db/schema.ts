import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Runtime query schema for Sheets.
 *
 * This file intentionally lives under app/ because the Sovereign runtime mounts
 * the plugin app tree into Next routes. Server components/actions must not
 * import runtime query helpers from outside that mounted tree.
 *
 * Isolated SQLite store — no slug prefix required on table names, but
 * tenant_id + an owning-user column are still required on user-scoped tables
 * (docs/plugin-database.md's "Still required in isolated stores").
 */

export const workbooks = sqliteTable(
  'workbooks',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    ownerUserId: text('owner_user_id').notNull(),
    name: text('name').notNull(),
    activeSheetId: text('active_sheet_id'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (t) => [index('workbooks_tenant_owner_idx').on(t.tenantId, t.ownerUserId)],
);

export const sheets = sqliteTable(
  'sheets',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    workbookId: text('workbook_id')
      .notNull()
      .references(() => workbooks.id),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    rowCount: integer('row_count').notNull().default(200),
    colCount: integer('col_count').notNull().default(26),
    /** Sparse A1-keyed map: `{ [a1Ref]: { v?: string|number, f?: string, fmt?: string } }`. */
    cellsJson: text('cells_json').notNull().default('{}'),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('sheets_workbook_idx').on(t.workbookId)],
);

/**
 * Instance-wide currency-rate cache for FINANCE(), fetched from Frankfurter.
 * Deliberately NOT tenant/user-scoped — exchange rates are public data, same
 * rationale as sovereign-ledger's untenanted `ledger_fx_rates` cache.
 */
export const financeRateCache = sqliteTable(
  'finance_rate_cache',
  {
    base: text('base').notNull(),
    quote: text('quote').notNull(),
    /** Canonical decimal string, e.g. "1.0842" — never a float. */
    rate: text('rate').notNull(),
    asOf: integer('as_of').notNull(),
    fetchedAt: integer('fetched_at').notNull(),
    source: text('source').notNull().default('frankfurter'),
  },
  (t) => [primaryKey({ columns: [t.base, t.quote] })],
);

export const sheetsTables = {
  workbooks,
  sheets,
  financeRateCache,
};

export type Workbook = InferSelectModel<typeof workbooks>;
export type Sheet = InferSelectModel<typeof sheets>;
export type FinanceRateCacheEntry = InferSelectModel<typeof financeRateCache>;
export type NewWorkbook = InferInsertModel<typeof workbooks>;
export type NewSheet = InferInsertModel<typeof sheets>;
export type NewFinanceRateCacheEntry = InferInsertModel<typeof financeRateCache>;
