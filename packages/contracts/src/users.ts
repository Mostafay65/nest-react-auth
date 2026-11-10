import { z } from 'zod';

/** The public view of a user. The password hash never leaves the API. */
export const userProfileSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  createdAt: z.iso.datetime(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
