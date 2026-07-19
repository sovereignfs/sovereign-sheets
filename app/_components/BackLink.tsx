import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './BackLink.module.css';

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.backLink}>
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}
