import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type UserProfile, userProfileSchema } from '@nest-react-auth/contracts';
import { type AuthenticatedUser, CurrentUser } from '../common/auth/current-user.decorator.js';
import { API_VERSION } from '../common/http/api.constants.js';
import { ACCESS_TOKEN_AUTH, ApiProblemResponse } from '../common/swagger/swagger.js';
import { toUserProfile } from './user.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth(ACCESS_TOKEN_AUTH)
@Controller({ path: 'users', version: API_VERSION })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Profile of the signed-in user',
    description: 'Protected route: requires a valid access token.',
  })
  @ApiOkResponse({ description: 'The signed-in user', standardSchema: userProfileSchema })
  @ApiProblemResponse(401, 'The access token is missing, malformed, tampered with or expired')
  @ApiProblemResponse(404, 'The account was deleted after the token was issued')
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserProfile> {
    return toUserProfile(await this.users.getProfile(user.id));
  }
}
