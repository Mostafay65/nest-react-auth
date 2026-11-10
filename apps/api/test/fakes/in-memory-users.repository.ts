import type { NewUser, User, UserWithPassword } from '../../src/users/user.js';
import { EmailAlreadyRegisteredError } from '../../src/users/users.errors.js';
import type { UsersRepository } from '../../src/users/users.repository.js';

/** Stands in for MongooseUsersRepository in unit tests, unique email index included. */
export class InMemoryUsersRepository implements UsersRepository {
  readonly records: UserWithPassword[] = [];

  async create(user: NewUser): Promise<User> {
    if (this.records.some((record) => record.email === user.email)) {
      throw new EmailAlreadyRegisteredError();
    }
    const record = { ...user, id: objectIdFor(this.records.length + 1), createdAt: new Date() };
    this.records.push(record);
    return withoutPassword(record);
  }

  async findById(id: string): Promise<User | null> {
    const record = this.records.find((candidate) => candidate.id === id);
    return record ? withoutPassword(record) : null;
  }

  async findByEmailWithPassword(email: string): Promise<UserWithPassword | null> {
    const record = this.records.find((candidate) => candidate.email === email);
    return record ? { ...record } : null;
  }
}

/** Same shape as a MongoDB ObjectId: 24 hex characters. */
const objectIdFor = (sequence: number): string => sequence.toString(16).padStart(24, '0');

function withoutPassword({ passwordHash: _passwordHash, ...user }: UserWithPassword): User {
  return user;
}
