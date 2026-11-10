import { ConfigService } from '@nestjs/config';
import { createApp } from './app.setup.js';
import type { Env } from './config/env.js';

const app = await createApp();

const port = app.get<ConfigService<Env, true>>(ConfigService).get('PORT', { infer: true });
await app.listen(port);
