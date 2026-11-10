import { Link } from 'react-router';
import { SignUpForm } from '@/features/auth/components/SignUpForm';
import { paths } from '@/shared/paths';
import { Spread } from '@/shared/ui/Spread';
import styles from '../auth-page.module.css';

export function SignUpPage() {
  return (
    <Spread
      index="02"
      title="Create an account."
      lede="Your name, your email and a password. That is all it takes."
    >
      <title>Create account · Auth Module</title>
      <SignUpForm />
      <p className={styles.switch}>
        Already registered? <Link to={paths.signIn}>Sign in</Link>
      </p>
    </Spread>
  );
}
