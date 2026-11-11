import { zodResolver } from '@hookform/resolvers/zod';
import { type SignInData, type SignInInput, signInSchema } from '@nest-react-auth/contracts';
import { useId, useState } from 'react';
import { type Path, useForm } from 'react-hook-form';
import { Button } from '@/shared/ui/Button';
import { FormAlert } from '@/shared/ui/FormAlert';
import { TextField } from '@/shared/ui/TextField';
import { authApi } from '../auth-api';
import { useStartSession } from '../use-start-session';
import styles from './AuthForm.module.css';
import { PasswordToggle } from './PasswordToggle';

const FIELDS = ['email', 'password'] as const satisfies readonly Path<SignInInput>[];

export function SignInForm() {
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput, unknown, SignInData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });
  const { submit, alert, alertRef } = useStartSession(FIELDS, setError, setFocus);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const passwordId = useId();

  const onSubmit = handleSubmit((values) => submit(() => authApi.signIn(values)));

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <TextField
        label="Email"
        type="email"
        // The email is the account's username: password managers fill and save it with the password.
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        error={errors.email?.message}
        {...register('email')}
      />
      <TextField
        id={passwordId}
        label="Password"
        type={passwordVisible ? 'text' : 'password'}
        autoComplete="current-password"
        error={errors.password?.message}
        action={
          <PasswordToggle
            inputId={passwordId}
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((visible) => !visible)}
          />
        }
        {...register('password')}
      />

      {alert && <FormAlert ref={alertRef} title="You are not signed in" message={alert} />}

      <Button type="submit" className={styles.submit} pending={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
