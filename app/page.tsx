import Link from 'next/link';
import { Button, Card, EmptyState, Input, PageHeader } from '@sovereignfs/ui';
import { createWorkbookAction, listWorkbooks } from './actions';
import styles from './page.module.css';

function formatUpdatedAt(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function SheetsPage() {
  const workbooks = await listWorkbooks();

  return (
    <div className={styles.page}>
      <PageHeader title="Sheets" description="Your spreadsheets." />

      <form action={createWorkbookAction} className={styles.newWorkbookForm}>
        <Input name="name" placeholder="Untitled workbook" aria-label="New workbook name" />
        <Button type="submit">New workbook</Button>
      </form>

      {workbooks.length === 0 ? (
        <EmptyState
          heading="No workbooks yet"
          description="Workbooks you create will show up here."
        />
      ) : (
        <ul className={styles.workbookList}>
          {workbooks.map((wb) => (
            <li key={wb.id}>
              <Link href={`/sheets/${wb.id}`} className={styles.workbookLink}>
                <Card interactive className={styles.workbookCard}>
                  <span className={styles.workbookName}>{wb.name}</span>
                  <span className={styles.workbookMeta}>
                    Updated {formatUpdatedAt(wb.updatedAt)}
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
