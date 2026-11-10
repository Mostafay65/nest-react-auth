import { type LoaderFunctionArgs, redirect } from 'react-router';
import { fetchProfile } from '@/features/profile/profile-api';
import { isUnauthorized } from '@/shared/http/api-error';
import { paths } from '@/shared/paths';

export async function welcomeLoader({ request }: LoaderFunctionArgs) {
  try {
    const profile = await fetchProfile(request.signal);
    return { profile, viewedAt: new Date().toISOString() };
  } catch (error) {
    // The session ran out while the page was loading: the refresh token expired or was revoked.
    if (isUnauthorized(error)) throw redirect(paths.signIn);
    throw error;
  }
}
