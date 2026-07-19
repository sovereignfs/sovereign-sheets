import { notFound } from 'next/navigation';
import { getWorkbook } from '../actions';
import { WorkbookView } from '../_components/WorkbookView';
import styles from './page.module.css';

export default async function WorkbookPage({
  params,
}: {
  params: Promise<{ workbookId: string }>;
}) {
  const { workbookId } = await params;
  const data = await getWorkbook(workbookId);
  if (!data) notFound();

  return (
    <div className={styles.page}>
      <WorkbookView workbookId={data.workbook.id} name={data.workbook.name} sheets={data.sheets} />
    </div>
  );
}
