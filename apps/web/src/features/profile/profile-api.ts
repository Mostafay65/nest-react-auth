import { userProfileSchema } from '@nest-react-auth/contracts';
import { authorizedJson } from '@/features/auth/authorized-request';

/** GET /users/me, the API's protected endpoint. */
export const fetchProfile = (signal?: AbortSignal) =>
  authorizedJson('/api/v1/users/me', userProfileSchema, { signal });
