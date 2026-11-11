import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/auth/public.decorator.js';
import { ApiOtherProblemsResponse, ApiProblemResponse } from '../common/swagger/swagger.js';

@ApiTags('health')
@ApiOtherProblemsResponse()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongo: MongooseHealthIndicator,
  ) {}

  @Get()
  @Public()
  @SkipThrottle()
  // Terminus' own docs describe a JSON 503; the problem-details filter answers it instead.
  @HealthCheck({ noCache: true, swaggerDocumentation: false })
  @ApiOperation({ summary: 'Liveness and readiness: the API is up and MongoDB answers a ping' })
  @ApiOkResponse({
    description: 'The API is up and MongoDB answered a ping',
    example: {
      status: 'ok',
      info: { mongodb: { status: 'up' } },
      error: {},
      details: { mongodb: { status: 'up' } },
    },
  })
  @ApiProblemResponse(503, 'MongoDB did not answer in time')
  check() {
    return this.health.check([() => this.mongo.pingCheck('mongodb').withTimeout(1_500)]);
  }
}
