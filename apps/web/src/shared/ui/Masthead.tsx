import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { paths } from '../paths';
import styles from './Masthead.module.css';

export interface IndexEntry {
  number: string;
  label: string;
  to: string;
}

/** The strip above every page: the wordmark, then a numbered index of where you can go. */
export function Masthead({ entries = [] }: { entries?: readonly IndexEntry[] }) {
  return (
    <header className={styles.masthead}>
      <Link to={paths.home} className={styles.wordmark}>
        Auth <span aria-hidden="true">/</span> Module
      </Link>
      {entries.length > 0 && (
        <nav aria-label="Main">
          <ol className={styles.index}>
            {entries.map((entry) => (
              <li key={entry.to}>
                <NavLink to={entry.to} className={styles.entry}>
                  <IndexNumber>{entry.number}</IndexNumber>
                  {entry.label}
                </NavLink>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </header>
  );
}

function IndexNumber({ children }: { children: ReactNode }) {
  return (
    <span className={styles.number} aria-hidden="true">
      {children}
    </span>
  );
}
