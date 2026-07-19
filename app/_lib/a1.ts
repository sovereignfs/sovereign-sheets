/** A1-style cell reference helpers: 0-indexed row/col <-> "A1" style keys. */

export function colIndexToLetters(colIndex: number): string {
  let n = colIndex + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export function cellKey(row: number, col: number): string {
  return `${colIndexToLetters(col)}${row + 1}`;
}
