import type { Ref } from 'react';
import styles from './FormAlert.module.css';

interface FormAlertProps {
  title: string;
  message: string;
  ref?: Ref<HTMLDivElement>;
}

/** A problem with the whole form. It takes focus when shown, so it is read out at once. */
export function FormAlert({ title, message, ref }: FormAlertProps) {
  return (
    <div ref={ref} className={styles.alert} role="alert" tabIndex={-1}>
      <p className={styles.title}>{title}</p>
      <p className={styles.message}>{message}</p>
    </div>
  );
}
