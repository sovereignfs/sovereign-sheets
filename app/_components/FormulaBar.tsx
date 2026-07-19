'use client';

import { useEffect, useState } from 'react';
import { CodeTextarea } from '@sovereignfs/ui';
import styles from './FormulaBar.module.css';

export function FormulaBar({
  cellLabel,
  value,
  disabled,
  onCommit,
}: {
  cellLabel: string;
  value: string;
  disabled: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value, cellLabel]);

  return (
    <div className={styles.bar}>
      <span className={styles.cellLabel}>{cellLabel || '—'}</span>
      <CodeTextarea
        rows={1}
        className={styles.input}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onCommit(draft);
          }
        }}
        aria-label="Formula bar"
        placeholder={disabled ? 'Select a cell to edit' : ''}
      />
    </div>
  );
}
