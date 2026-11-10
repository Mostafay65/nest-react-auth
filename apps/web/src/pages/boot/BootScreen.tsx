import { Masthead } from '@/shared/ui/Masthead';
import styles from './BootScreen.module.css';

/** Shown while the first navigation restores the session, usually for a fraction of a second. */
export function BootScreen() {
  return (
    <>
      <Masthead />
      <main id="main" className={styles.boot}>
        <p className={styles.status} role="status">
          Checking your session…
        </p>
      </main>
    </>
  );
}
