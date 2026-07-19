import { EmptyState, PageHeader } from '@sovereignfs/ui';
import styles from './page.module.css';

export default function SheetsPage() {
  return (
    <div className={styles.page}>
      <PageHeader title="Sheets" description="Your spreadsheets." />
      <EmptyState
        heading="No workbooks yet"
        description="Workbooks you create will show up here."
      />
    </div>
  );
}
