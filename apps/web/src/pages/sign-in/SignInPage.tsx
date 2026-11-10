import { Link } from 'react-router';
import { SignInForm } from '@/features/auth/components/SignInForm';
import { paths } from '@/shared/paths';
import { Spread } from '@/shared/ui/Spread';
import styles from '../auth-page.module.css';

export function SignInPage() {
  return (
    <Spread index="01" title="Sign in." lede="Use the email and password you registered with.">
      <title>Sign in · Auth Module</title>
      <SignInForm />
      <p className={styles.switch}>
        No account yet? <Link to={paths.signUp}>Create one</Link>
      </p>
    </Spread>
  );
}
