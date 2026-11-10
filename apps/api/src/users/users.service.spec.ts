import { InMemoryUsersRepository } from '../../test/fakes/in-memory-users.repository.js';
import { UserNotFoundError } from './users.errors.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let users: UsersService;

  beforeEach(() => {
    users = new UsersService(new InMemoryUsersRepository());
  });

  it('returns the profile of an existing user', async () => {
    const ada = await users.register({
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$hash',
    });

    await expect(users.getProfile(ada.id)).resolves.toEqual(ada);
  });

  it('reports a user that no longer exists', async () => {
    await expect(users.getProfile('665f1c2e8b3a4d0012345678')).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });
});
