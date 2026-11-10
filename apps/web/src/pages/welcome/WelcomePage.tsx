import { type ReactNode, useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import { signOut } from '@/features/auth/session';
import { paths } from '@/shared/paths';
import { Button } from '@/shared/ui/Button';
import type { welcomeLoader } from './welcome.loader';
import styles from './WelcomePage.module.css';

const longDate = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' });
const fullDate = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' });

export function WelcomePage() {
  const { profile, viewedAt } = useLoaderData<typeof welcomeLoader>();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutFailed(false);
    try {
      await signOut();
      await navigate(paths.signIn, { replace: true });
    } catch {
      setSignOutFailed(true);
      setSigningOut(false);
    }
  }

  return (
    <article className={styles.page} aria-labelledby="page-title">
      <title>Welcome · Auth Module</title>
      <p className={styles.dateline}>
        <time dateTime={viewedAt}>{fullDate.format(new Date(viewedAt))}</time>
        <span>Session active</span>
      </p>

      <h1 id="page-title" className={styles.headline} tabIndex={-1}>
        Welcome to the application.
      </h1>

      <section className={styles.account} aria-labelledby="account-heading">
        <h2 id="account-heading" className={styles.accountHeading}>
          Your account
        </h2>
        <dl className={styles.ledger}>
          <LedgerEntry term="Name">{profile.name}</LedgerEntry>
          <LedgerEntry term="Email">{profile.email}</LedgerEntry>
          <LedgerEntry term="Member since">
            <time dateTime={profile.createdAt}>{longDate.format(new Date(profile.createdAt))}</time>
          </LedgerEntry>
          <LedgerEntry term="Session">
            Signed in on this device, renewed while you use it.
          </LedgerEntry>
        </dl>

        <div className={styles.actions}>
          <Button variant="text" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
          {signOutFailed && (
            <p className={styles.error} role="alert">
              We could not sign you out just now, so you are still signed in. Please try again.
            </p>
          )}
        </div>
      </section>
    </article>
  );
}

function LedgerEntry({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className={styles.entry}>
      <dt className={styles.term}>{term}</dt>
      <dd className={styles.value}>{children}</dd>
    </div>
  );
}
