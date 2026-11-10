import type { AuthSession } from '@nest-react-auth/contracts';
import { useEffect, useRef, useState } from 'react';
import type { FieldValues, Path, UseFormSetError, UseFormSetFocus } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { paths } from '@/shared/paths';
import { placeServerError } from './form-errors';
import { sessionStore } from './session-store';

/**
 * The submit step shared by sign-in and sign-up: start the session and open
 * the app, or show the server's answer. Focus moves to the first problem, a
 * field or the form-level alert, so keyboard and screen reader users land on it.
 */
export function useStartSession<T extends FieldValues>(
  fields: readonly Path<T>[],
  setError: UseFormSetError<T>,
  setFocus: UseFormSetFocus<T>,
) {
  const navigate = useNavigate();
  const [alert, setAlert] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (alert) alertRef.current?.focus();
  }, [alert]);

  async function startSession(request: () => Promise<AuthSession>): Promise<void> {
    setAlert(null);
    try {
      sessionStore.start(await request());
      await navigate(paths.app, { replace: true });
    } catch (error) {
      const failure = placeServerError(error, fields, setError);
      if ('field' in failure) setFocus(failure.field);
      else setAlert(failure.message);
    }
  }

  return { startSession, alert, alertRef };
}
