import type { ComponentPropsWithRef } from 'react';
import { cx } from './cx';
import styles from './Button.module.css';

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  /** `solid` is the page's one primary action; `text` is a quiet secondary one. */
  variant?: 'solid' | 'text';
}

export function Button({
  variant = 'solid',
  type = 'button',
  className,
  children,
  ...button
}: ButtonProps) {
  return (
    <button type={type} className={cx(styles[variant], className)} {...button}>
      <span>{children}</span>
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
    </button>
  );
}
