import { type ComponentPropsWithRef, type ReactNode, useId } from 'react';
import { cx } from './cx';
import styles from './TextField.module.css';

interface TextFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'className'> {
  label: string;
  error?: string;
  /** Ids of other elements that describe the field, such as a checklist below it. */
  describedBy?: string;
  /** A control inside the field's line, such as a show-password toggle. */
  action?: ReactNode;
  children?: ReactNode;
}

/** A labelled input on a single underline. `children` render below the error. */
export function TextField({
  label,
  error,
  describedBy,
  action,
  children,
  id,
  ...input
}: TextFieldProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const errorId = `${inputId}-error`;
  const descriptions = cx(error && errorId, describedBy) || undefined;

  return (
    <div className={cx(styles.field, error && styles.invalid)}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          id={inputId}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={descriptions}
          {...input}
        />
        {action}
      </div>
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
      {children}
    </div>
  );
}
