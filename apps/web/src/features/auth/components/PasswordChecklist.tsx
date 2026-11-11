import { normalizePassword, PASSWORD_RULES } from '@nest-react-auth/contracts';
import { cx } from '@/shared/ui/cx';
import styles from './PasswordChecklist.module.css';

interface PasswordChecklistProps {
  id: string;
  password: string;
  /** After a failed submit, the rules still missing are marked in the accent colour. */
  showMissing: boolean;
}

/** The API's own password rules, ticked off as the user types. */
export function PasswordChecklist({ id, password, showMissing }: PasswordChecklistProps) {
  // The API judges the normalised password, so the checklist does too.
  const normalized = normalizePassword(password);
  const rules = PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.test(normalized) }));
  const metCount = rules.filter((rule) => rule.met).length;
  const headingId = `${id}-heading`;

  return (
    <div id={id} className={styles.checklist}>
      <p id={headingId} className={styles.heading}>
        Your password needs
      </p>
      <ul className={styles.rules} aria-labelledby={headingId}>
        {rules.map((rule) => (
          <li
            key={rule.id}
            className={cx(
              styles.rule,
              rule.met && styles.met,
              showMissing && !rule.met && styles.missing,
            )}
          >
            <svg className={styles.mark} viewBox="0 0 16 16" aria-hidden="true">
              <path className={styles.dash} d="M4 8h8" />
              <path className={styles.tick} d="M3 8.5 6.5 12 13 4" pathLength={1} />
            </svg>
            {rule.label}
            <span className="visually-hidden">{rule.met ? ', done' : ', not yet'}</span>
          </li>
        ))}
      </ul>
      <p className="visually-hidden" aria-live="polite">
        {metCount} of {rules.length} password rules met
      </p>
    </div>
  );
}
