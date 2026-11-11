import type { ComponentPropsWithRef, MouseEvent } from 'react';
import { cx } from './cx';
import styles from './Button.module.css';

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  /** `solid` is the page's one primary action; `text` is a quiet secondary one. */
  variant?: 'solid' | 'text';
  /**
   * The action is under way, so presses are ignored. Unlike `disabled`, the
   * button keeps focus: keyboard and screen reader users don't lose their place.
   */
  pending?: boolean;
}

export function Button({
  variant = 'solid',
  type = 'button',
  pending = false,
  className,
  children,
  onClick,
  ...button
}: ButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    // Cancelling the click also stops a submit button, or Enter in a field, from submitting.
    if (pending) event.preventDefault();
    else onClick?.(event);
  }

  return (
    <button
      {...button}
      type={type}
      className={cx(styles[variant], className)}
      aria-disabled={pending || undefined}
      onClick={handleClick}
    >
      <span>{children}</span>
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
    </button>
  );
}
