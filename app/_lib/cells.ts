/** A single cell's stored data. `f` (formula source, including the leading `=`) is added in a later task. */
export interface CellData {
  v?: string | number;
  f?: string;
  fmt?: 'plain' | 'number' | 'currency' | 'date';
}

export type CellsMap = Record<string, CellData>;

export function parseCellsJson(json: string): CellsMap {
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as CellsMap;
    }
    return {};
  } catch {
    return {};
  }
}

export function serializeCellsJson(cells: CellsMap): string {
  // Drop empty cells so autosave doesn't grow the blob unboundedly.
  const compact: CellsMap = {};
  for (const [key, cell] of Object.entries(cells)) {
    if (cell.v !== undefined && cell.v !== '') compact[key] = cell;
  }
  return JSON.stringify(compact);
}
