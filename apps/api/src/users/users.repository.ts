import type { NewUser, User, UserWithPassword } from './user.js';

/**
 * Persistence port for users. Services depend on this abstract class (it is
 * also the DI token), never on Mongoose, so storage can change without
 * touching business logic, and unit tests can use an in-memory fake.
 */
export abstract class UsersRepository {
  /** @throws EmailAlreadyRegisteredError when the email is already taken. */
  abstract create(user: NewUser): Promise<User>;

  abstract findById(id: string): Promise<User | null>;

  abstract findByEmailWithPassword(email: string): Promise<UserWithPassword | null>;
}
