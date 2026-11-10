import { zodResolver } from '@hookform/resolvers/zod';
import { type SignUpData, type SignUpInput, signUpSchema } from '@nest-react-auth/contracts';
import { useId, useState } from 'react';
import { type Path, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/shared/ui/Button';
import { FormAlert } from '@/shared/ui/FormAlert';
import { TextField } from '@/shared/ui/TextField';
import { authApi } from '../auth-api';
import { useStartSession } from '../use-start-session';
import styles from './AuthForm.module.css';
import { PasswordChecklist } from './PasswordChecklist';
import { PasswordToggle } from './PasswordToggle';

const FIELDS = ['name', 'email', 'password'] as const satisfies readonly Path<SignUpInput>[];

export function SignUpForm() {
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    control,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<SignUpInput, unknown, SignUpData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const password = useWatch({ control, name: 'password' });
  const { startSession, alert, alertRef } = useStartSession(FIELDS, setError, setFocus);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const passwordId = useId();
  const checklistId = useId();

  const onSubmit = handleSubmit((values) => startSession(() => authApi.signUp(values)));

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <TextField
        label="Name"
        autoComplete="name"
        error={errors.name?.message}
        {...register('name')}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        error={errors.email?.message}
        {...register('email')}
      />
      <TextField
        id={passwordId}
        label="Password"
        type={passwordVisible ? 'text' : 'password'}
        autoComplete="new-password"
        error={errors.password?.message}
        describedBy={checklistId}
        action={
          <PasswordToggle
            inputId={passwordId}
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((visible) => !visible)}
          />
        }
        {...register('password')}
      >
        <PasswordChecklist
          id={checklistId}
          password={password}
          showMissing={isSubmitted && errors.password !== undefined}
        />
      </TextField>

      {alert && <FormAlert ref={alertRef} title="Your account was not created" message={alert} />}

      <Button type="submit" className={styles.submit} disabled={isSubmitting}>
        {isSubmitting ? 'Creating your account…' : 'Create account'}
      </Button>
    </form>
  );
}
