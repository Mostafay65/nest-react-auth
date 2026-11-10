import { Injectable } from '@nestjs/common';
import type { NewUser, User, UserWithPassword } from './user.js';
import { UserNotFoundError } from './users.errors.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

  /** @throws EmailAlreadyRegisteredError when the email is already taken. */
  register(user: NewUser): Promise<User> {
    return this.users.create(user);
  }

  findById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  findForSignIn(email: string): Promise<UserWithPassword | null> {
    return this.users.findByEmailWithPassword(email);
  }

  /** @throws UserNotFoundError when the account was deleted after the token was issued. */
  async getProfile(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new UserNotFoundError();
    return user;
  }
}
