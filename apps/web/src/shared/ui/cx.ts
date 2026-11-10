/** Joins the class names that are set: `cx(styles.field, invalid && styles.invalid)`. */
export const cx = (...names: Array<string | false | null | undefined>): string =>
  names.filter(Boolean).join(' ');
