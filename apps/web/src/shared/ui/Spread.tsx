import type { ReactNode } from 'react';
import styles from './Spread.module.css';

interface SpreadProps {
  /** A section number such as `01`, set above the title. */
  index: string;
  title: string;
  lede: ReactNode;
  children: ReactNode;
}

/**
 * The editorial layout of the guest pages: a large title and one line of copy
 * on the left (5 of 12 columns), the working part on the right (7 of 12).
 */
export function Spread({ index, title, lede, children }: SpreadProps) {
  return (
    <section className={styles.spread} aria-labelledby="page-title">
      <div className={styles.intro}>
        <p className={styles.index}>Nº {index}</p>
        <h1 id="page-title" className={styles.title} tabIndex={-1}>
          {title}
        </h1>
        <p className={styles.lede}>{lede}</p>
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
