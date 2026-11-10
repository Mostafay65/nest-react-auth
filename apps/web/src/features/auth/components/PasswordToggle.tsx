import styles from './AuthForm.module.css';

interface PasswordToggleProps {
  inputId: string;
  visible: boolean;
  onToggle: () => void;
}

/** Shows or hides the password, so people can check what they typed. */
export function PasswordToggle({ inputId, visible, onToggle }: PasswordToggleProps) {
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-controls={inputId}
      aria-label={visible ? 'Hide password' : 'Show password'}
      onClick={onToggle}
    >
      {visible ? 'Hide' : 'Show'}
    </button>
  );
}
