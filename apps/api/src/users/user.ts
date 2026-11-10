import type { UserProfile } from '@nest-react-auth/contracts';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

/** Only sign-in needs the hash, so only one repository method returns it. */
export interface UserWithPassword extends User {
  passwordHash: string;
}

export interface NewUser {
  email: string;
  name: string;
  passwordHash: string;
}

export const toUserProfile = (user: User): UserProfile => ({
  id: user.id,
  email: user.email,
  name: user.name,
  createdAt: user.createdAt.toISOString(),
});
