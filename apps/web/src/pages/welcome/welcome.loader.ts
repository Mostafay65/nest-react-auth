import { type LoaderFunctionArgs, replace } from 'react-router';
import { fetchProfile } from '@/features/profile/profile-api';
import { isUnauthorized } from '@/shared/http/api-error';
import { paths } from '@/shared/paths';

export async function welcomeLoader({ request }: LoaderFunctionArgs) {
  try {
    const profile = await fetchProfile(request.signal);
    return { profile, viewedAt: new Date().toISOString() };
  } catch (error) {
    // The session ran out while the page was loading: the refresh token expired or was revoked.
    // `replace`, like the guards, so Back doesn't return to a page that can't load.
    if (isUnauthorized(error)) throw replace(paths.signIn);
    throw error;
  }
}
