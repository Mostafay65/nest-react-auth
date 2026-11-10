import { Logger } from '@nestjs/common';

// Services log through Nest's Logger. Tests that care spy on it; the rest stay quiet.
Logger.overrideLogger(false);
